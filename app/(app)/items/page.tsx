"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { createItem } from "@/modules/items/actions";
import type { ItemRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ItemsPage() {
  const { userId, loading } = useUserId();
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [rate, setRate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void db.items
      .where("user_id")
      .equals(userId)
      .toArray()
      .then((list) => {
        list.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
        setRows(list);
      });
  }, [userId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !name.trim()) return;
    setMsg(null);
    await createItem(userId, {
      name,
      unit: unit || null,
      rate_default: rate === "" ? null : Number(rate),
    });
    setName("");
    setUnit("");
    setRate("");
    const list = await db.items.where("user_id").equals(userId).toArray();
    list.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    setRows(list);
    setMsg("Item saved. Shop and godown rows created at zero qty.");
  }

  if (loading || !userId) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Items"
        description="Products you sell. Default rate pre-fills billing; you can change it per bill."
      />

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-xl border border-white/[0.06] bg-zinc-900/25 p-4 sm:grid-cols-12"
      >
        <label className="space-y-1.5 sm:col-span-5">
          <span className="text-xs font-medium text-zinc-500">Name</span>
          <Input
            placeholder="e.g. Wheat 50kg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1.5 sm:col-span-3">
          <span className="text-xs font-medium text-zinc-500">Unit</span>
          <Input
            placeholder="bag, kg…"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-zinc-500">Default rate</span>
          <Input
            inputMode="decimal"
            placeholder="—"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" className="w-full">
            Add
          </Button>
        </div>
      </form>

      {msg ? (
        <p className="text-sm text-emerald-400/90">{msg}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2.5">Item</th>
              <th className="px-4 py-2.5 text-right">Default</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 font-medium text-zinc-200">
                  {p.name}
                  {p.unit ? (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      / {p.unit}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-zinc-400">
                  {p.rate_default != null ? `₹ ${p.rate_default}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            No items yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
