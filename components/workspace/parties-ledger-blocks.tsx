"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { createParty } from "@/modules/parties/actions";
import { deleteParty } from "@/modules/parties/delete";
import { deleteLedgerEntry } from "@/modules/ledger/delete";
import type { LedgerEntryRow, PartyRow } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PartiesBlock({
  userId,
  refreshToken,
  onChanged,
}: {
  userId: string;
  refreshToken: number;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<PartyRow[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    const list = await db.parties.where("user_id").equals(userId).toArray();
    list.sort((a, b) => a.name.localeCompare(b.name));
    setRows(list);
  }, [userId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load, refreshToken]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createParty(userId, { name, phone: phone || null });
    setName("");
    setPhone("");
    await load();
    onChanged?.();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this party?")) return;
    try {
      await deleteParty(userId, id);
      await load();
      onChanged?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-400">Parties</h2>
      <form
        onSubmit={onAdd}
        className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-zinc-900/20 p-3 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1 space-y-1">
          <span className="text-[11px] text-zinc-600">Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer"
          />
        </label>
        <label className="min-w-0 flex-1 space-y-1 sm:max-w-[200px]">
          <span className="text-[11px] text-zinc-600">Phone</span>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <Button type="submit" size="sm">
          Add
        </Button>
      </form>
      <div className="overflow-hidden rounded-lg border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Phone</th>
              <th className="w-20 px-3 py-2 text-center"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-2 font-medium text-zinc-200">{p.name}</td>
                <td className="px-3 py-2 text-right text-zinc-500">
                  {p.phone ?? "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    className="text-xs text-zinc-500 hover:text-red-400"
                    onClick={() => void onDelete(p.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-zinc-500">
            No parties yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function LedgerBlock({
  userId,
  refreshToken,
  onChanged,
}: {
  userId: string;
  refreshToken: number;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<LedgerEntryRow[]>([]);

  const load = useCallback(async () => {
    const list = await db.ledger_entries.where("user_id").equals(userId).toArray();
    list.sort((a, b) =>
      a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0
    );
    setRows(list);
  }, [userId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load, refreshToken]);

  async function onDelete(id: string) {
    if (!window.confirm("Remove this ledger row?")) return;
    try {
      await deleteLedgerEntry(userId, id);
      await load();
      onChanged?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-400">Ledger</h2>
      <div className="overflow-x-auto overflow-hidden rounded-lg border border-white/[0.06]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Party</th>
              <th className="px-3 py-2 text-right">Δ</th>
              <th className="w-16 px-3 py-2 text-center"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                  {r.entry_date}
                </td>
                <td className="px-3 py-2 capitalize text-zinc-300">
                  {r.entry_type}
                </td>
                <td className="px-3 py-2 text-zinc-200">
                  {r.party_name_snapshot ?? "—"}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    r.balance_delta >= 0 ? "text-emerald-400/90" : "text-zinc-400"
                  }`}
                >
                  {r.balance_delta >= 0 ? "+" : ""}
                  {r.balance_delta}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    className="text-xs text-zinc-500 hover:text-red-400"
                    onClick={() => void onDelete(r.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-zinc-500">
            No ledger entries yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
