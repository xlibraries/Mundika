"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { createParty } from "@/modules/parties/actions";
import { deleteParty } from "@/modules/parties/delete";
import { updateParty } from "@/modules/parties/update";
import { deleteLedgerEntry } from "@/modules/ledger/delete";
import type { LedgerEntryRow, PartyRow } from "@/lib/types/domain";
import { formatINR } from "@/lib/format/inr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/app-store";

export function PartiesBlock({
  userId,
  refreshToken,
  onChanged,
}: {
  userId: string;
  refreshToken: number;
  onChanged?: () => void;
}) {
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const [rows, setRows] = useState<PartyRow[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

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
  }, [load, refreshToken, lastSyncAt]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setAddError("Name is required");
      return;
    }
    setAddError(null);
    setIsAdding(true);
    try {
      await createParty(userId, { name, phone: phone || null });
      setName("");
      setPhone("");
      await load();
      onChanged?.();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add contact");
    } finally {
      setIsAdding(false);
    }
  }

  function startEdit(p: PartyRow) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPhone(p.phone ?? "");
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    try {
      await updateParty(userId, id, { name: editName, phone: editPhone || null });
      setEditingId(null);
      await load();
      onChanged?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not update contact");
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this contact?")) return;
    try {
      await deleteParty(userId, id);
      await load();
      onChanged?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete contact");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-[#2a382f]">Contacts</h2>
      <form
        onSubmit={onAdd}
        className="flex flex-col gap-2 rounded-sm border border-[#c5dccf] bg-[#f4f8f5] p-3 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1 space-y-1">
          <span className="text-[11px] text-[#5c6e62]">Name</span>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); if (addError) setAddError(null); }}
            placeholder="Contact name"
          />
        </label>
        <label className="min-w-0 flex-1 space-y-1 sm:max-w-[200px]">
          <span className="text-[11px] text-[#5c6e62]">Phone</span>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <Button type="submit" size="sm" disabled={isAdding}>
          {isAdding ? "Adding…" : "Add Contact"}
        </Button>
      </form>
      {addError ? (
        <p role="alert" aria-live="polite" className="rounded border border-[#f9dedc] bg-[#fce8e6] px-3 py-2 text-sm text-[#c5221f]">
          {addError}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-sm border border-[#c5dccf] bg-[#faf9f5]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#c5dccf] bg-[#f4f8f5] text-[11px] font-medium uppercase tracking-wide text-[#5c6e62]">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Phone</th>
              <th className="w-36 px-3 py-2 text-center"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dce8df]">
            {rows.map((p) =>
              editingId === p.id ? (
                <tr key={p.id} className="bg-[#dff0e5]">
                  <td className="px-2 py-1.5">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveEdit(p.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Phone"
                      className="h-7 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveEdit(p.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex justify-center gap-2">
                      <button type="button" onClick={() => void saveEdit(p.id)} className="text-xs font-medium text-[#6b9b7a] hover:underline">Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-xs text-[#5c6e62] hover:underline">Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="hover:bg-[#f4f8f5]">
                  <td className="px-3 py-2 font-medium text-[#2a382f]">{p.name}</td>
                  <td className="px-3 py-2 text-right text-[#5c6e62]">
                    {p.phone ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-3">
                      <button
                        type="button"
                        aria-label={`Edit contact ${p.name}`}
                        className="text-xs text-[#6b9b7a] hover:underline"
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove contact ${p.name}`}
                        className="text-xs text-[#5c6e62] hover:text-[#c5221f]"
                        onClick={() => void onDelete(p.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[#5c6e62]">
            No contacts yet.
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
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
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
  }, [load, refreshToken, lastSyncAt]);

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
      <h2 className="text-sm font-medium text-[#2a382f]">Ledger</h2>
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-[#c5dccf] bg-[#faf9f5]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#c5dccf] bg-[#f4f8f5] text-[11px] font-medium uppercase tracking-wide text-[#5c6e62]">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2 text-right" title="Amount added to or removed from the party's outstanding balance">Balance change (₹)</th>
              <th className="w-16 px-3 py-2 text-center"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dce8df]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[#f4f8f5]">
                <td className="px-3 py-2 font-mono text-xs text-[#5c6e62]">
                  {r.entry_date}
                </td>
                <td className="px-3 py-2 capitalize text-[#2a382f]">
                  {r.entry_type}
                </td>
                <td className="px-3 py-2 text-[#2a382f]">
                  {r.party_name_snapshot ?? "—"}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    r.balance_delta >= 0 ? "text-[#3d6b4f]" : "text-[#5c6e62]"
                  }`}
                >
                  {r.balance_delta >= 0 ? "+" : "-"}{formatINR(Math.abs(r.balance_delta))}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    aria-label={`Remove ledger entry for ${r.party_name_snapshot ?? "contact"} on ${r.entry_date}`}
                    className="text-xs text-[#5c6e62] hover:text-[#c5221f]"
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
          <p className="px-3 py-6 text-center text-sm text-[#5c6e62]">
            No ledger entries yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
