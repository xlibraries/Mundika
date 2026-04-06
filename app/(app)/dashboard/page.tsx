"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { useUserId } from "@/hooks/use-user-id";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { userId, loading } = useUserId();
  const online = useAppStore((s) => s.online);
  const syncState = useAppStore((s) => s.syncState);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getDashboardStats>
  > | null>(null);

  useEffect(() => {
    if (!userId) return;
    void getDashboardStats(userId, today).then(setStats);
  }, [userId, today]);

  if (loading || !userId) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />
        <div className="h-32 animate-pulse rounded-xl bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Today"
        description={`Sales and stock signals for ${today}. Figures are from your device; sync runs in the background.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={online ? "success" : "warning"}>
              {online ? "Online" : "Offline"}
            </Badge>
            <Badge variant="muted">
              {syncState === "syncing" ? "Syncing…" : "Ready"}
              {lastSyncAt ? ` · ${lastSyncAt.slice(11, 19)}` : ""}
            </Badge>
          </div>
        }
      />

      {!stats ? (
        <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/20">
            <div className="grid divide-y divide-white/[0.06] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              <Metric
                label="Sales total"
                value={`₹ ${stats.salesTotal.toFixed(2)}`}
                hint="All bills dated today"
              />
              <Metric
                label="Cash"
                value={`₹ ${stats.cashTotal.toFixed(2)}`}
                hint="Cash bills"
              />
              <Metric
                label="Credit"
                value={`₹ ${stats.creditTotal.toFixed(2)}`}
                hint="Credit bills"
              />
              <Metric
                label="Purchases"
                value={`₹ ${stats.purchasesTotal.toFixed(2)}`}
                hint="Ledger · purchase · today"
              />
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-400">
              Low stock (total ≤ 10)
            </h2>
            {!stats.lowStock.length ? (
              <p className="text-sm text-zinc-500">No items under threshold.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-2.5">Item</th>
                      <th className="px-4 py-2.5 text-right tabular-nums">
                        Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {stats.lowStock.map((r) => (
                      <tr
                        key={r.item_id}
                        className="hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-2.5 text-zinc-200">{r.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-amber-400/90">
                          {r.qty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums tracking-tight text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-600">{hint}</p>
    </div>
  );
}
