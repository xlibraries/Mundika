"use client";

import type { ReactNode } from "react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { getLocalDateInputValue } from "@/lib/date/local-date";
import { createParty } from "@/modules/parties/actions";
import { deleteParty } from "@/modules/parties/delete";
import { updateParty } from "@/modules/parties/update";
import { createLedgerPayment } from "@/modules/ledger/actions";
import { deleteLedgerEntry } from "@/modules/ledger/delete";
import type { LedgerEntryRow, PartyRow, PaymentMode } from "@/lib/types/domain";
import {
  loadBillPrintPayload,
  loadPurchasePrintPayload,
  type TxDocPreview,
} from "@/lib/billing/doc-preview";
import { PrintableDocModal } from "@/components/billing/printable-doc-modal";
import { formatINR } from "@/lib/format/inr";
import { cn } from "@/lib/cn";
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

function compareLedgerAsc(a: LedgerEntryRow, b: LedgerEntryRow): number {
  if (a.entry_date !== b.entry_date) {
    return a.entry_date < b.entry_date ? -1 : 1;
  }
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

type LedgerDisplayGroup =
  | { kind: "document"; parent: LedgerEntryRow; payments: LedgerEntryRow[] }
  | { kind: "payment-only"; payment: LedgerEntryRow };

/**
 * Payments are shown under the most recent preceding sale or purchase for the
 * same contact (chronological). No explicit ref on payment rows yet — this is display-only.
 */
function buildLedgerDisplayGroups(rows: LedgerEntryRow[]): LedgerDisplayGroup[] {
  const sorted = [...rows].sort(compareLedgerAsc);
  const groups: LedgerDisplayGroup[] = [];
  const lastDocGroupByParty = new Map<string, Extract<LedgerDisplayGroup, { kind: "document" }>>();

  for (const r of sorted) {
    if (r.entry_type === "sale" || r.entry_type === "purchase") {
      const g: Extract<LedgerDisplayGroup, { kind: "document" }> = {
        kind: "document",
        parent: r,
        payments: [],
      };
      groups.push(g);
      lastDocGroupByParty.set(r.party_id, g);
    } else if (r.entry_type === "payment") {
      const doc = lastDocGroupByParty.get(r.party_id);
      if (doc) {
        doc.payments.push(r);
      } else {
        groups.push({ kind: "payment-only", payment: r });
      }
    }
  }

  for (const g of groups) {
    if (g.kind === "document" && g.payments.length > 0) {
      g.payments.sort(compareLedgerAsc);
    }
  }

  return groups.slice().reverse();
}

function saleDisplayAmount(
  row: LedgerEntryRow,
  billTotalById: Record<string, number>
): number {
  if (row.entry_type !== "sale") return 0;
  if (row.ref_bill_id != null && billTotalById[row.ref_bill_id] != null) {
    return billTotalById[row.ref_bill_id];
  }
  return Math.round(Math.abs(row.balance_delta) * 100) / 100;
}

function purchaseDisplayAmount(
  row: LedgerEntryRow,
  purchaseTotalById: Record<string, number>
): number {
  if (row.entry_type !== "purchase") return 0;
  if (
    row.ref_purchase_id != null &&
    purchaseTotalById[row.ref_purchase_id] != null
  ) {
    return purchaseTotalById[row.ref_purchase_id];
  }
  return Math.round(Math.abs(row.balance_delta) * 100) / 100;
}

function paymentDisplayAmount(row: LedgerEntryRow): number {
  return Math.round(Math.abs(row.balance_delta) * 100) / 100;
}

/** Payment-only row: supplier khata vs customer receipt (no ref on row). */
function classifyPaymentOnlySide(
  payment: LedgerEntryRow,
  contextRows: LedgerEntryRow[]
): "expense" | "income" {
  const others = contextRows.filter((r) => r.id !== payment.id);
  const hasSale = others.some((r) => r.entry_type === "sale");
  const hasPurchase = others.some((r) => r.entry_type === "purchase");
  if (hasPurchase && !hasSale) return "expense";
  if (hasSale && !hasPurchase) return "income";
  const priorDoc = others
    .filter(
      (r) =>
        (r.entry_type === "sale" || r.entry_type === "purchase") &&
        (r.entry_date < payment.entry_date ||
          (r.entry_date === payment.entry_date &&
            r.created_at < payment.created_at))
    )
    .sort(compareLedgerAsc);
  const last = priorDoc[priorDoc.length - 1];
  if (last?.entry_type === "purchase") return "expense";
  return "income";
}

function ledgerGroupsForNotebookView(
  filteredRows: LedgerEntryRow[],
  entryType: "" | "sale" | "purchase" | "payment"
): LedgerDisplayGroup[] {
  if (entryType === "payment") {
    return [...filteredRows]
      .sort(compareLedgerAsc)
      .reverse()
      .map((r) => ({ kind: "payment-only" as const, payment: r }));
  }
  return buildLedgerDisplayGroups(filteredRows);
}

function partitionNotebookGroups(
  groups: LedgerDisplayGroup[],
  contextRows: LedgerEntryRow[]
): { expense: LedgerDisplayGroup[]; income: LedgerDisplayGroup[] } {
  const expense: LedgerDisplayGroup[] = [];
  const income: LedgerDisplayGroup[] = [];
  for (const g of groups) {
    if (g.kind === "payment-only") {
      const side = classifyPaymentOnlySide(g.payment, contextRows);
      if (side === "expense") expense.push(g);
      else income.push(g);
      continue;
    }
    if (g.parent.entry_type === "purchase") expense.push(g);
    else income.push(g);
  }
  return { expense, income };
}

function sumNotebookGroups(
  groups: LedgerDisplayGroup[],
  billTotalById: Record<string, number>,
  purchaseTotalById: Record<string, number>
): number {
  let sum = 0;
  for (const g of groups) {
    if (g.kind === "payment-only") {
      sum += paymentDisplayAmount(g.payment);
      continue;
    }
    if (g.parent.entry_type === "sale") {
      sum += saleDisplayAmount(g.parent, billTotalById);
      for (const p of g.payments) sum += paymentDisplayAmount(p);
    } else {
      sum += purchaseDisplayAmount(g.parent, purchaseTotalById);
      for (const p of g.payments) sum += paymentDisplayAmount(p);
    }
  }
  return sum;
}

type LedgerRowVisual = "parent" | "child" | "standalone";

function LedgerEntryTr({
  row,
  visual,
  ledgerRowBusyId,
  onDelete,
  onPreview,
  expandToggle,
}: {
  row: LedgerEntryRow;
  visual: LedgerRowVisual;
  ledgerRowBusyId: string | null;
  onDelete: (id: string) => void;
  onPreview: (r: LedgerEntryRow) => void | Promise<void>;
  expandToggle?: { expanded: boolean; onToggle: () => void; childCount: number };
}) {
  const isChild = visual === "child";
  const showPreviewButton =
    !isChild &&
    ((row.entry_type === "sale" && row.ref_bill_id) ||
      (row.entry_type === "purchase" && row.ref_purchase_id) ||
      row.entry_type === "payment");
  const rowExpandable = Boolean(expandToggle && expandToggle.childCount > 0);
  const isSaleOrPurchase =
    row.entry_type === "sale" || row.entry_type === "purchase";
  const showDashBalance = isSaleOrPurchase && row.balance_delta === 0;

  return (
    <tr
      className={
        isChild
          ? "hover:bg-[var(--gs-surface)] bg-[var(--gs-surface-plain)]/60"
          : rowExpandable
            ? "cursor-pointer hover:bg-[var(--gs-surface)]"
            : "hover:bg-[var(--gs-surface)]"
      }
      tabIndex={rowExpandable ? 0 : undefined}
      aria-expanded={rowExpandable ? expandToggle!.expanded : undefined}
      onClick={
        rowExpandable
          ? () => {
              expandToggle!.onToggle();
            }
          : undefined
      }
      onKeyDown={
        rowExpandable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                expandToggle!.onToggle();
              }
            }
          : undefined
      }
    >
      <td
        className={`px-3 py-2 font-mono text-xs text-[var(--gs-text-secondary)] ${isChild ? "border-l-2 border-l-[var(--gs-primary)]/25 pl-5" : ""}`}
      >
        {isChild ? (
          row.entry_date
        ) : expandToggle && expandToggle.childCount > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[10px] font-semibold text-[var(--gs-text-secondary)]" aria-hidden>
              {expandToggle.expanded ? "▼" : "▶"}
            </span>
            <span>{row.entry_date}</span>
            <span className="font-sans text-[10px] font-semibold text-[var(--gs-text-secondary)]">
              ↳{expandToggle.childCount}
            </span>
          </div>
        ) : (
          row.entry_date
        )}
      </td>
      <td
        className={`px-3 py-2 text-[var(--gs-text)] ${isChild ? "text-[var(--gs-text-secondary)]" : "capitalize"}`}
      >
        {isChild ? "↳ Payment" : row.entry_type}
      </td>
      <td className={`px-3 py-2 text-[var(--gs-text)] ${isChild ? "text-[var(--gs-text-secondary)]" : ""}`}>
        {row.party_name_snapshot ?? "—"}
      </td>
      <td className="px-3 py-2 text-[var(--gs-text-secondary)]">
        {row.entry_type === "payment" ? paymentModeLabel(row.payment_mode) : "—"}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-[var(--gs-text-secondary)]">
        {row.entry_type === "payment" ? row.payment_reference ?? "—" : "—"}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono tabular-nums ${
          showDashBalance
            ? "text-[var(--gs-text-secondary)]"
            : row.balance_delta >= 0
              ? "text-[var(--gs-success)]"
              : "text-[var(--gs-text-secondary)]"
        }`}
        title={
          showDashBalance
            ? "No change to running balance (cash or paid on bill)."
            : undefined
        }
      >
        {showDashBalance ? (
          "—"
        ) : (
          <>
            {row.balance_delta >= 0 ? "+" : "-"}
            {formatINR(Math.abs(row.balance_delta))}
          </>
        )}
      </td>
      <td
        className="px-2 py-2 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          {showPreviewButton ? (
            <>
              <button
                type="button"
                aria-label={
                  row.entry_type === "payment"
                    ? `Preview payment receipt for ${row.entry_date}`
                    : row.entry_type === "sale"
                      ? `Preview bill for ledger entry on ${row.entry_date}`
                      : `Preview purchase for ledger entry on ${row.entry_date}`
                }
                disabled={ledgerRowBusyId === row.id}
                className="text-xs font-medium text-[var(--gs-primary)] hover:underline disabled:opacity-40"
                onClick={() => void onPreview(row)}
              >
                {ledgerRowBusyId === row.id ? "…" : "Preview"}
              </button>
              <span className="select-none text-[var(--gs-border)]" aria-hidden>
                ·
              </span>
            </>
          ) : null}
          <button
            type="button"
            aria-label={`Remove ledger entry for ${row.party_name_snapshot ?? "contact"} on ${row.entry_date}`}
            className="text-xs text-[var(--gs-text-secondary)] hover:text-[var(--gs-danger)]"
            onClick={() => void onDelete(row.id)}
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}

function LedgerFiltersMobile({
  localFilters,
  onLocalFiltersChange,
  parties,
}: {
  localFilters: {
    fromDate: string;
    toDate: string;
    partyId: string;
    entryType: "" | "sale" | "purchase" | "payment";
  };
  onLocalFiltersChange: (next: {
    fromDate: string;
    toDate: string;
    partyId: string;
    entryType: "" | "sale" | "purchase" | "payment";
  }) => void;
  parties: PartyRow[];
}) {
  const hasActiveFilters = Boolean(
    localFilters.fromDate ||
      localFilters.toDate ||
      localFilters.partyId ||
      localFilters.entryType
  );

  return (
    <div className="space-y-2.5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gs-text-secondary)]">
        Filters
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0 space-y-1">
          <span className="text-[10px] text-[var(--gs-text-secondary)]">From</span>
          <Input
            type="date"
            value={localFilters.fromDate}
            onChange={(e) =>
              onLocalFiltersChange({
                ...localFilters,
                fromDate: e.target.value,
              })
            }
            className="h-9 min-w-0 text-xs"
          />
        </label>
        <label className="min-w-0 space-y-1">
          <span className="text-[10px] text-[var(--gs-text-secondary)]">To</span>
          <Input
            type="date"
            value={localFilters.toDate}
            onChange={(e) =>
              onLocalFiltersChange({
                ...localFilters,
                toDate: e.target.value,
              })
            }
            className="h-9 min-w-0 text-xs"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] text-[var(--gs-text-secondary)]">Entry type</span>
        <Select
          value={localFilters.entryType}
          onChange={(e) =>
            onLocalFiltersChange({
              ...localFilters,
              entryType: e.target.value as "" | "sale" | "purchase" | "payment",
            })
          }
          className="h-9 text-xs"
        >
          <option value="">All</option>
          <option value="sale">Sale</option>
          <option value="purchase">Purchase</option>
          <option value="payment">Payment</option>
        </Select>
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] text-[var(--gs-text-secondary)]">Contact</span>
        <Select
          value={localFilters.partyId}
          onChange={(e) =>
            onLocalFiltersChange({
              ...localFilters,
              partyId: e.target.value,
            })
          }
          className="h-9 text-xs"
        >
          <option value="">All contacts</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </label>
      {hasActiveFilters ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() =>
            onLocalFiltersChange({
              fromDate: "",
              toDate: "",
              partyId: "",
              entryType: "",
            })
          }
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function LedgerEntryMobileCard({
  row,
  visual,
  ledgerRowBusyId,
  onDelete,
  onPreview,
  expandToggle,
}: {
  row: LedgerEntryRow;
  visual: LedgerRowVisual;
  ledgerRowBusyId: string | null;
  onDelete: (id: string) => void;
  onPreview: (r: LedgerEntryRow) => void | Promise<void>;
  expandToggle?: { expanded: boolean; onToggle: () => void; childCount: number };
}) {
  const isChild = visual === "child";
  const showPreviewButton =
    !isChild &&
    ((row.entry_type === "sale" && row.ref_bill_id) ||
      (row.entry_type === "purchase" && row.ref_purchase_id) ||
      row.entry_type === "payment");
  const rowExpandable = Boolean(expandToggle && expandToggle.childCount > 0);
  const isSaleOrPurchase =
    row.entry_type === "sale" || row.entry_type === "purchase";
  const showDashBalance = isSaleOrPurchase && row.balance_delta === 0;

  return (
    <article
      className={cn(
        "rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] p-3 shadow-sm",
        isChild && "ml-1.5 border-l-[3px] border-l-[var(--gs-primary)]/35 pl-3",
        rowExpandable && "cursor-pointer transition-colors hover:bg-[var(--gs-surface)]"
      )}
      tabIndex={rowExpandable ? 0 : undefined}
      aria-expanded={rowExpandable ? expandToggle!.expanded : undefined}
      onClick={
        rowExpandable
          ? () => {
              expandToggle!.onToggle();
            }
          : undefined
      }
      onKeyDown={
        rowExpandable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                expandToggle!.onToggle();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isChild ? (
            <p className="font-mono text-xs text-[var(--gs-text-secondary)]">
              {row.entry_date}
            </p>
          ) : expandToggle && expandToggle.childCount > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className="text-[10px] font-semibold text-[var(--gs-text-secondary)]"
                aria-hidden
              >
                {expandToggle.expanded ? "▼" : "▶"}
              </span>
              <span className="font-mono text-xs text-[var(--gs-text-secondary)]">
                {row.entry_date}
              </span>
              <span className="font-sans text-[10px] font-semibold text-[var(--gs-text-secondary)]">
                ↳{expandToggle.childCount} payment
                {expandToggle.childCount === 1 ? "" : "s"}
              </span>
            </div>
          ) : (
            <p className="font-mono text-xs text-[var(--gs-text-secondary)]">
              {row.entry_date}
            </p>
          )}
          <p
            className={cn(
              "mt-1 text-sm font-medium capitalize",
              isChild ? "text-[var(--gs-text-secondary)]" : "text-[var(--gs-text)]"
            )}
          >
            {isChild ? "↳ Payment" : row.entry_type}
          </p>
        </div>
        <div
          className={cn(
            "shrink-0 text-right font-mono text-sm tabular-nums",
            showDashBalance
              ? "text-[var(--gs-text-secondary)]"
              : row.balance_delta >= 0
                ? "text-[var(--gs-success)]"
                : "text-[var(--gs-text-secondary)]"
          )}
          title={
            showDashBalance
              ? "No change to running balance (cash or paid on bill)."
              : undefined
          }
        >
          {showDashBalance ? (
            "—"
          ) : (
            <>
              {row.balance_delta >= 0 ? "+" : "-"}
              {formatINR(Math.abs(row.balance_delta))}
            </>
          )}
        </div>
      </div>
      <p className="mt-2 truncate text-sm text-[var(--gs-text)]">
        {row.party_name_snapshot ?? "—"}
      </p>
      {row.entry_type === "payment" ? (
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
              Medium
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--gs-text)]">
              {paymentModeLabel(row.payment_mode)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
              Txn ID
            </dt>
            <dd className="mt-0.5 truncate font-mono text-[var(--gs-text)]">
              {row.payment_reference ?? "—"}
            </dd>
          </div>
        </dl>
      ) : null}
      <div
        className="mt-3 flex flex-wrap gap-2 border-t border-[var(--gs-border)]/70 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        {showPreviewButton ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={ledgerRowBusyId === row.id}
            className="min-h-9 flex-1 sm:flex-none"
            onClick={() => void onPreview(row)}
          >
            {ledgerRowBusyId === row.id ? "…" : "Preview"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="min-h-9 flex-1 border-[var(--gs-border)] text-[var(--gs-text-secondary)] hover:text-[var(--gs-danger)] sm:flex-none"
          onClick={() => void onDelete(row.id)}
        >
          Remove
        </Button>
      </div>
    </article>
  );
}

function ledgerEmptyMessage(rowsLen: number, filteredLen: number): ReactNode {
  if (rowsLen === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-[var(--gs-text-secondary)]">
        No ledger entries yet.
      </p>
    );
  }
  if (filteredLen === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-[var(--gs-text-secondary)]">
        No ledger rows match these filters.
      </p>
    );
  }
  return null;
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
  const [nameFilter, setNameFilter] = useState("");

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
            <tr className="border-b border-[var(--gs-grid)] bg-[var(--gs-surface)]/70">
              <th className="px-3 py-1.5">
                <Input
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="Filter by name"
                  className="h-7 text-xs"
                />
              </th>
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5 text-center">
                {nameFilter ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--gs-text-secondary)] hover:text-[var(--gs-text)]"
                    onClick={() => setNameFilter("")}
                  >
                    Clear
                  </button>
                ) : null}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--gs-grid)]">
            {rows
              .filter((p) =>
                nameFilter.trim()
                  ? p.name.toLowerCase().includes(nameFilter.trim().toLowerCase())
                  : true
              )
              .map((p) =>
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
        ) : rows.filter((p) =>
            nameFilter.trim()
              ? p.name.toLowerCase().includes(nameFilter.trim().toLowerCase())
              : true
          ).length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--gs-text-secondary)]">
            No contacts match this header filter.
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
  localFilters,
  onLocalFiltersChange,
  onApplyToOverview,
}: {
  userId: string;
  refreshToken: number;
  onChanged?: () => void;
  localFilters: {
    fromDate: string;
    toDate: string;
    partyId: string;
    entryType: "" | "sale" | "purchase" | "payment";
  };
  onLocalFiltersChange: (next: {
    fromDate: string;
    toDate: string;
    partyId: string;
    entryType: "" | "sale" | "purchase" | "payment";
  }) => void;
  onApplyToOverview?: (payload: {
    fromDate?: string;
    toDate?: string;
    partyId?: string;
  }) => void;
}) {
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const [rows, setRows] = useState<LedgerEntryRow[]>([]);
  /** Bill totals keyed by id — used so cash sales count toward Total sales (ledger balance_delta is 0). */
  const [billTotalById, setBillTotalById] = useState<Record<string, number>>({});
  /** Purchase totals for notebook / purchase lines (cash credit uses balance 0 on row). */
  const [purchaseTotalById, setPurchaseTotalById] = useState<
    Record<string, number>
  >({});
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [paymentPartyId, setPaymentPartyId] = useState("");
  const [entryDate, setEntryDate] = useState(() => getLocalDateInputValue());
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [docPreview, setDocPreview] = useState<TxDocPreview | null>(null);
  const [ledgerRowBusyId, setLedgerRowBusyId] = useState<string | null>(null);
  /** When true, nested payment rows under that parent id are visible. Default collapsed. */
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const [ledgerEntries, partyRows, bills, purchases] = await Promise.all([
      db.ledger_entries.where("user_id").equals(userId).toArray(),
      db.parties.where("user_id").equals(userId).toArray(),
      db.bills.where("user_id").equals(userId).toArray(),
      db.purchases.where("user_id").equals(userId).toArray(),
    ]);
    ledgerEntries.sort((a, b) =>
      a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0
    );
    partyRows.sort((a, b) => a.name.localeCompare(b.name));
    const totals: Record<string, number> = {};
    for (const b of bills) totals[b.id] = b.total;
    setBillTotalById(totals);
    const pTotals: Record<string, number> = {};
    for (const p of purchases) pTotals[p.id] = p.total;
    setPurchaseTotalById(pTotals);
    setRows(ledgerEntries);
    setParties(partyRows);
    setPaymentPartyId((prev) => prev || partyRows[0]?.id || "");
  }, [userId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load, refreshToken, lastSyncAt]);

  useEffect(() => {
    if (localFilters.partyId) {
      setPaymentPartyId(localFilters.partyId);
    }
  }, [localFilters.partyId]);

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

  function toggleParentExpand(parentId: string) {
    setExpandedParents((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  }

  function isParentExpanded(parentId: string, childCount: number) {
    if (childCount === 0) return true;
    return expandedParents[parentId] === true;
  }

  async function openLedgerPreviewDoc(r: LedgerEntryRow) {
    setLedgerRowBusyId(r.id);
    try {
      if (r.entry_type === "payment") {
        setDocPreview({ kind: "payment_receipt", entry: r });
        return;
      }
      if (r.entry_type === "sale" && r.ref_bill_id) {
        const data = await loadBillPrintPayload(userId, r.ref_bill_id);
        if (!data) {
          window.alert("Bill not found. It may have been deleted.");
          return;
        }
        setDocPreview({ kind: "bill", ...data });
      } else if (r.entry_type === "purchase" && r.ref_purchase_id) {
        const data = await loadPurchasePrintPayload(userId, r.ref_purchase_id);
        if (!data) {
          window.alert("Purchase not found. It may have been deleted.");
          return;
        }
        setDocPreview({ kind: "purchase", ...data });
      }
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not load document"
      );
    } finally {
      setLedgerRowBusyId(null);
    }
  }

  async function onRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentPartyId) {
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
        party_id: paymentPartyId,
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

  const filteredRows = rows.filter((r) => {
    if (localFilters.fromDate && r.entry_date < localFilters.fromDate) return false;
    if (localFilters.toDate && r.entry_date > localFilters.toDate) return false;
    if (localFilters.partyId && r.party_id !== localFilters.partyId) return false;
    if (localFilters.entryType && r.entry_type !== localFilters.entryType) return false;
    return true;
  });

  /** Table filter wins; else Record payment contact — drives khata notebook. */
  const notebookPartyId = localFilters.partyId || paymentPartyId;
  const notebookMode = Boolean(notebookPartyId);

  const notebookFilteredRows = useMemo(() => {
    if (!notebookMode) return [];
    return rows.filter((r) => {
      if (localFilters.fromDate && r.entry_date < localFilters.fromDate) return false;
      if (localFilters.toDate && r.entry_date > localFilters.toDate) return false;
      if (notebookPartyId && r.party_id !== notebookPartyId) return false;
      if (localFilters.entryType && r.entry_type !== localFilters.entryType) return false;
      return true;
    });
  }, [rows, notebookMode, notebookPartyId, localFilters]);

  const selectionSummary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const amountAbs = Math.abs(row.balance_delta);
        if (row.entry_type === "sale") {
          const inv =
            row.ref_bill_id != null ? billTotalById[row.ref_bill_id] : undefined;
          acc.totalSales += inv != null ? inv : amountAbs;
        }
        if (row.balance_delta > 0) acc.totalCredit += row.balance_delta;
        if (row.entry_type === "payment") acc.totalPayments += amountAbs;
        return acc;
      },
      { totalSales: 0, totalCredit: 0, totalPayments: 0 }
    );
  }, [filteredRows, billTotalById]);

  const ledgerTableRows = useMemo(() => {
    if (localFilters.entryType === "payment") {
      return { mode: "flat" as const, rows: filteredRows };
    }
    return { mode: "grouped" as const, groups: buildLedgerDisplayGroups(filteredRows) };
  }, [filteredRows, localFilters.entryType]);

  const selectedPartyName =
    parties.find((p) => p.id === notebookPartyId)?.name ?? "Contact";

  const notebookGroups = useMemo(() => {
    if (!notebookMode) return null;
    return ledgerGroupsForNotebookView(
      notebookFilteredRows,
      localFilters.entryType
    );
  }, [notebookMode, notebookFilteredRows, localFilters.entryType]);

  const notebookPartition = useMemo(() => {
    if (!notebookGroups) return null;
    return partitionNotebookGroups(notebookGroups, notebookFilteredRows);
  }, [notebookGroups, notebookFilteredRows]);

  const notebookExpenseTotal = useMemo(() => {
    if (!notebookPartition) return 0;
    return sumNotebookGroups(
      notebookPartition.expense,
      billTotalById,
      purchaseTotalById
    );
  }, [notebookPartition, billTotalById, purchaseTotalById]);

  const notebookIncomeTotal = useMemo(() => {
    if (!notebookPartition) return 0;
    return sumNotebookGroups(
      notebookPartition.income,
      billTotalById,
      purchaseTotalById
    );
  }, [notebookPartition, billTotalById, purchaseTotalById]);

  const filterPeriodHint = useMemo(() => {
    const { fromDate, toDate } = localFilters;
    if (fromDate && toDate) return `${fromDate} → ${toDate}`;
    if (fromDate) return `From ${fromDate}`;
    if (toDate) return `Until ${toDate}`;
    return "All dates in view";
  }, [localFilters.fromDate, localFilters.toDate]);

  function renderNotebookGroup(g: LedgerDisplayGroup) {
    if (g.kind === "payment-only") {
      return (
        <LedgerEntryMobileCard
          key={g.payment.id}
          row={g.payment}
          visual="standalone"
          ledgerRowBusyId={ledgerRowBusyId}
          onDelete={onDelete}
          onPreview={openLedgerPreviewDoc}
        />
      );
    }
    return (
      <Fragment key={g.parent.id}>
        <LedgerEntryMobileCard
          row={g.parent}
          visual="parent"
          expandToggle={
            g.payments.length > 0
              ? {
                  expanded: isParentExpanded(g.parent.id, g.payments.length),
                  onToggle: () => toggleParentExpand(g.parent.id),
                  childCount: g.payments.length,
                }
              : undefined
          }
          ledgerRowBusyId={ledgerRowBusyId}
          onDelete={onDelete}
          onPreview={openLedgerPreviewDoc}
        />
        {isParentExpanded(g.parent.id, g.payments.length)
          ? g.payments.map((p) => (
              <LedgerEntryMobileCard
                key={p.id}
                row={p}
                visual="child"
                ledgerRowBusyId={ledgerRowBusyId}
                onDelete={onDelete}
                onPreview={openLedgerPreviewDoc}
              />
            ))
          : null}
      </Fragment>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-medium text-[var(--gs-text)]">Ledger</h2>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full shrink-0 sm:w-auto"
          onClick={() =>
            onApplyToOverview?.({
              fromDate: localFilters.fromDate || undefined,
              toDate: localFilters.toDate || undefined,
              partyId: localFilters.partyId || undefined,
            })
          }
        >
          Apply to overview
        </Button>
      </div>
      <form
        onSubmit={onRecordPayment}
        className="grid gap-2 rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface)] p-3 md:grid-cols-6"
      >
        <label className="space-y-1 md:col-span-2">
          <span className="text-[11px] text-[var(--gs-text-secondary)]">Contact</span>
          <Select
            value={paymentPartyId}
            onChange={(e) => {
              setPaymentPartyId(e.target.value);
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
      {rows.length === 0 ? (
        <p className="rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-4 py-8 text-center text-sm text-[var(--gs-text-secondary)]">
          No ledger entries yet.
        </p>
      ) : notebookMode && notebookPartition ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-panel)] shadow-[0_12px_36px_-20px_rgba(58,42,31,0.35)]">
          <div className="border-b border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-4 py-4">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gs-primary)]">
              Khata notebook
            </p>
            <h3 className="mt-1 text-center text-xl font-semibold tracking-tight text-[var(--gs-text)]">
              {selectedPartyName}
            </h3>
            <p className="mt-1 text-center text-xs text-[var(--gs-text-secondary)]">
              {filterPeriodHint}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center sm:gap-3">
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:max-w-xs">
                <label className="min-w-0 space-y-1">
                  <span className="text-[10px] text-[var(--gs-text-secondary)]">
                    From
                  </span>
                  <Input
                    type="date"
                    value={localFilters.fromDate}
                    onChange={(e) =>
                      onLocalFiltersChange({
                        ...localFilters,
                        fromDate: e.target.value,
                      })
                    }
                    className="h-9 min-w-0 text-xs"
                  />
                </label>
                <label className="min-w-0 space-y-1">
                  <span className="text-[10px] text-[var(--gs-text-secondary)]">
                    To
                  </span>
                  <Input
                    type="date"
                    value={localFilters.toDate}
                    onChange={(e) =>
                      onLocalFiltersChange({
                        ...localFilters,
                        toDate: e.target.value,
                      })
                    }
                    className="h-9 min-w-0 text-xs"
                  />
                </label>
              </div>
              <label className="w-full min-w-0 space-y-1 sm:w-44">
                <span className="text-[10px] text-[var(--gs-text-secondary)]">
                  Entry type
                </span>
                <Select
                  value={localFilters.entryType}
                  onChange={(e) =>
                    onLocalFiltersChange({
                      ...localFilters,
                      entryType: e.target.value as
                        | ""
                        | "sale"
                        | "purchase"
                        | "payment",
                    })
                  }
                  className="h-9 text-xs"
                >
                  <option value="">All</option>
                  <option value="sale">Sale</option>
                  <option value="purchase">Purchase</option>
                  <option value="payment">Payment</option>
                </Select>
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  onLocalFiltersChange({
                    ...localFilters,
                    partyId: "",
                  });
                  setPaymentPartyId("");
                }}
              >
                All contacts
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y divide-[var(--gs-border)] bg-[var(--gs-surface)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="min-h-[12rem] bg-[var(--gs-surface-plain)]/80 p-3 lg:min-h-[16rem]">
              <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-[var(--gs-text-secondary)]">
                Expense · buys & payments out
              </p>
              <div className="space-y-2">
                {notebookPartition.expense.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[var(--gs-text-secondary)]">
                    Nothing on this side for this filter.
                  </p>
                ) : (
                  notebookPartition.expense.map((g) => renderNotebookGroup(g))
                )}
              </div>
            </div>
            <div className="min-h-[12rem] p-3 lg:min-h-[16rem]">
              <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-[var(--gs-success)]">
                Income · sales & money in
              </p>
              <div className="space-y-2">
                {notebookPartition.income.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[var(--gs-text-secondary)]">
                    Nothing on this side for this filter.
                  </p>
                ) : (
                  notebookPartition.income.map((g) => renderNotebookGroup(g))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-[var(--gs-text-secondary)]">
            Pick a contact under <span className="font-medium">Record payment</span>{" "}
            or set <span className="font-medium">Contact</span> in the filters
            below to open the split khata. Use{" "}
            <span className="font-medium">All contacts</span> in the notebook to
            come back here.
          </p>
          <div className="hidden overflow-x-auto rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] md:block">
            <table className="w-full min-w-[720px] text-left text-sm lg:min-w-[860px]">
          <thead>
            <tr className="border-b border-[var(--gs-border)] bg-[var(--gs-surface)] text-[11px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Medium</th>
              <th className="px-3 py-2">Transaction ID</th>
              <th className="px-3 py-2 text-right" title="Amount added to or removed from the party's outstanding balance">Balance change (₹)</th>
              <th className="min-w-[148px] px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide">
                Actions
              </th>
            </tr>
            <tr className="border-b border-[var(--gs-grid)] bg-[var(--gs-surface)]/70 text-[11px] text-[var(--gs-text-secondary)]">
              <th className="px-3 py-1.5">
                <div className="grid grid-cols-2 gap-1">
                  <Input
                    type="date"
                    value={localFilters.fromDate}
                    onChange={(e) =>
                      onLocalFiltersChange({
                        ...localFilters,
                        fromDate: e.target.value,
                      })
                    }
                    className="h-7 text-xs"
                  />
                  <Input
                    type="date"
                    value={localFilters.toDate}
                    onChange={(e) =>
                      onLocalFiltersChange({
                        ...localFilters,
                        toDate: e.target.value,
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </th>
              <th className="px-3 py-1.5">
                <Select
                  value={localFilters.entryType}
                  onChange={(e) =>
                    onLocalFiltersChange({
                      ...localFilters,
                      entryType: e.target.value as "" | "sale" | "purchase" | "payment",
                    })
                  }
                  className="h-7 text-xs"
                >
                  <option value="">All</option>
                  <option value="sale">Sale</option>
                  <option value="purchase">Purchase</option>
                  <option value="payment">Payment</option>
                </Select>
              </th>
              <th className="px-3 py-1.5">
                <Select
                  value={localFilters.partyId}
                  onChange={(e) =>
                    onLocalFiltersChange({
                      ...localFilters,
                      partyId: e.target.value,
                    })
                  }
                  className="h-7 text-xs"
                >
                  <option value="">All contacts</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </th>
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5 text-right" />
              <th className="px-3 py-1.5 text-center">
                {localFilters.fromDate ||
                localFilters.toDate ||
                localFilters.partyId ||
                localFilters.entryType ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--gs-text-secondary)] hover:text-[var(--gs-text)]"
                    onClick={() =>
                      onLocalFiltersChange({
                        fromDate: "",
                        toDate: "",
                        partyId: "",
                        entryType: "",
                      })
                    }
                  >
                    Clear
                  </button>
                ) : null}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--gs-grid)]">
            {ledgerTableRows.mode === "flat"
              ? ledgerTableRows.rows.map((r) => (
                  <LedgerEntryTr
                    key={r.id}
                    row={r}
                    visual="standalone"
                    ledgerRowBusyId={ledgerRowBusyId}
                    onDelete={onDelete}
                    onPreview={openLedgerPreviewDoc}
                  />
                ))
              : ledgerTableRows.groups.map((g) =>
                  g.kind === "payment-only" ? (
                    <LedgerEntryTr
                      key={g.payment.id}
                      row={g.payment}
                      visual="standalone"
                      ledgerRowBusyId={ledgerRowBusyId}
                      onDelete={onDelete}
                      onPreview={openLedgerPreviewDoc}
                    />
                  ) : (
                    <Fragment key={g.parent.id}>
                      <LedgerEntryTr
                        row={g.parent}
                        visual="parent"
                        expandToggle={
                          g.payments.length > 0
                            ? {
                                expanded: isParentExpanded(g.parent.id, g.payments.length),
                                onToggle: () => toggleParentExpand(g.parent.id),
                                childCount: g.payments.length,
                              }
                            : undefined
                        }
                        ledgerRowBusyId={ledgerRowBusyId}
                        onDelete={onDelete}
                        onPreview={openLedgerPreviewDoc}
                      />
                      {isParentExpanded(g.parent.id, g.payments.length)
                        ? g.payments.map((p) => (
                            <LedgerEntryTr
                              key={p.id}
                              row={p}
                              visual="child"
                              ledgerRowBusyId={ledgerRowBusyId}
                              onDelete={onDelete}
                              onPreview={openLedgerPreviewDoc}
                            />
                          ))
                        : null}
                    </Fragment>
                  )
                )}
          </tbody>
        </table>
        {ledgerEmptyMessage(rows.length, filteredRows.length)}
      </div>

      <div className="space-y-2 rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] p-2 md:hidden">
        <LedgerFiltersMobile
          localFilters={localFilters}
          onLocalFiltersChange={onLocalFiltersChange}
          parties={parties}
        />
        {rows.length === 0 || filteredRows.length === 0 ? (
          ledgerEmptyMessage(rows.length, filteredRows.length)
        ) : (
          <div className="space-y-2">
            {ledgerTableRows.mode === "flat"
              ? ledgerTableRows.rows.map((r) => (
                  <LedgerEntryMobileCard
                    key={r.id}
                    row={r}
                    visual="standalone"
                    ledgerRowBusyId={ledgerRowBusyId}
                    onDelete={onDelete}
                    onPreview={openLedgerPreviewDoc}
                  />
                ))
              : ledgerTableRows.groups.map((g) =>
                  g.kind === "payment-only" ? (
                    <LedgerEntryMobileCard
                      key={g.payment.id}
                      row={g.payment}
                      visual="standalone"
                      ledgerRowBusyId={ledgerRowBusyId}
                      onDelete={onDelete}
                      onPreview={openLedgerPreviewDoc}
                    />
                  ) : (
                    <Fragment key={g.parent.id}>
                      <LedgerEntryMobileCard
                        row={g.parent}
                        visual="parent"
                        expandToggle={
                          g.payments.length > 0
                            ? {
                                expanded: isParentExpanded(
                                  g.parent.id,
                                  g.payments.length
                                ),
                                onToggle: () => toggleParentExpand(g.parent.id),
                                childCount: g.payments.length,
                              }
                            : undefined
                        }
                        ledgerRowBusyId={ledgerRowBusyId}
                        onDelete={onDelete}
                        onPreview={openLedgerPreviewDoc}
                      />
                      {isParentExpanded(g.parent.id, g.payments.length)
                        ? g.payments.map((p) => (
                            <LedgerEntryMobileCard
                              key={p.id}
                              row={p}
                              visual="child"
                              ledgerRowBusyId={ledgerRowBusyId}
                              onDelete={onDelete}
                              onPreview={openLedgerPreviewDoc}
                            />
                          ))
                        : null}
                    </Fragment>
                  )
                )}
          </div>
        )}
      </div>
        </div>
      )}

      {rows.length > 0 && notebookMode && notebookPartition ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--gs-text-secondary)]">
              Total expense
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--gs-text-secondary)]">
              {filterPeriodHint}
            </p>
            <p className="mt-1 font-mono text-sm text-[var(--gs-text)]">
              {formatINR(notebookExpenseTotal)}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--gs-text-secondary)]">
              Total income
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--gs-text-secondary)]">
              {filterPeriodHint}
            </p>
            <p className="mt-1 font-mono text-sm text-[var(--gs-text)]">
              {formatINR(notebookIncomeTotal)}
            </p>
          </div>
        </div>
      ) : !notebookMode && filteredRows.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--gs-text-secondary)]">
              Total sales
            </p>
            <p className="mt-1 font-mono text-sm text-[var(--gs-text)]">
              {formatINR(selectionSummary.totalSales)}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--gs-text-secondary)]">
              Total credit
            </p>
            <p className="mt-1 font-mono text-sm text-[var(--gs-text)]">
              {formatINR(selectionSummary.totalCredit)}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--gs-text-secondary)]">
              Total payment
            </p>
            <p className="mt-1 font-mono text-sm text-[var(--gs-text)]">
              {formatINR(selectionSummary.totalPayments)}
            </p>
          </div>
        </div>
      ) : null}

      <PrintableDocModal
        payload={docPreview}
        onClose={() => setDocPreview(null)}
      />
    </section>
  );
}
