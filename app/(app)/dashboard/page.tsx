"use client";

import {
  Suspense,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { formatINR } from "@/lib/format/inr";
import { useUserId } from "@/hooks/use-user-id";
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";
import { TransactionForm } from "@/components/transaction/transaction-form";
import { InventorySheet } from "@/components/workspace/inventory-sheet";
import { LedgerBlock } from "@/components/workspace/parties-ledger-blocks";

type TabId = "transactions" | "overview" | "stock" | "ledger";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "transactions", label: "Transactions" },
  { id: "overview", label: "Overview" },
  { id: "stock", label: "Stock" },
  { id: "ledger", label: "Ledger" },
];

function getInitialTab(): TabId {
  if (typeof window === "undefined") return "transactions";
  const hash = window.location.hash.slice(1);
  if (hash === "inventory") return "stock";
  const match = TABS.find((t) => t.id === hash);
  return match ? (match.id as TabId) : "transactions";
}

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onTabChange(TABS[(idx + 1) % TABS.length].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onTabChange(TABS[(idx - 1 + TABS.length) % TABS.length].id);
    }
  }

  return (
    <div
      role="tablist"
      className="flex flex-wrap gap-0 border-b border-[#dadce0] bg-[#fafafa] px-1"
      aria-label="Workspace sections"
    >
      {TABS.map((t, idx) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={activeTab === t.id}
          onClick={() => onTabChange(t.id)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] focus-visible:ring-offset-1 ${
            activeTab === t.id
              ? "text-[#1a73e8] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#1a73e8]"
              : "text-[#5f6368] hover:text-[#202124]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-lg border border-[#dadce0] bg-white" />
      <div className="h-24 animate-pulse rounded-lg border border-[#dadce0] bg-white" />
      <div className="h-64 animate-pulse rounded-lg border border-[#dadce0] bg-white" />
    </div>
  );
}

function WorkspaceDashboardInner() {
  const { userId, loading } = useUserId();
  const online = useAppStore((s) => s.online);
  const syncState = useAppStore((s) => s.syncState);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tx = searchParams.get("tx");
    if (tx === "billing" || tx === "purchase") return "transactions";
    return getInitialTab();
  });
  const [txBootMode] = useState<"billing" | "purchase">(() =>
    searchParams.get("tx") === "purchase" ? "purchase" : "billing"
  );

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getDashboardStats>
  > | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const bump = () => setRefreshToken((n) => n + 1);

  useLayoutEffect(() => {
    const tx = searchParams.get("tx");
    if (tx === "billing" || tx === "purchase") {
      window.history.replaceState(null, "", "/dashboard#transactions");
      startTransition(() => setActiveTab("transactions"));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!userId) return;
    void getDashboardStats(userId, today).then(setStats);
  }, [userId, today, refreshToken]);

  function handleTabChange(id: TabId) {
    setActiveTab(id);
    history.replaceState(null, "", `/dashboard#${id}`);
  }

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1);
      if (hash === "inventory") {
        setActiveTab("stock");
        return;
      }
      const match = TABS.find((t) => t.id === hash);
      if (match) setActiveTab(match.id as TabId);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (loading || !userId) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {/* Top overview strip */}
      <section className="shrink-0 rounded-lg border border-[#dadce0] bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
        <div className="flex flex-col gap-4 border-b border-[#e8eaed] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-[#202124] md:text-xl">
              Workspace
            </h1>
            <p className="max-w-xl text-sm text-[#5f6368]">
              Today: {today}. Local-first; syncs when online. Use{" "}
              <span className="font-medium text-[#202124]">Transactions</span>{" "}
              for billing and purchases.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={online ? "success" : "warning"}>
              {online ? "Online" : "Offline"}
            </Badge>
            <Badge variant="muted">
              {syncState === "syncing" ? "Syncing" : "Idle"}
              {lastSyncAt ? ` · ${lastSyncAt.slice(11, 19)}` : ""}
            </Badge>
          </div>
        </div>

        {!stats ? (
          <div className="mt-4 h-20 animate-pulse rounded border border-[#e8eaed] bg-[#f8f9fa]" />
        ) : (
          <div className="mt-4 grid gap-px overflow-hidden rounded-sm border border-[#e8eaed] bg-[#e8eaed] sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Sales" value={formatINR(stats.salesTotal)} />
            <Kpi label="Cash" value={formatINR(stats.cashTotal)} />
            <Kpi label="Credit" value={formatINR(stats.creditTotal)} />
            <Kpi label="Purchases" value={formatINR(stats.purchasesTotal)} />
          </div>
        )}
      </section>

      {/* Central workspace panel */}
      <section className="flex min-h-[min(70vh,720px)] flex-1 flex-col overflow-hidden rounded-lg border border-[#dadce0] bg-[#fafafa] shadow-sm">
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4 md:p-6">
          {activeTab === "transactions" && (
            <TransactionForm
              key={`tx-${txBootMode}`}
              userId={userId}
              defaultMode={txBootMode}
              embedded
            />
          )}

          {activeTab === "overview" && (
            <div className="space-y-4">
              {stats && stats.lowStock.length > 0 ? (
                <p className="rounded border border-[#fde293] bg-[#fef7e0] px-3 py-2 text-sm text-[#b06000]">
                  Low stock:{" "}
                  {stats.lowStock.map((s) => `${s.name} (${s.qty})`).join(" · ")}
                </p>
              ) : (
                <p className="rounded border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm text-[#5f6368]">
                  No low-stock items.
                </p>
              )}
              <p className="text-sm text-[#5f6368]">
                Open <strong className="text-[#202124]">Stock</strong> for the
                grid, <strong className="text-[#202124]">Ledger</strong> for
                entries, or <strong className="text-[#202124]">Transactions</strong>{" "}
                to bill or purchase.
              </p>
            </div>
          )}

          {activeTab === "stock" && (
            <InventorySheet
              userId={userId}
              refreshToken={refreshToken}
              onChanged={bump}
            />
          )}

          {activeTab === "ledger" && (
            <LedgerBlock
              userId={userId}
              refreshToken={refreshToken}
              onChanged={bump}
            />
          )}
        </div>
      </section>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <WorkspaceDashboardInner />
    </Suspense>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-lg tabular-nums text-[#202124]">
        {value}
      </p>
    </div>
  );
}
