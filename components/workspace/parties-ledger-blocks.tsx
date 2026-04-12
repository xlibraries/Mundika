"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { getLocalDateInputValue } from "@/lib/date/local-date";
import { createParty } from "@/modules/parties/actions";
import { deleteParty } from "@/modules/parties/delete";
import { updateParty } from "@/modules/parties/update";
import { createLedgerPayment } from "@/modules/ledger/actions";
import { deleteLedgerEntry } from "@/modules/ledger/delete";
import type { LedgerEntryRow, PartyRow, PaymentMode } from "@/lib/types/domain";
import { formatINR } from "@/lib/format/inr";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useAppStore } from "@/store/app-store";

const PAYMENT_MODE_OPTIONS: Array<{ value: PaymentMode; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "imps", label: "IMPS" },
  { value: "rtgs", label: "RTGS" },
  { value: "neft", label: "NEFT" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

function paymentModeLabel(mode: PaymentMode | null | undefined): string {
  if (!mode) return "—";
  return PAYMENT_MODE_OPTIONS.find((opt) => opt.value === mode)?.label ?? "Other";
}

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
      <h2 className="text-sm font-medium text-[var(--gs-text)]">Contacts</h2>
      <form
        onSubmit={onAdd}
        className="flex flex-col gap-2 rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface)] p-3 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1 space-y-1">
          <span className="text-[11px] text-[var(--gs-text-secondary)]">Name</span>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); if (addError) setAddError(null); }}
            placeholder="Contact name"
          />
        </label>
        <label className="min-w-0 flex-1 space-y-1 sm:max-w-[200px]">
          <span className="text-[11px] text-[var(--gs-text-secondary)]">Phone</span>
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
        <p role="alert" aria-live="polite" className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]">
          {addError}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface-plain)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--gs-border)] bg-[var(--gs-surface)] text-[11px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Phone</th>
              <th className="w-36 px-3 py-2 text-center"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--gs-grid)]">
            {rows.map((p) =>
              editingId === p.id ? (
                <tr key={p.id} className="bg-[var(--gs-selection)]">
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
                      <button type="button" onClick={() => void saveEdit(p.id)} className="text-xs font-medium text-[var(--gs-primary)] hover:underline">Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-xs text-[var(--gs-text-secondary)] hover:underline">Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="hover:bg-[var(--gs-surface)]">
                  <td className="px-3 py-2 font-medium text-[var(--gs-text)]">{p.name}</td>
                  <td className="px-3 py-2 text-right text-[var(--gs-text-secondary)]">
                    {p.phone ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-3">
                      <button
                        type="button"
                        aria-label={`Edit contact ${p.name}`}
                        className="text-xs text-[var(--gs-primary)] hover:underline"
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove contact ${p.name}`}
                        className="text-xs text-[var(--gs-text-secondary)] hover:text-[var(--gs-danger)]"
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
          <p className="px-3 py-6 text-center text-sm text-[var(--gs-text-secondary)]">
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
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [partyId, setPartyId] = useState("");
  const [entryDate, setEntryDate] = useState(() => getLocalDateInputValue());
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    const [ledgerEntries, partyRows] = await Promise.all([
      db.ledger_entries.where("user_id").equals(userId).toArray(),
      db.parties.where("user_id").equals(userId).toArray(),
    ]);
    ledgerEntries.sort((a, b) =>
      a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0
    );
    partyRows.sort((a, b) => a.name.localeCompare(b.name));
    setRows(ledgerEntries);
    setParties(partyRows);
    setPartyId((prev) => prev || partyRows[0]?.id || "");
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

  async function onRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!partyId) {
      setSaveError("Select a contact");
      return;
    }
    const numericAmount = Number(amount);
    if (!(numericAmount > 0) || Number.isNaN(numericAmount)) {
      setSaveError("Enter an amount greater than 0");
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      await createLedgerPayment(userId, {
        party_id: partyId,
        entry_date: entryDate,
        amount: numericAmount,
        payment_mode: paymentMode,
        payment_reference: paymentReference || null,
        note: note || null,
      });
      setAmount("");
      setPaymentReference("");
      setNote("");
      await load();
      onChanged?.();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not record payment"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-[var(--gs-text)]">Ledger</h2>
      <form
        onSubmit={onRecordPayment}
        className="grid gap-2 rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface)] p-3 md:grid-cols-6"
      >
        <label className="space-y-1 md:col-span-2">
          <span className="text-[11px] text-[var(--gs-text-secondary)]">Contact</span>
          <Select
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              if (saveError) setSaveError(null);
            }}
          >
            <option value="">Select contact</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-[var(--gs-text-secondary)]">Date</span>
          <Input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-[var(--gs-text-secondary)]">Amount</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (saveError) setSaveError(null);
            }}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-[var(--gs-text-secondary)]">Medium</span>
          <Select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          >
            {PAYMENT_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-[var(--gs-text-secondary)]">Transaction ID</span>
          <Input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="space-y-1 md:col-span-5">
          <span className="text-[11px] text-[var(--gs-text-secondary)]">Note</span>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <div className="flex items-end md:col-span-1">
          <Button type="submit" size="sm" disabled={isSaving} className="w-full">
            {isSaving ? "Saving…" : "Record payment"}
          </Button>
        </div>
        {saveError ? (
          <p
            role="alert"
            aria-live="polite"
            className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)] md:col-span-6"
          >
            {saveError}
          </p>
        ) : null}
      </form>
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface-plain)]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--gs-border)] bg-[var(--gs-surface)] text-[11px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Medium</th>
              <th className="px-3 py-2">Transaction ID</th>
              <th className="px-3 py-2 text-right" title="Amount added to or removed from the party's outstanding balance">Balance change (₹)</th>
              <th className="w-16 px-3 py-2 text-center"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--gs-grid)]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[var(--gs-surface)]">
                <td className="px-3 py-2 font-mono text-xs text-[var(--gs-text-secondary)]">
                  {r.entry_date}
                </td>
                <td className="px-3 py-2 capitalize text-[var(--gs-text)]">
                  {r.entry_type}
                </td>
                <td className="px-3 py-2 text-[var(--gs-text)]">
                  {r.party_name_snapshot ?? "—"}
                </td>
                <td className="px-3 py-2 text-[var(--gs-text-secondary)]">
                  {r.entry_type === "payment" ? paymentModeLabel(r.payment_mode) : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--gs-text-secondary)]">
                  {r.entry_type === "payment" ? r.payment_reference ?? "—" : "—"}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    r.balance_delta >= 0
                      ? "text-[var(--gs-success)]"
                      : "text-[var(--gs-text-secondary)]"
                  }`}
                >
                  {r.balance_delta >= 0 ? "+" : "-"}{formatINR(Math.abs(r.balance_delta))}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    aria-label={`Remove ledger entry for ${r.party_name_snapshot ?? "contact"} on ${r.entry_date}`}
                    className="text-xs text-[var(--gs-text-secondary)] hover:text-[var(--gs-danger)]"
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
          <p className="px-3 py-6 text-center text-sm text-[var(--gs-text-secondary)]">
            No ledger entries yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
