"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { LedgerEntryRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";

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
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Ledger</h1>
      <p className="text-sm text-zinc-500">
        Sales from bills appear here. Payments and purchases — coming next.
      </p>
      <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
            <span>
              {r.entry_date} · {r.entry_type} · {r.party_name_snapshot ?? "—"}
            </span>
            <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
              {r.balance_delta >= 0 ? "+" : ""}
              {r.balance_delta}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
