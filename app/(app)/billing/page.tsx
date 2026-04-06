"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { createBill } from "@/modules/billing/actions";
import type { BillType, ItemRow, PartyRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

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
      setMsg(`Bill saved · ${bill.id.slice(0, 8)} · ₹ ${bill.total.toFixed(2)}`);
      setLines([{ item_id: "", qty: "1", rate: "" }]);
      setVehicle("");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Could not save bill");
    }
  }

  if (loading || !userId) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="New bill"
        description="Saves instantly on this device. Stock is reduced from shop first, then godown."
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-zinc-400"
            onClick={() => firstLineRef.current?.focus()}
          >
            Focus first line
          </Button>
        }
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Party</span>
            <Select
              required
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              <option value="">Select…</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Date</span>
            <Input
              type="date"
              required
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Payment</span>
            <Select
              value={billType}
              onChange={(e) => setBillType(e.target.value as BillType)}
            >
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">
              Vehicle / owner
            </span>
            <Input
              placeholder="Optional"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Lines
          </p>
          {lines.map((line, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-xl border border-white/[0.06] bg-zinc-900/20 p-3 sm:grid-cols-12 sm:items-end"
            >
              <label className="space-y-1.5 sm:col-span-5">
                <span className="text-[11px] text-zinc-600">Item</span>
                <Select
                  ref={i === 0 ? firstLineRef : undefined}
                  value={line.item_id}
                  onChange={(e) => updateLine(i, { item_id: e.target.value })}
                >
                  <option value="">Choose item…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] text-zinc-600">Qty</span>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={line.qty}
                  onChange={(e) => updateLine(i, { qty: e.target.value })}
                  className="font-mono tabular-nums"
                />
              </label>
              <label className="space-y-1.5 sm:col-span-3">
                <span className="text-[11px] text-zinc-600">Rate</span>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={line.rate}
                  onChange={(e) => updateLine(i, { rate: e.target.value })}
                  className="font-mono tabular-nums"
                />
              </label>
              <div className="flex sm:col-span-2 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500"
                  disabled={lines.length <= 1}
                  onClick={() =>
                    setLines((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            + Add line
          </Button>
        </div>

        {err ? (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {err}
          </p>
        ) : null}
        {msg ? (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {msg}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Save bill
        </Button>
      </form>
    </div>
  );
}
