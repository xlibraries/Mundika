"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { formatINR } from "@/lib/format/inr";
import { useUserId } from "@/hooks/use-user-id";
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";
import { TransactionForm } from "@/components/transaction/transaction-form";
import { resyncAll } from "@/lib/sync/resync-all";
import { syncWithRemote } from "@/lib/sync/engine";

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-36 animate-pulse rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-surface)]" />
      <div className="h-80 animate-pulse rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-surface)]" />
    </div>
  );
}

function InventoryDashboardInner() {
  const router = useRouter();
  const { userId, loading } = useUserId();
  const online = useAppStore((s) => s.online);
  const syncState = useAppStore((s) => s.syncState);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const searchParams = useSearchParams();
  const [txBootMode] = useState<"billing" | "purchase">(() =>
    searchParams.get("tx") === "purchase" ? "purchase" : "billing"
  );

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getDashboardStats>
  > | null>(null);
  const [resyncMsg, setResyncMsg] = useState<string | null>(null);
  const [isResyncing, setIsResyncing] = useState(false);

  useEffect(() => {
    const raw = window.location.hash.slice(1);
    const h = raw === "inventory" ? "stock" : raw;
    if (h === "overview" || h === "stock" || h === "ledger") {
      router.replace(`/analytics#${h}`);
    }
  }, [router]);

  useLayoutEffect(() => {
    const tx = searchParams.get("tx");
    if (tx === "billing" || tx === "purchase") {
      window.history.replaceState(null, "", "/dashboard");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!userId) return;
    void getDashboardStats(userId, today).then(setStats);
  }, [userId, today, lastSyncAt]);

  async function handleResync() {
    if (!userId || isResyncing) return;
    setIsResyncing(true);
    setResyncMsg(null);
    try {
      const counts = await resyncAll(userId);
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      setResyncMsg(`Re-queued ${total} rows — syncing now…`);
      await syncWithRemote(userId);
      useAppStore.getState().setLastSyncAt(new Date().toISOString());
      setResyncMsg(`Sync complete. ${total} rows pushed and refreshed from server.`);
      window.setTimeout(() => setResyncMsg(null), 5000);
    } catch (e) {
      setResyncMsg(e instanceof Error ? e.message : "Resync failed");
    } finally {
      setIsResyncing(false);
    }
  }

  if (loading || !userId) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <section className="shrink-0 rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-5 py-5 shadow-[0_14px_34px_-26px_rgba(58,42,31,0.3)] md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gs-primary)]">
              MUNDIKA OPERATIONS DESK
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--gs-text)] md:text-2xl">
              Selected KPIs and daily workflow
            </h1>
            <p className="max-w-2xl text-sm text-[var(--gs-text-secondary)]">
              Use this surface for billing, purchase entries, and live decision
              numbers for <span className="font-mono text-[var(--gs-primary)]">{today}</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={online ? "success" : "warning"}
              className="!border-[var(--gs-border)] !bg-[var(--gs-surface)] !normal-case !tracking-normal !text-[var(--gs-text)]"
            >
              {online ? "Online" : "Offline"}
            </Badge>
            <Badge
              variant="muted"
              className="!border-[var(--gs-border)] !text-[var(--gs-text-secondary)] !normal-case !tracking-normal"
            >
              {syncState === "syncing" || isResyncing ? "Syncing" : "Idle"}
              {lastSyncAt ? ` · ${lastSyncAt.slice(11, 19)}` : ""}
            </Badge>
            <button
              type="button"
              disabled={isResyncing || !online}
              onClick={() => void handleResync()}
              className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface)] px-2.5 py-1 text-xs font-medium text-[var(--gs-primary)] transition duration-200 ease-out hover:bg-[var(--gs-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              title="Re-push all local data to Supabase"
            >
              {isResyncing ? "Syncing…" : "Force resync"}
            </button>
          </div>
        </div>

        {resyncMsg ? (
          <p className="mt-3 text-xs text-[var(--gs-primary)]">{resyncMsg}</p>
        ) : null}

        {!stats ? (
          <div className="mt-5 h-24 animate-pulse rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-surface)]" />
        ) : (
          <div className="mt-5 grid overflow-hidden rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-surface)] sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Sales" value={formatINR(stats.salesTotal)} />
            <Kpi label="Cash" value={formatINR(stats.cashTotal)} />
            <Kpi label="Credit" value={formatINR(stats.creditTotal)} />
            <Kpi label="Purchases" value={formatINR(stats.purchasesTotal)} />
          </div>
        )}
      </section>

      <section className="flex min-h-[min(70vh,740px)] flex-1 flex-col overflow-hidden rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-panel)] shadow-[0_18px_42px_-28px_rgba(58,42,31,0.34)]">
        <div className="border-b border-[var(--gs-border)] px-4 py-3 md:px-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
            Billing and purchase workspace
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--gs-surface)] p-3 md:p-4">
          <div className="min-h-0 overflow-hidden rounded-2xl border border-[var(--gs-border)]/80 bg-[var(--gs-surface-plain)] shadow-sm">
            <TransactionForm
              key={`tx-${txBootMode}`}
              userId={userId}
              defaultMode={txBootMode}
              embedded
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <InventoryDashboardInner />
    </Suspense>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--gs-border)] px-4 py-3.5 transition-colors duration-200 ease-out hover:bg-[var(--gs-surface-hover)] last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl tabular-nums text-[var(--gs-text)] md:text-2xl">{value}</p>
    </div>
  );
}
