"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { createParty } from "@/modules/parties/actions";
import type { PartyRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";

export default function PartiesPage() {
  const { userId, loading } = useUserId();
  const [rows, setRows] = useState<PartyRow[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void db.parties
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
    await createParty(userId, { name, phone: phone || null });
    setName("");
    setPhone("");
    const list = await db.parties.where("user_id").equals(userId).toArray();
    list.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    setRows(list);
    setMsg("Saved locally · will sync when online");
  }

  if (loading || !userId) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-lg font-semibold">Parties</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add
        </button>
      </form>
      {msg ? <p className="text-sm text-green-700 dark:text-green-400">{msg}</p> : null}

      <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {rows.map((p) => (
          <li key={p.id} className="flex justify-between px-3 py-2 text-sm">
            <span>{p.name}</span>
            <span className="text-zinc-500">{p.phone ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
