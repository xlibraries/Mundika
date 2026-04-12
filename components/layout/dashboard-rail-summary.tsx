"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { getLocalDateInputValue } from "@/lib/date/local-date";
import { formatINR } from "@/lib/format/inr";
import { useUserId } from "@/hooks/use-user-id";
import { useAppStore } from "@/store/app-store";

export function DashboardRailSummary({ pathname }: { pathname: string }) {
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const { userId } = useUserId();
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const today = useMemo(() => getLocalDateInputValue(), []);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDashboardStats>> | null>(
    null
  );

  useEffect(() => {
    if (!isDashboard || !userId) return;
    void getDashboardStats(userId, today).then(setStats);
  }, [isDashboard, userId, today, lastSyncAt]);

  if (!isDashboard) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-left">
        <Metric label="Sales" value={stats ? formatINR(stats.salesTotal) : "—"} />
        <Metric label="Cash" value={stats ? formatINR(stats.cashTotal) : "—"} />
        <Metric label="Credit" value={stats ? formatINR(stats.creditTotal) : "—"} />
        <Metric label="Purchases" value={stats ? formatINR(stats.purchasesTotal) : "—"} />
      {lastSyncAt ? (
        <p className="col-span-2 text-[10px] text-[var(--gs-text-secondary)]">
          Last sync: <span className="font-mono">{lastSyncAt.slice(11, 19)}</span>
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface)] px-2 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--gs-text-secondary)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xs text-[var(--gs-text)]">{value}</p>
    </div>
  );
}
