"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { createParty } from "@/modules/parties/actions";
import type { PartyRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    setMsg("Saved on this device. Sync queues when you are online.");
  }

  if (loading || !userId) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Parties"
        description="Customers you bill. Stored locally first, then pushed to your account."
      />

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-zinc-900/25 p-4 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="text-xs font-medium text-zinc-500">Name</span>
          <Input
            placeholder="e.g. Sharma Store"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
          <span className="text-xs font-medium text-zinc-500">Phone</span>
          <Input
            placeholder="Optional"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <Button type="submit" className="sm:shrink-0">
          Add party
        </Button>
      </form>

      {msg ? (
        <p className="text-sm text-emerald-400/90">{msg}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5 text-right">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 font-medium text-zinc-200">
                  {p.name}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-500">
                  {p.phone ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            No parties yet. Add one above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
