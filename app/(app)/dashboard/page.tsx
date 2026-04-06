"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { useUserId } from "@/hooks/use-user-id";
import { useAppStore } from "@/store/app-store";

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
      <p className="text-sm text-zinc-500" suppressHydrationWarning>
        Loading…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-xs text-zinc-500">
          {online ? "Online" : "Offline"} · sync {syncState}
          {lastSyncAt ? ` · ${lastSyncAt.slice(11, 19)}` : ""}
        </p>
      </header>

      {!stats ? (
        <p className="text-sm text-zinc-500">Loading stats…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Today sales" value={`₹ ${stats.salesTotal.toFixed(2)}`} />
          <Stat label="Cash" value={`₹ ${stats.cashTotal.toFixed(2)}`} />
          <Stat label="Credit" value={`₹ ${stats.creditTotal.toFixed(2)}`} />
          <Stat
            label="Purchases (today)"
            value={`₹ ${stats.purchasesTotal.toFixed(2)}`}
          />
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Low stock (≤10)
        </h2>
        {!stats || stats.lowStock.length === 0 ? (
          <p className="text-sm text-zinc-500">None</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {stats.lowStock.map((r) => (
              <li
                key={r.item_id}
                className="flex justify-between px-3 py-2 text-sm"
              >
                <span>{r.name}</span>
                <span className="text-zinc-500">{r.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
