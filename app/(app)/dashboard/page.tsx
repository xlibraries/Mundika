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
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-3xl border border-[#cfe3d4] bg-[#e0ebe3]" />
      <div className="h-72 animate-pulse rounded-3xl border border-[#cfe3d4] bg-[#e0ebe3]" />
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
    <div className="flex min-h-0 flex-col gap-4">
      <section className="shrink-0 rounded-3xl border border-[#c5dccf] bg-[#f1f6f2] px-4 py-5 shadow-sm md:px-6 md:py-6">
        <div className="flex min-h-[var(--shell-ribbon-min)] flex-col gap-4 border-b border-[#cfe3d4] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-0 flex-1 flex-col justify-center space-y-2">
            <h1 className="text-base font-semibold tracking-tight text-[#2a382f] md:text-lg">
              Today&apos;s overview
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[#5c6e62]">
              Sales today, cash vs credit split, and purchase spend —{" "}
              <span className="font-mono text-[#4d7a5c]">{today}</span>. Sync
              when online.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge
              variant={online ? "success" : "warning"}
              className="!border-[#b8d4c2] !bg-[#e8f2ea] !normal-case !tracking-normal !text-[#2a382f]"
            >
              {online ? "Online" : "Offline"}
            </Badge>
            <Badge
              variant="muted"
              className="!border-[#cfe3d4] !text-[#5c6e62] !normal-case !tracking-normal"
            >
              {syncState === "syncing" || isResyncing ? "Syncing" : "Idle"}
              {lastSyncAt ? ` · ${lastSyncAt.slice(11, 19)}` : ""}
            </Badge>
            <button
              type="button"
              disabled={isResyncing || !online}
              onClick={() => void handleResync()}
              className="rounded-lg border border-[#c5dccf] bg-white px-2.5 py-1 text-xs font-medium text-[#4d7a5c] transition hover:bg-[#e8f2ea] disabled:cursor-not-allowed disabled:opacity-50"
              title="Re-push all local data to Supabase"
            >
              {isResyncing ? "Syncing…" : "Force resync"}
            </button>
          </div>
          {resyncMsg ? (
            <p className="mt-2 text-xs text-[#4d7a5c]">{resyncMsg}</p>
          ) : null}
        </div>

        {!stats ? (
          <div className="mt-5 h-24 shrink-0 animate-pulse rounded-2xl border border-[#cfe3d4] bg-[#e0ebe3]" />
        ) : (
          <div className="mt-5 grid shrink-0 gap-px overflow-hidden rounded-2xl border border-[#c5dccf] bg-[#c5dccf] sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Sales" value={formatINR(stats.salesTotal)} />
            <Kpi label="Cash" value={formatINR(stats.cashTotal)} />
            <Kpi label="Credit" value={formatINR(stats.creditTotal)} />
            <Kpi label="Purchases" value={formatINR(stats.purchasesTotal)} />
          </div>
        )}
      </section>

      <section className="flex min-h-[min(70vh,720px)] flex-1 flex-col overflow-hidden rounded-3xl border border-[#c5dccf] bg-[#e8f2ec] shadow-[0_16px_40px_-24px_rgba(42,56,47,0.18)]">
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#eef5f0] p-3 md:p-4">
          <div className="min-h-0 overflow-hidden rounded-2xl border border-[#cfe3d4]/80 bg-[#faf9f5] shadow-sm">
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
    <div className="bg-[#faf9f5] px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#5c6e62]">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg tabular-nums text-[#2a382f]">{value}</p>
    </div>
  );
}
