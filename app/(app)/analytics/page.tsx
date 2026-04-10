"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { formatINR } from "@/lib/format/inr";
import { useUserId } from "@/hooks/use-user-id";
import { Badge } from "@/components/ui/badge";

export default function AnalyticsPage() {
  const { userId, loading } = useUserId();
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
      <div className="space-y-4">
        <div className="h-14 animate-pulse rounded-lg border border-[#dadce0] bg-white" />
        <div className="h-40 animate-pulse rounded-lg border border-[#dadce0] bg-white" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-[#dadce0] bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#202124] md:text-xl">
              Analytics
            </h1>
            <p className="text-sm text-[#5f6368]">
              Snapshot for <span className="font-mono">{today}</span>. Deeper
              charts and trends can build on this strip.
            </p>
          </div>
          <Badge variant="muted">Today</Badge>
        </div>

        {!stats ? (
          <div className="mt-6 h-24 animate-pulse rounded border border-[#e8eaed] bg-[#f8f9fa]" />
        ) : (
          <div className="mt-6 grid gap-px overflow-hidden rounded-sm border border-[#e8eaed] bg-[#e8eaed] sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Sales" value={formatINR(stats.salesTotal)} />
            <Stat label="Cash" value={formatINR(stats.cashTotal)} />
            <Stat label="Credit" value={formatINR(stats.creditTotal)} />
            <Stat label="Purchases" value={formatINR(stats.purchasesTotal)} />
          </div>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-[#dadce0] bg-[#fafafa] px-4 py-8 text-center text-sm text-[#5f6368] md:px-6">
        P&amp;L, period comparisons, and export live here as the product grows.
        Workspace remains the day-to-day operational home.
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3 text-left">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-lg tabular-nums text-[#202124]">
        {value}
      </p>
    </div>
  );
}
