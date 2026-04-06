"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { createBill } from "@/modules/billing/actions";
import type { BillType, ItemRow, PartyRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";

type Line = { item_id: string; qty: string; rate: string };

export default function BillingPage() {
  const { userId, loading } = useUserId();
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);

  const [partyId, setPartyId] = useState("");
  const [billDate, setBillDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [billType, setBillType] = useState<BillType>("cash");
  const [vehicle, setVehicle] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { item_id: "", qty: "1", rate: "" },
  ]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const firstLineRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!userId) return;
    void Promise.all([
      db.parties.where("user_id").equals(userId).toArray(),
      db.items.where("user_id").equals(userId).toArray(),
    ]).then(([p, i]) => {
      p.sort((a, b) => a.name.localeCompare(b.name));
      i.sort((a, b) => a.name.localeCompare(b.name));
      setParties(p);
      setItems(i);
    });
  }, [userId]);

  function addLine() {
    setLines((l) => [...l, { item_id: "", qty: "1", rate: "" }]);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !partyId) return;
    setErr(null);
    setMsg(null);

    const party = parties.find((p) => p.id === partyId);
    if (!party) {
      setErr("Select a party");
      return;
    }

    const parsed = lines
      .filter((l) => l.item_id)
      .map((l) => ({
        item_id: l.item_id,
        qty: Number(l.qty),
        rate: Number(l.rate),
      }));

    if (parsed.some((l) => l.qty <= 0 || l.rate < 0 || Number.isNaN(l.qty))) {
      setErr("Check quantities and rates");
      return;
    }

    try {
      const { bill } = await createBill(userId, {
        party_id: partyId,
        party_name_snapshot: party.name,
        bill_date: billDate,
        bill_type: billType,
        vehicle_info: vehicle || null,
        lines: parsed,
      });
      setMsg(`Bill saved #${bill.id.slice(0, 8)} · total ₹ ${bill.total}`);
      setLines([{ item_id: "", qty: "1", rate: "" }]);
      setVehicle("");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Could not save bill");
    }
  }

  if (loading || !userId) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-lg font-semibold">Billing</h1>
        <button
          type="button"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
          onClick={() => firstLineRef.current?.focus()}
        >
          Focus lines
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-zinc-500">
            Party
            <select
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              <option value="">—</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Date
            <input
              type="date"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-zinc-500">
            Type
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={billType}
              onChange={(e) => setBillType(e.target.value as BillType)}
            >
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Vehicle / owner
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500">Lines</p>
          {lines.map((line, i) => (
            <div
              key={i}
              className="grid grid-cols-12 gap-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <select
                ref={i === 0 ? firstLineRef : undefined}
                className="col-span-12 rounded-md border border-zinc-300 px-2 py-1.5 text-sm sm:col-span-5 dark:border-zinc-700"
                value={line.item_id}
                onChange={(e) => updateLine(i, { item_id: e.target.value })}
              >
                <option value="">Item</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
              <input
                className="col-span-4 rounded-md border border-zinc-300 px-2 py-1.5 text-sm tabular-nums sm:col-span-2 dark:border-zinc-700"
                inputMode="decimal"
                placeholder="Qty"
                value={line.qty}
                onChange={(e) => updateLine(i, { qty: e.target.value })}
              />
              <input
                className="col-span-8 rounded-md border border-zinc-300 px-2 py-1.5 text-sm tabular-nums sm:col-span-3 dark:border-zinc-700"
                inputMode="decimal"
                placeholder="Rate"
                value={line.rate}
                onChange={(e) => updateLine(i, { rate: e.target.value })}
              />
              <button
                type="button"
                className="col-span-12 text-left text-xs text-zinc-500 sm:col-span-2"
                onClick={() =>
                  setLines((prev) => prev.filter((_, j) => j !== i))
                }
                disabled={lines.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-sm text-zinc-700 underline dark:text-zinc-300"
            onClick={addLine}
          >
            + Line
          </button>
        </div>

        {err ? (
          <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : null}
        {msg ? (
          <p className="text-sm text-green-700 dark:text-green-400">{msg}</p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save bill (local)
        </button>
      </form>
    </div>
  );
}
