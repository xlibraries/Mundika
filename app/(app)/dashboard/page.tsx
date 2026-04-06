"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { useUserId } from "@/hooks/use-user-id";
import { useAppStore } from "@/store/app-store";
import { useWorkspacePrefs } from "@/store/workspace-preferences";
import { Badge } from "@/components/ui/badge";
import { InventorySheet } from "@/components/workspace/inventory-sheet";
import {
  LedgerBlock,
  PartiesBlock,
} from "@/components/workspace/parties-ledger-blocks";
import { ViewMenu } from "@/components/workspace/view-menu";

export default function WorkspacePage() {
  const { userId, loading } = useUserId();
  const online = useAppStore((s) => s.online);
  const syncState = useAppStore((s) => s.syncState);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const showSectionParties = useWorkspacePrefs(
    (s) => s.showSectionParties ?? true
  );
  const showSectionLedger = useWorkspacePrefs(
    (s) => s.showSectionLedger ?? true
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getDashboardStats>
  > | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const bump = () => setRefreshToken((n) => n + 1);

  useEffect(() => {
    if (!userId) return;
    void getDashboardStats(userId, today).then(setStats);
  }, [userId, today, refreshToken]);

  if (loading || !userId) {
    return (
      <div className="space-y-6">
        <div className="h-16 animate-pulse rounded border border-[#dadce0] bg-[#f8f9fa]" />
        <div className="h-64 animate-pulse rounded border border-[#dadce0] bg-[#f8f9fa]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-[#dadce0] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-medium tracking-tight text-[#202124]">
            Workspace
          </h1>
          <p className="max-w-xl text-sm text-[#5f6368]">
            Sheets-style grid below · Today: {today}. Local-first, sync when
            online.
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
          <ViewMenu />
        </div>
      </header>

      {!stats ? (
        <div className="h-24 animate-pulse rounded border border-[#dadce0] bg-[#f8f9fa]" />
      ) : (
        <div className="grid gap-px overflow-hidden rounded-sm border border-[#dadce0] bg-[#dadce0] sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Sales" value={`₹ ${stats.salesTotal.toFixed(2)}`} />
          <Kpi label="Cash" value={`₹ ${stats.cashTotal.toFixed(2)}`} />
          <Kpi label="Credit" value={`₹ ${stats.creditTotal.toFixed(2)}`} />
          <Kpi label="Purchases" value={`₹ ${stats.purchasesTotal.toFixed(2)}`} />
        </div>
      )}

      {stats && stats.lowStock.length > 0 ? (
        <p className="rounded border border-[#fde293] bg-[#fef7e0] px-3 py-2 text-sm text-[#b06000]">
          Low stock:{" "}
          {stats.lowStock.map((s) => `${s.name} (${s.qty})`).join(" · ")}
        </p>
      ) : null}

      <InventorySheet
        userId={userId}
        refreshToken={refreshToken}
        onChanged={bump}
      />

      {showSectionParties ? (
        <PartiesBlock
          userId={userId}
          refreshToken={refreshToken}
          onChanged={bump}
        />
      ) : null}

      {showSectionLedger ? (
        <LedgerBlock
          userId={userId}
          refreshToken={refreshToken}
          onChanged={bump}
        />
      ) : null}

      <p className="text-center text-[11px] text-[#5f6368]">
        Billing: sidebar. Toggle nav &amp; blocks via{" "}
        <span className="font-medium text-[#202124]">View</span>.
      </p>
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
