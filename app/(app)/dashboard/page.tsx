"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserId } from "@/hooks/use-user-id";
import { withBasePath } from "@/lib/auth/site-url";
import { TransactionForm } from "@/components/transaction/transaction-form";

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

  const searchParams = useSearchParams();
  const [txBootMode] = useState<"billing" | "purchase">(() =>
    searchParams.get("tx") === "purchase" ? "purchase" : "billing"
  );

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
      window.history.replaceState(null, "", withBasePath("/dashboard"));
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading || userId) return;
    router.replace("/login?next=%2Fdashboard");
  }, [loading, userId, router]);

  if (loading || !userId) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-col gap-5">
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
