"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { formatINR } from "@/lib/format/inr";
import { useUserId } from "@/hooks/use-user-id";
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";
import { InventorySheet } from "@/components/workspace/inventory-sheet";
import {
  LedgerBlock,
  PartiesBlock,
} from "@/components/workspace/parties-ledger-blocks";

type TabId = "overview" | "inventory" | "parties" | "ledger";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "parties", label: "Parties" },
  { id: "ledger", label: "Ledger" },
];

function getInitialTab(): TabId {
  if (typeof window === "undefined") return "inventory";
  const hash = window.location.hash.slice(1) as TabId;
  if (TABS.some((t) => t.id === hash)) return hash;
  return "inventory";
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
      className="flex border-b border-[#dadce0]"
      aria-label="Workspace sections"
    >
      {TABS.map((t, idx) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={activeTab === t.id}
          onClick={() => onTabChange(t.id)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] focus-visible:ring-offset-1 ${
            activeTab === t.id
              ? "border-[#1a73e8] text-[#1a73e8]"
              : "border-transparent text-[#5f6368] hover:text-[#202124]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function WorkspacePage() {
  const { userId, loading } = useUserId();
  const online = useAppStore((s) => s.online);
  const syncState = useAppStore((s) => s.syncState);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getDashboardStats>
  > | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const bump = () => setRefreshToken((n) => n + 1);

  useEffect(() => {
    if (!userId) return;
    void getDashboardStats(userId, today).then(setStats);
  }, [userId, today, refreshToken]);

  function handleTabChange(id: TabId) {
    setActiveTab(id);
    history.replaceState(null, "", `/dashboard#${id}`);
  }

  // Sync tab if browser hash changes externally (back/forward)
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1) as TabId;
      if (TABS.some((t) => t.id === hash)) {
        setActiveTab(hash);
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (loading || !userId) {
    return (
      <div className="space-y-6">
        <div className="h-16 animate-pulse rounded border border-[#dadce0] bg-[#f8f9fa]" />
        <div className="h-64 animate-pulse rounded border border-[#dadce0] bg-[#f8f9fa]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#dadce0] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-medium tracking-tight text-[#202124]">
            Workspace
          </h1>
          <p className="max-w-xl text-sm text-[#5f6368]">
            Local-first · Today: {today}. Syncs when online.
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
      </header>

      {!stats ? (
        <div className="h-24 animate-pulse rounded border border-[#dadce0] bg-[#f8f9fa]" />
      ) : (
        <div className="grid gap-px overflow-hidden rounded-sm border border-[#dadce0] bg-[#dadce0] sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Sales" value={formatINR(stats.salesTotal)} />
          <Kpi label="Cash" value={formatINR(stats.cashTotal)} />
          <Kpi label="Credit" value={formatINR(stats.creditTotal)} />
          <Kpi label="Purchases" value={formatINR(stats.purchasesTotal)} />
        </div>
      )}

      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

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
            Switch to Inventory, Parties, or Ledger tabs to manage your data.
          </p>
        </div>
      )}

      {activeTab === "inventory" && (
        <InventorySheet
          userId={userId}
          refreshToken={refreshToken}
          onChanged={bump}
        />
      )}

      {activeTab === "parties" && (
        <PartiesBlock
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
