"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { LedgerEntryRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";
import { PageHeader } from "@/components/layout/page-header";

export default function LedgerPage() {
  const { userId, loading } = useUserId();
  const [rows, setRows] = useState<LedgerEntryRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    void db.ledger_entries
      .where("user_id")
      .equals(userId)
      .toArray()
      .then((list) => {
        list.sort((a, b) =>
          a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0
        );
        setRows(list);
      });
  }, [userId]);

  if (loading || !userId) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ledger"
        description="Sale entries from bills. Payments and purchases will appear here as you add them."
      />

      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Party</th>
              <th className="px-4 py-2.5 text-right">Δ Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">
                  {r.entry_date}
                </td>
                <td className="px-4 py-2.5 capitalize text-zinc-300">
                  {r.entry_type}
                </td>
                <td className="px-4 py-2.5 text-zinc-200">
                  {r.party_name_snapshot ?? "—"}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                    r.balance_delta >= 0 ? "text-emerald-400/90" : "text-zinc-400"
                  }`}
                >
                  {r.balance_delta >= 0 ? "+" : ""}
                  {r.balance_delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            No ledger rows yet. Create a bill to record a sale.
          </p>
        ) : null}
      </div>
    </div>
  );
}
