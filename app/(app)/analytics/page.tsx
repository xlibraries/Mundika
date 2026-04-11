"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { formatINR } from "@/lib/format/inr";
import { useUserId } from "@/hooks/use-user-id";
import { Badge } from "@/components/ui/badge";
import { InventorySheet } from "@/components/workspace/inventory-sheet";
import { LedgerBlock } from "@/components/workspace/parties-ledger-blocks";

type TabId = "overview" | "stock" | "ledger";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "stock", label: "Stock" },
  { id: "ledger", label: "Ledger" },
];

function getInitialTab(): TabId {
  if (typeof window === "undefined") return "overview";
  const raw = window.location.hash.slice(1);
  if (raw === "inventory") return "stock";
  const match = TABS.find((t) => t.id === raw);
  return match ? match.id : "overview";
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
      className="flex flex-wrap gap-2 border-b border-[#cfe3d4] bg-[#f1f6f2] px-3 py-2"
      aria-label="Analytics sections"
    >
      {TABS.map((t, idx) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={activeTab === t.id}
          onClick={() => onTabChange(t.id)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6b9b7a]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f1f6f2] ${
            activeTab === t.id
              ? "border border-[#a3c9b0] bg-[#faf9f5] text-[#2a382f] shadow-sm"
              : "border border-transparent text-[#5c6e62] hover:border-[#cfe3d4] hover:bg-[#e8f2ea] hover:text-[#2a382f]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-20 animate-pulse rounded-3xl border border-[#cfe3d4] bg-[#e0ebe3]" />
      <div className="h-72 animate-pulse rounded-3xl border border-[#cfe3d4] bg-[#e0ebe3]" />
    </div>
  );
}

export default function AnalyticsPage() {
  const { userId, loading } = useUserId();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useLayoutEffect(() => {
    const id = getInitialTab();
    queueMicrotask(() => setActiveTab(id));
  }, []);
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getDashboardStats>
  > | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const bump = useCallback(() => setRefreshToken((n) => n + 1), []);

  useEffect(() => {
    if (!userId) return;
    void getDashboardStats(userId, today).then(setStats);
  }, [userId, today, refreshToken]);

  function handleTabChange(id: TabId) {
    setActiveTab(id);
    history.replaceState(null, "", `/analytics#${id}`);
  }

  useEffect(() => {
    function onHashChange() {
      const raw = window.location.hash.slice(1);
      if (raw === "inventory") {
        setActiveTab("stock");
        return;
      }
      const match = TABS.find((t) => t.id === raw);
      if (match) setActiveTab(match.id);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (loading || !userId) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="flex min-h-[var(--shell-ribbon-min)] shrink-0 flex-col rounded-3xl border border-[#c5dccf] bg-[#f1f6f2] px-4 py-5 md:px-6 md:py-6">
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-semibold text-[#2a382f] md:text-lg">
              Analytics
            </h1>
            <p className="mt-1 max-w-xl text-sm text-[#5c6e62]">
              Overview, stock grid, and ledger — snapshot{" "}
              <span className="font-mono text-[#4d7a5c]">{today}</span>.
            </p>
          </div>
          <Badge
            variant="muted"
            className="!shrink-0 !border-[#cfe3d4] !text-[#5c6e62] !normal-case !tracking-normal"
          >
            Today
          </Badge>
        </div>
      </section>

      <section className="flex min-h-[min(70vh,720px)] flex-1 flex-col overflow-hidden rounded-3xl border border-[#c5dccf] bg-[#e8f2ec] shadow-[0_16px_40px_-24px_rgba(42,56,47,0.18)]">
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#eef5f0] p-3 md:p-4">
          <div className="min-h-0 rounded-2xl border border-[#cfe3d4]/80 bg-[#faf9f5] p-4 shadow-sm md:p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {!stats ? (
                  <div className="h-24 animate-pulse rounded-2xl border border-[#dce8df] bg-[#f4f8f5]" />
                ) : (
                  <div className="grid gap-px overflow-hidden rounded-2xl border border-[#dce8df] bg-[#dce8df] sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Sales" value={formatINR(stats.salesTotal)} />
                    <Stat label="Cash" value={formatINR(stats.cashTotal)} />
                    <Stat label="Credit" value={formatINR(stats.creditTotal)} />
                    <Stat
                      label="Purchases"
                      value={formatINR(stats.purchasesTotal)}
                    />
                  </div>
                )}
                {stats && stats.lowStock.length > 0 ? (
                  <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Low stock:{" "}
                    {stats.lowStock
                      .map((s) => `${s.name} (${s.qty})`)
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="rounded-xl border border-[#c5dccf] bg-[#f4f8f5] px-3 py-2 text-sm text-[#5c6e62]">
                    No low-stock items.
                  </p>
                )}
                <p className="text-sm text-[#5c6e62]">
                  Billing and purchases live under{" "}
                  <strong className="text-[#2a382f]">Inventory</strong>. Use{" "}
                  <strong className="text-[#2a382f]">Stock</strong> here for the
                  grid and <strong className="text-[#2a382f]">Ledger</strong>{" "}
                  for running entries.
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
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#faf9f5] px-4 py-3.5 text-left">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#5c6e62]">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg tabular-nums text-[#2a382f]">
        {value}
      </p>
    </div>
  );
}
