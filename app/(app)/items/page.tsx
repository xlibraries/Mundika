"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { createItem } from "@/modules/items/actions";
import type { ItemRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";

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
    setMsg("Saved locally · stock rows created (shop + godown)");
  }

  if (loading || !userId) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-lg font-semibold">Items</h1>

      <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-4">
        <input
          className="sm:col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          placeholder="Unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <input
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          placeholder="Default rate"
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
        <button
          type="submit"
          className="sm:col-span-4 rounded-md bg-zinc-900 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add item
        </button>
      </form>
      {msg ? <p className="text-sm text-green-700 dark:text-green-400">{msg}</p> : null}

      <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {rows.map((p) => (
          <li key={p.id} className="flex justify-between px-3 py-2 text-sm">
            <span>{p.name}</span>
            <span className="text-zinc-500 tabular-nums">
              {p.rate_default != null ? `₹ ${p.rate_default}` : "—"}
              {p.unit ? ` / ${p.unit}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
