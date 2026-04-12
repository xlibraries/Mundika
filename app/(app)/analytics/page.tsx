"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { getLocalDateInputValue } from "@/lib/date/local-date";
import { formatINR } from "@/lib/format/inr";
import { useUserId } from "@/hooks/use-user-id";
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";
import { InventorySheet } from "@/components/workspace/inventory-sheet";
import { LedgerBlock, PartiesBlock } from "@/components/workspace/parties-ledger-blocks";

type TabId = "overview" | "stock" | "contacts" | "ledger";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "stock", label: "Stock" },
  { id: "contacts", label: "Contacts" },
  { id: "ledger", label: "Ledger" },
];

function getInitialTab(): TabId {
  if (typeof window === "undefined") return "overview";
  const raw = window.location.hash.slice(1);
  if (raw === "inventory") return "stock";
  if (raw === "parties") return "contacts";
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
      className="flex flex-wrap gap-2 border-b border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2"
      aria-label="Analytics sections"
    >
      {TABS.map((t, idx) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={activeTab === t.id}
          onClick={() => onTabChange(t.id)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gs-primary)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gs-surface)] ${
            activeTab === t.id
              ? "border border-[var(--gs-grid)] bg-[var(--gs-surface-plain)] text-[var(--gs-text)] shadow-sm"
              : "border border-transparent text-[var(--gs-text-secondary)] hover:border-[var(--gs-border)] hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]"
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
    <div className="space-y-5">
      <div className="h-28 animate-pulse rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-surface)]" />
      <div className="h-80 animate-pulse rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-surface)]" />
    </div>
  );
}

export default function AnalyticsPage() {
  const { userId, loading } = useUserId();
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const today = useMemo(() => getLocalDateInputValue(), []);
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
  }, [userId, today, refreshToken, lastSyncAt]);

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
      if (raw === "parties") {
        setActiveTab("contacts");
        return;
      }
      const match = TABS.find((t) => t.id === raw);
      setActiveTab(match ? match.id : "overview");
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (loading || !userId) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <section className="flex shrink-0 flex-col rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-5 py-5 shadow-[0_14px_34px_-26px_rgba(58,42,31,0.3)] md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gs-primary)]">
              MUNDIKA ANALYTICS DESK
            </p>
            <h1 className="mt-2 text-xl font-semibold text-[var(--gs-text)] md:text-2xl">
              Stock, ledger, and performance insights
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--gs-text-secondary)]">
              Use tabs to monitor today&apos;s performance and inspect operational
              details for <span className="font-mono text-[var(--gs-primary)]">{today}</span>.
            </p>
          </div>
          <Badge
            variant="muted"
            className="!shrink-0 !border-[var(--gs-border)] !bg-[var(--gs-surface)] !text-[var(--gs-text-secondary)] !normal-case !tracking-normal"
          >
            Live workspace
          </Badge>
        </div>
      </section>

      <section className="flex min-h-[min(70vh,740px)] flex-1 flex-col overflow-hidden rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-panel)] shadow-[0_18px_42px_-28px_rgba(58,42,31,0.34)]">
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--gs-surface)] p-3 md:p-4">
          <div className="min-h-0 rounded-2xl border border-[var(--gs-border)]/80 bg-[var(--gs-surface-plain)] p-4 shadow-sm md:p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {!stats ? (
                  <div className="h-24 animate-pulse rounded-2xl border border-[var(--gs-grid)] bg-[var(--gs-surface)]" />
                ) : (
                  <div className="grid overflow-hidden rounded-2xl border border-[var(--gs-grid)] bg-[var(--gs-surface)] sm:grid-cols-2 lg:grid-cols-4">
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
                  <p className="rounded-xl border border-[var(--gs-warning)]/40 bg-[var(--gs-warning-soft)] px-3 py-2 text-sm text-[var(--gs-warning)]">
                    Low stock:{" "}
                    {stats.lowStock
                      .map((s) => `${s.name} (${s.qty})`)
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2 text-sm text-[var(--gs-text-secondary)]">
                    No low-stock items.
                  </p>
                )}
                <p className="text-sm text-[var(--gs-text-secondary)]">
                  Billing and purchases live under{" "}
                  <strong className="text-[var(--gs-text)]">Inventory</strong>. Use{" "}
                  <strong className="text-[var(--gs-text)]">Stock</strong> here for the
                  grid and <strong className="text-[var(--gs-text)]">Ledger</strong>{" "}
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

            {activeTab === "contacts" && (
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
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--gs-grid)] px-4 py-3.5 text-left transition-colors duration-200 ease-out hover:bg-[var(--gs-surface-hover)] last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl tabular-nums text-[var(--gs-text)] md:text-2xl">
        {value}
      </p>
    </div>
  );
}
