"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { getLocalDateInputValue } from "@/lib/date/local-date";
import { createParty } from "@/modules/parties/actions";
import { deleteParty } from "@/modules/parties/delete";
import { updateParty } from "@/modules/parties/update";
import { createLedgerPayment } from "@/modules/ledger/actions";
import { deleteLedgerEntry } from "@/modules/ledger/delete";
import type {
  BillItemRow,
  BillType,
  LedgerEntryRow,
  PartyRow,
  PaymentMode,
  PurchaseItemRow,
  PurchasePaymentType,
} from "@/lib/types/domain";
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
import {
  WORKSPACE_INSET_EXPANDED,
  WORKSPACE_PANEL,
  WORKSPACE_PANEL_HEADER,
  workspaceEntryShell,
} from "@/components/workspace/workspace-shell";

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
 * Document rows (sale/purchase) open groups. Payments with `ref_bill_id` /
 * `ref_purchase_id` nest under the matching bill/purchase row; otherwise they
 * attach to the latest preceding sale or purchase for the same contact.
 */
function buildLedgerDisplayGroups(rows: LedgerEntryRow[]): LedgerDisplayGroup[] {
  const sorted = [...rows].sort(compareLedgerAsc);
  const groups: LedgerDisplayGroup[] = [];
  const lastDocGroupByParty = new Map<string, Extract<LedgerDisplayGroup, { kind: "document" }>>();
  const billToGroup = new Map<string, Extract<LedgerDisplayGroup, { kind: "document" }>>();
  const purchaseToGroup = new Map<string, Extract<LedgerDisplayGroup, { kind: "document" }>>();

  for (const r of sorted) {
    if (r.entry_type === "sale" || r.entry_type === "purchase") {
      const g: Extract<LedgerDisplayGroup, { kind: "document" }> = {
        kind: "document",
        parent: r,
        payments: [],
      };
      groups.push(g);
      lastDocGroupByParty.set(r.party_id, g);
      if (r.entry_type === "sale" && r.ref_bill_id) {
        billToGroup.set(r.ref_bill_id, g);
      }
      if (r.entry_type === "purchase" && r.ref_purchase_id) {
        purchaseToGroup.set(r.ref_purchase_id, g);
      }
    } else if (r.entry_type === "payment") {
      if (r.ref_bill_id) {
        const g = billToGroup.get(r.ref_bill_id);
        if (g && g.parent.party_id === r.party_id) {
          g.payments.push(r);
        } else {
          groups.push({ kind: "payment-only", payment: r });
        }
      } else if (r.ref_purchase_id) {
        const g = purchaseToGroup.get(r.ref_purchase_id);
        if (g && g.parent.party_id === r.party_id) {
          g.payments.push(r);
        } else {
          groups.push({ kind: "payment-only", payment: r });
        }
      } else {
        const doc = lastDocGroupByParty.get(r.party_id);
        if (doc) {
          doc.payments.push(r);
        } else {
          groups.push({ kind: "payment-only", payment: r });
        }
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

function ledgerSignedTotalMeta(
  row: LedgerEntryRow,
  billTotalById: Record<string, number>,
  purchaseTotalById: Record<string, number>
): { text: string; isNegative: boolean } {
  let mag: number;
  if (row.entry_type === "sale") {
    mag = saleDisplayAmount(row, billTotalById);
  } else if (row.entry_type === "purchase") {
    mag = purchaseDisplayAmount(row, purchaseTotalById);
  } else {
    mag = paymentDisplayAmount(row);
  }
  const sign =
    row.entry_type === "payment"
      ? Math.sign(row.balance_delta) || -1
      : row.balance_delta === 0
        ? 1
        : Math.sign(row.balance_delta);
  const value = sign * mag;
  return { text: formatINR(value), isNegative: value < 0 };
}

/** Outstanding on a bill: bill total minus payments that carry `ref_bill_id`. */
function computePendingByBillId(
  ledgerRows: LedgerEntryRow[],
  billTotalById: Record<string, number>
): Record<string, number> {
  const paidByBill = new Map<string, number>();
  for (const r of ledgerRows) {
    if (r.entry_type === "payment" && r.ref_bill_id) {
      const id = r.ref_bill_id;
      paidByBill.set(id, (paidByBill.get(id) ?? 0) + paymentDisplayAmount(r));
    }
  }
  const out: Record<string, number> = {};
  for (const id of Object.keys(billTotalById)) {
    const total = billTotalById[id] ?? 0;
    const paid = paidByBill.get(id) ?? 0;
    out[id] = Math.max(0, Math.round((total - paid) * 100) / 100);
  }
  return out;
}

function computePendingByPurchaseId(
  ledgerRows: LedgerEntryRow[],
  purchaseTotalById: Record<string, number>
): Record<string, number> {
  const paidByPurchase = new Map<string, number>();
  for (const r of ledgerRows) {
    if (r.entry_type === "payment" && r.ref_purchase_id) {
      const id = r.ref_purchase_id;
      paidByPurchase.set(
        id,
        (paidByPurchase.get(id) ?? 0) + paymentDisplayAmount(r)
      );
    }
  }
  const out: Record<string, number> = {};
  for (const id of Object.keys(purchaseTotalById)) {
    const total = purchaseTotalById[id] ?? 0;
    const paid = paidByPurchase.get(id) ?? 0;
    out[id] = Math.max(0, Math.round((total - paid) * 100) / 100);
  }
  return out;
}

type LedgerEntryStatusModel =
  | { kind: "paid" }
  | { kind: "pending"; amount: number };

function ledgerEntryStatusModel(
  row: LedgerEntryRow,
  billTypeById: Record<string, BillType>,
  purchasePaymentTypeById: Record<string, PurchasePaymentType>,
  pendingByBillId: Record<string, number>,
  pendingByPurchaseId: Record<string, number>
): LedgerEntryStatusModel {
  if (row.entry_type === "payment") {
    return { kind: "paid" };
  }
  if (row.entry_type === "sale" && row.ref_bill_id) {
    const t = billTypeById[row.ref_bill_id];
    if (t !== "credit") return { kind: "paid" };
    const pending = pendingByBillId[row.ref_bill_id] ?? 0;
    return pending > 0 ? { kind: "pending", amount: pending } : { kind: "paid" };
  }
  if (row.entry_type === "purchase" && row.ref_purchase_id) {
    const t = purchasePaymentTypeById[row.ref_purchase_id];
    if (t !== "credit") return { kind: "paid" };
    const pending = pendingByPurchaseId[row.ref_purchase_id] ?? 0;
    return pending > 0 ? { kind: "pending", amount: pending } : { kind: "paid" };
  }
  if (row.balance_delta === 0) return { kind: "paid" };
  return { kind: "pending", amount: Math.abs(row.balance_delta) };
}

type DocLineSummary = { productLabel: string; totalQty: number };

function summarizeBillLinesByBillId(
  lines: BillItemRow[],
  itemNameById: Map<string, string>
): Record<string, DocLineSummary> {
  const byBill = new Map<string, BillItemRow[]>();
  for (const l of lines) {
    const arr = byBill.get(l.bill_id) ?? [];
    arr.push(l);
    byBill.set(l.bill_id, arr);
  }
  const out: Record<string, DocLineSummary> = {};
  for (const [billId, arr] of byBill) {
    arr.sort((a, b) => a.id.localeCompare(b.id));
    const totalQty = arr.reduce((s, x) => s + x.qty, 0);
    const names = arr.map((x) => itemNameById.get(x.item_id) ?? "Item");
    let productLabel: string;
    if (names.length === 0) productLabel = "—";
    else if (names.length === 1) productLabel = names[0];
    else productLabel = `${names[0]} +${names.length - 1} more`;
    out[billId] = { productLabel, totalQty };
  }
  return out;
}

function summarizePurchaseLinesByPurchaseId(
  lines: PurchaseItemRow[],
  itemNameById: Map<string, string>
): Record<string, DocLineSummary> {
  const byPurchase = new Map<string, PurchaseItemRow[]>();
  for (const l of lines) {
    const arr = byPurchase.get(l.purchase_id) ?? [];
    arr.push(l);
    byPurchase.set(l.purchase_id, arr);
  }
  const out: Record<string, DocLineSummary> = {};
  for (const [purchaseId, arr] of byPurchase) {
    arr.sort((a, b) => a.id.localeCompare(b.id));
    const totalQty = arr.reduce((s, x) => s + x.qty, 0);
    const names = arr.map((x) => itemNameById.get(x.item_id) ?? "Item");
    let productLabel: string;
    if (names.length === 0) productLabel = "—";
    else if (names.length === 1) productLabel = names[0];
    else productLabel = `${names[0]} +${names.length - 1} more`;
    out[purchaseId] = { productLabel, totalQty };
  }
  return out;
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

/** Ruled-row khata line: more fields than mobile cards; shell chrome lives on group wrapper. */
function LedgerNotebookEntry({
  row,
  visual,
  ledgerRowBusyId,
  onDelete,
  onPreview,
  onAddFollowUp,
  expandToggle,
  billTotalById,
  purchaseTotalById,
  billLineSummaryById,
  purchaseLineSummaryById,
  billTypeById,
  purchasePaymentTypeById,
  pendingByBillId,
  pendingByPurchaseId,
  showParty,
}: {
  row: LedgerEntryRow;
  visual: LedgerRowVisual;
  ledgerRowBusyId: string | null;
  onDelete: (id: string) => void;
  onPreview: (r: LedgerEntryRow) => void | Promise<void>;
  /** Sale / purchase parent: open flow to record a linked payment in the same block. */
  onAddFollowUp?: (r: LedgerEntryRow) => void;
  expandToggle?: { expanded: boolean; onToggle: () => void; childCount: number };
  billTotalById: Record<string, number>;
  purchaseTotalById: Record<string, number>;
  billLineSummaryById: Record<string, DocLineSummary>;
  purchaseLineSummaryById: Record<string, DocLineSummary>;
  billTypeById: Record<string, BillType>;
  purchasePaymentTypeById: Record<string, PurchasePaymentType>;
  pendingByBillId: Record<string, number>;
  pendingByPurchaseId: Record<string, number>;
  /** When true, show contact name (all-contacts khata). */
  showParty?: boolean;
}) {
  const isChild = visual === "child";
  const showFollowUpEdit =
    !isChild &&
    onAddFollowUp &&
    (row.entry_type === "sale" || row.entry_type === "purchase");
  const showPreviewButton =
    !isChild &&
    ((row.entry_type === "sale" && row.ref_bill_id) ||
      (row.entry_type === "purchase" && row.ref_purchase_id) ||
      row.entry_type === "payment");
  const rowExpandable = Boolean(expandToggle && expandToggle.childCount > 0);
  const isPayment = row.entry_type === "payment";

  const signedTotal = ledgerSignedTotalMeta(
    row,
    billTotalById,
    purchaseTotalById
  );
  const statusModel = ledgerEntryStatusModel(
    row,
    billTypeById,
    purchasePaymentTypeById,
    pendingByBillId,
    pendingByPurchaseId
  );

  const docSummary =
    row.entry_type === "sale" && row.ref_bill_id
      ? billLineSummaryById[row.ref_bill_id]
      : row.entry_type === "purchase" && row.ref_purchase_id
        ? purchaseLineSummaryById[row.ref_purchase_id]
        : row.entry_type === "payment" && row.ref_bill_id
          ? billLineSummaryById[row.ref_bill_id]
          : row.entry_type === "payment" && row.ref_purchase_id
            ? purchaseLineSummaryById[row.ref_purchase_id]
            : undefined;
  const productLine = docSummary?.productLabel ?? "—";
  const qtyLine =
    docSummary != null ? String(docSummary.totalQty) : "—";

  const partyProductLine = isPayment
    ? docSummary
      ? showParty && row.party_name_snapshot
        ? `${row.party_name_snapshot} · ${productLine}`
        : productLine
      : (row.party_name_snapshot ?? "—")
    : showParty && row.party_name_snapshot
      ? `${row.party_name_snapshot} · ${productLine}`
      : productLine !== "—"
        ? productLine
        : (row.party_name_snapshot ?? "—");

  const detailLine =
    row.party_name_snapshot && productLine !== "—"
      ? `${row.party_name_snapshot} / ${productLine}`
      : partyProductLine;

  return (
    <div
      className={cn(
        "py-2 text-[13px] leading-snug",
        isChild &&
          "relative z-[1] rounded-lg border border-[var(--gs-border)]/45 border-l-[3px] border-l-[var(--gs-primary)]/35 bg-[var(--gs-surface)]/55 py-2 pl-3 pr-2 shadow-sm ring-1 ring-[var(--gs-border)]/15 ring-inset",
        rowExpandable &&
          "cursor-pointer rounded-md hover:bg-[var(--gs-surface-plain)]/70"
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1.5 items-start">
        <div className="min-w-0 space-y-0.5 text-[var(--gs-text-secondary)]">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0">
            {expandToggle && expandToggle.childCount > 0 ? (
              <span aria-hidden className="select-none text-[11px]">
                {expandToggle.expanded ? "▼" : "▶"}
              </span>
            ) : null}
            <span className="font-mono text-[12px]">{row.entry_date}</span>
          </div>
          {expandToggle && expandToggle.childCount > 0 ? (
            <div className="font-sans text-[11px] font-medium">
              {expandToggle.childCount} pymt
            </div>
          ) : null}
          <div className="font-sans text-[13px] font-semibold capitalize tracking-tight text-[var(--gs-text)]">
            {isChild ? "↳ payment" : row.entry_type}
          </div>
        </div>
        <div className="self-start pt-0.5 text-right">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
            Qty
          </span>
        </div>
        <div className="min-w-[5.5rem] max-w-[9rem] shrink-0 self-start pt-0.5 text-right">
          {statusModel.kind === "pending" ? (
            <span className="text-[11px] font-semibold text-[var(--gs-text)]">
              Pending Amt
            </span>
          ) : (
            <span className="text-[12px] font-medium text-[var(--gs-text)]">Paid</span>
          )}
        </div>

        <p className="min-w-0 line-clamp-3 text-[13px] font-medium leading-snug text-[var(--gs-text)]">
          {detailLine}
        </p>
        <div className="text-right font-mono text-[13px] tabular-nums leading-tight text-[var(--gs-text)]">
          {qtyLine}
        </div>
        <div className="min-w-[5.5rem] max-w-[9rem] shrink-0 text-right font-mono text-[13px] tabular-nums leading-tight text-[var(--gs-text)]">
          {statusModel.kind === "pending" ? (
            formatINR(statusModel.amount)
          ) : (
            <span className="text-[var(--gs-text-secondary)]">—</span>
          )}
        </div>
      </div>

      <div
        className="mt-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-dashed border-[var(--gs-border)]/60 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {showPreviewButton ? (
            <button
              type="button"
              disabled={ledgerRowBusyId === row.id}
              className="text-[13px] font-medium text-[var(--gs-primary)] hover:underline disabled:opacity-40"
              onClick={() => void onPreview(row)}
            >
              {ledgerRowBusyId === row.id ? "…" : "Preview"}
            </button>
          ) : null}
          {showFollowUpEdit ? (
            <button
              type="button"
              className="text-[13px] font-medium text-[var(--gs-primary)] hover:underline"
              onClick={() => onAddFollowUp(row)}
            >
              Edit
            </button>
          ) : null}
          <button
            type="button"
            className="text-[13px] text-[var(--gs-text-secondary)] hover:text-[var(--gs-danger)]"
            onClick={() => void onDelete(row.id)}
          >
            Remove
          </button>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
            Total
          </span>
          <p
            className={cn(
              "mt-0.5 font-mono text-[15px] tabular-nums leading-tight tracking-tight",
              signedTotal.isNegative
                ? "text-[var(--gs-text-secondary)]"
                : "text-[var(--gs-text)]"
            )}
          >
            {signedTotal.text}
          </p>
        </div>
      </div>
    </div>
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

function LedgerFollowUpPaymentModal({
  userId,
  parent,
  onClose,
  onRecorded,
}: {
  userId: string;
  parent: LedgerEntryRow;
  onClose: () => void;
  onRecorded: (parentLedgerId: string) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(() => getLocalDateInputValue());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAmount("");
    setEntryDate(getLocalDateInputValue());
    setPaymentMode("cash");
    setPaymentReference("");
    setNote("");
    setError(null);
  }, [parent.id]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const title =
    parent.entry_type === "sale"
      ? "Record payment on this bill"
      : "Record payment on this purchase";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0) || Number.isNaN(n)) {
      setError("Enter an amount greater than 0");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createLedgerPayment(userId, {
        party_id: parent.party_id,
        party_name_snapshot: parent.party_name_snapshot ?? undefined,
        entry_date: entryDate,
        amount: n,
        payment_mode: paymentMode,
        payment_reference: paymentReference || null,
        note: note || null,
        ref_bill_id:
          parent.entry_type === "sale" && parent.ref_bill_id
            ? parent.ref_bill_id
            : null,
        ref_purchase_id:
          parent.entry_type === "purchase" && parent.ref_purchase_id
            ? parent.ref_purchase_id
            : null,
      });
      await Promise.resolve(onRecorded(parent.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not record payment"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center px-3 py-6 sm:items-center sm:px-5"
      style={{ backgroundColor: "var(--gs-overlay)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ledger-follow-up-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface)] p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="ledger-follow-up-title"
          className="text-sm font-semibold text-[var(--gs-text)]"
        >
          {title}
        </h2>
        <p className="mt-1 text-[11px] text-[var(--gs-text-secondary)]">
          {parent.party_name_snapshot ?? "Contact"} · {parent.entry_date} ·{" "}
          {parent.entry_type === "sale" ? "Sale" : "Purchase"}
        </p>
        <form className="mt-4 space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <label className="block space-y-1">
            <span className="text-[10px] text-[var(--gs-text-secondary)]">
              Amount (₹)
            </span>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (error) setError(null);
              }}
              className="h-9 text-sm"
              placeholder="0"
              autoFocus
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] text-[var(--gs-text-secondary)]">
              Date
            </span>
            <Input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="h-9 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] text-[var(--gs-text-secondary)]">
              Medium
            </span>
            <Select
              value={paymentMode}
              onChange={(e) =>
                setPaymentMode(e.target.value as PaymentMode)
              }
              className="h-9 text-sm"
            >
              {PAYMENT_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] text-[var(--gs-text-secondary)]">
              Transaction ID / ref (optional)
            </span>
            <Input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="h-9 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] text-[var(--gs-text-secondary)]">
              Note (optional)
            </span>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-9 text-sm"
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-2 py-1.5 text-xs text-[var(--gs-danger)]"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
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

  const filteredParties = useMemo(
    () =>
      rows.filter((p) =>
        nameFilter.trim()
          ? p.name.toLowerCase().includes(nameFilter.trim().toLowerCase())
          : true
      ),
    [rows, nameFilter]
  );

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
      <div className={WORKSPACE_PANEL}>
        <div className={WORKSPACE_PANEL_HEADER}>
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--gs-text-secondary)]">
            Directory
          </p>
          <h3 className="mt-0.5 text-center text-lg font-semibold tracking-tight text-[var(--gs-text)]">
            Contacts
          </h3>
          <p className="mt-0.5 text-center text-[11px] text-[var(--gs-text-secondary)]">
            Add names and phone numbers for bills and ledger.
          </p>
          <form
            onSubmit={onAdd}
            className="mx-auto mt-3 flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-end sm:justify-center sm:gap-3"
          >
            <label className="min-w-0 flex-1 space-y-1">
              <span className="text-[10px] text-[var(--gs-text-secondary)]">Name</span>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (addError) setAddError(null);
                }}
                placeholder="Contact name"
                className="h-9 text-xs"
              />
            </label>
            <label className="min-w-0 flex-1 space-y-1 sm:max-w-[220px]">
              <span className="text-[10px] text-[var(--gs-text-secondary)]">Phone</span>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
                className="h-9 text-xs"
              />
            </label>
            <Button type="submit" size="sm" className="h-9 shrink-0" disabled={isAdding}>
              {isAdding ? "Adding…" : "Add contact"}
            </Button>
          </form>
          {addError ? (
            <p
              role="alert"
              aria-live="polite"
              className="mx-auto mt-3 max-w-3xl rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-[13px] text-[var(--gs-danger)]"
            >
              {addError}
            </p>
          ) : null}
          <div className="mx-auto mt-3 flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
            <label className="min-w-0 flex-1 space-y-1">
              <span className="text-[10px] text-[var(--gs-text-secondary)]">
                Filter by name
              </span>
              <Input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Type to narrow the list"
                className="h-9 text-xs"
              />
            </label>
            {nameFilter ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 shrink-0 sm:self-end"
                onClick={() => setNameFilter("")}
              >
                Clear filter
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2.5 bg-[var(--gs-surface)] px-2 py-2 sm:px-3 sm:py-2.5">
          {rows.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-[var(--gs-text-secondary)]">
              No contacts yet.
            </p>
          ) : filteredParties.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-[var(--gs-text-secondary)]">
              No contacts match this filter.
            </p>
          ) : (
            filteredParties.map((p) => (
              <div key={p.id} className={workspaceEntryShell("neutral")}>
                {editingId === p.id ? (
                  <div className="space-y-3 bg-[var(--gs-selection)]/40 px-2.5 py-2.5 sm:px-3 sm:py-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-[10px] text-[var(--gs-text-secondary)]">Name</span>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-9 text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEdit(p.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] text-[var(--gs-text-secondary)]">Phone</span>
                        <Input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="Phone"
                          className="h-9 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEdit(p.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => void saveEdit(p.id)}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug text-[var(--gs-text)]">
                          {p.name}
                        </p>
                        <p className="mt-1 font-mono text-[13px] tabular-nums text-[var(--gs-text-secondary)]">
                          {p.phone ?? "—"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
                        <button
                          type="button"
                          aria-label={`Edit contact ${p.name}`}
                          className="text-[13px] font-medium text-[var(--gs-primary)] hover:underline"
                          onClick={() => startEdit(p)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove contact ${p.name}`}
                          className="text-[13px] text-[var(--gs-text-secondary)] hover:text-[var(--gs-danger)]"
                          onClick={() => void onDelete(p.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
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
  const [billLineSummaryById, setBillLineSummaryById] = useState<
    Record<string, DocLineSummary>
  >({});
  const [purchaseLineSummaryById, setPurchaseLineSummaryById] = useState<
    Record<string, DocLineSummary>
  >({});
  const [billTypeById, setBillTypeById] = useState<Record<string, BillType>>({});
  const [purchasePaymentTypeById, setPurchasePaymentTypeById] = useState<
    Record<string, PurchasePaymentType>
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
  /** Sale / purchase row: record a payment linked to this bill or purchase (same khata block). */
  const [followUpParent, setFollowUpParent] = useState<LedgerEntryRow | null>(null);

  const load = useCallback(async () => {
    const [
      ledgerEntries,
      partyRows,
      bills,
      purchases,
      billItems,
      purchaseItems,
      itemRows,
    ] = await Promise.all([
      db.ledger_entries.where("user_id").equals(userId).toArray(),
      db.parties.where("user_id").equals(userId).toArray(),
      db.bills.where("user_id").equals(userId).toArray(),
      db.purchases.where("user_id").equals(userId).toArray(),
      db.bill_items.where("user_id").equals(userId).toArray(),
      db.purchase_items.where("user_id").equals(userId).toArray(),
      db.items.where("user_id").equals(userId).toArray(),
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
    const itemNameById = new Map(itemRows.map((i) => [i.id, i.name]));
    setBillLineSummaryById(summarizeBillLinesByBillId(billItems, itemNameById));
    setPurchaseLineSummaryById(
      summarizePurchaseLinesByPurchaseId(purchaseItems, itemNameById)
    );
    const bt: Record<string, BillType> = {};
    for (const b of bills) bt[b.id] = b.bill_type;
    setBillTypeById(bt);
    const ppt: Record<string, PurchasePaymentType> = {};
    for (const p of purchases) ppt[p.id] = p.payment_type;
    setPurchasePaymentTypeById(ppt);
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

  const handleFollowUpRecorded = useCallback(
    async (parentId: string) => {
      setFollowUpParent(null);
      setExpandedParents((prev) => ({ ...prev, [parentId]: true }));
      await load();
      onChanged?.();
    },
    [load, onChanged]
  );

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

  /** Ledger rows after date / contact / entry-type filters (empty party = all contacts). */
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (localFilters.fromDate && r.entry_date < localFilters.fromDate) return false;
      if (localFilters.toDate && r.entry_date > localFilters.toDate) return false;
      if (localFilters.partyId && r.party_id !== localFilters.partyId) return false;
      if (localFilters.entryType && r.entry_type !== localFilters.entryType) return false;
      return true;
    });
  }, [rows, localFilters]);

  const pendingByBillId = useMemo(
    () => computePendingByBillId(rows, billTotalById),
    [rows, billTotalById]
  );
  const pendingByPurchaseId = useMemo(
    () => computePendingByPurchaseId(rows, purchaseTotalById),
    [rows, purchaseTotalById]
  );

  const notebookGroups = useMemo(
    () =>
      ledgerGroupsForNotebookView(filteredRows, localFilters.entryType),
    [filteredRows, localFilters.entryType]
  );

  const notebookPartition = useMemo(
    () => partitionNotebookGroups(notebookGroups, filteredRows),
    [notebookGroups, filteredRows]
  );

  const notebookShowExpenseColumn = notebookPartition.expense.length > 0;
  const notebookShowIncomeColumn = notebookPartition.income.length > 0;
  const notebookShowSplitKhata =
    notebookShowExpenseColumn && notebookShowIncomeColumn;

  const notebookExpenseTotal = useMemo(() => {
    return sumNotebookGroups(
      notebookPartition.expense,
      billTotalById,
      purchaseTotalById
    );
  }, [notebookPartition, billTotalById, purchaseTotalById]);

  const notebookIncomeTotal = useMemo(() => {
    return sumNotebookGroups(
      notebookPartition.income,
      billTotalById,
      purchaseTotalById
    );
  }, [notebookPartition, billTotalById, purchaseTotalById]);

  const showPartyOnNotebookLine = !localFilters.partyId;

  function renderNotebookGroup(
    g: LedgerDisplayGroup,
    tone: "expense" | "income"
  ) {
    if (g.kind === "payment-only") {
      return (
        <div key={g.payment.id} className={workspaceEntryShell(tone)}>
          <div className="relative z-[2] px-2.5 py-1">
            <LedgerNotebookEntry
              row={g.payment}
              visual="standalone"
              ledgerRowBusyId={ledgerRowBusyId}
              onDelete={onDelete}
              onPreview={openLedgerPreviewDoc}
              billTotalById={billTotalById}
              purchaseTotalById={purchaseTotalById}
              billLineSummaryById={billLineSummaryById}
              purchaseLineSummaryById={purchaseLineSummaryById}
              billTypeById={billTypeById}
              purchasePaymentTypeById={purchasePaymentTypeById}
              pendingByBillId={pendingByBillId}
              pendingByPurchaseId={pendingByPurchaseId}
              showParty={showPartyOnNotebookLine}
            />
          </div>
        </div>
      );
    }
    const expanded = isParentExpanded(g.parent.id, g.payments.length);
    return (
      <div key={g.parent.id} className={workspaceEntryShell(tone)}>
        <div className="relative z-[2] px-2.5 pt-2 pb-1">
          <LedgerNotebookEntry
            row={g.parent}
            visual="parent"
            expandToggle={
              g.payments.length > 0
                ? {
                    expanded,
                    onToggle: () => toggleParentExpand(g.parent.id),
                    childCount: g.payments.length,
                  }
                : undefined
            }
            ledgerRowBusyId={ledgerRowBusyId}
            onDelete={onDelete}
            onPreview={openLedgerPreviewDoc}
            onAddFollowUp={setFollowUpParent}
            billTotalById={billTotalById}
            purchaseTotalById={purchaseTotalById}
            billLineSummaryById={billLineSummaryById}
            purchaseLineSummaryById={purchaseLineSummaryById}
            billTypeById={billTypeById}
            purchasePaymentTypeById={purchasePaymentTypeById}
            pendingByBillId={pendingByBillId}
            pendingByPurchaseId={pendingByPurchaseId}
            showParty={showPartyOnNotebookLine}
          />
        </div>
        {expanded && g.payments.length > 0 ? (
          <div className={WORKSPACE_INSET_EXPANDED}>
            {g.payments.map((p) => (
              <LedgerNotebookEntry
                key={p.id}
                row={p}
                visual="child"
                ledgerRowBusyId={ledgerRowBusyId}
                onDelete={onDelete}
                onPreview={openLedgerPreviewDoc}
                billTotalById={billTotalById}
                purchaseTotalById={purchaseTotalById}
                billLineSummaryById={billLineSummaryById}
                purchaseLineSummaryById={purchaseLineSummaryById}
                billTypeById={billTypeById}
                purchasePaymentTypeById={purchasePaymentTypeById}
                pendingByBillId={pendingByBillId}
                pendingByPurchaseId={pendingByPurchaseId}
                showParty={showPartyOnNotebookLine}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {rows.length > 0 ? (
        <div
          className={cn(
            "grid grid-cols-1 rounded-lg border border-[var(--gs-border)]/70 bg-[var(--gs-surface-plain)]/40",
            notebookShowSplitKhata &&
              "divide-y divide-[var(--gs-border)]/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:divide-[var(--gs-border)]/60"
          )}
        >
          {notebookShowExpenseColumn ? (
            <div className="px-3 py-2.5 sm:px-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
                Total expense · filter
              </p>
              <p className="mt-0.5 font-mono text-base tabular-nums text-[var(--gs-text)]">
                {formatINR(notebookExpenseTotal)}
              </p>
            </div>
          ) : null}
          {notebookShowIncomeColumn ? (
            <div className="px-3 py-2.5 sm:px-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
                Total income · filter
              </p>
              <p className="mt-0.5 font-mono text-base tabular-nums text-[var(--gs-text)]">
                {formatINR(notebookIncomeTotal)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-4 py-8 text-center text-sm text-[var(--gs-text-secondary)]">
          No ledger entries yet.
        </p>
      ) : (
        <div className={WORKSPACE_PANEL}>
          <div className={WORKSPACE_PANEL_HEADER}>
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 md:flex-row md:flex-nowrap md:items-end md:justify-center md:gap-3">
              <label className="min-w-0 flex-1 space-y-1 md:min-w-[10.5rem]">
                <span className="text-[10px] text-[var(--gs-text-secondary)]">
                  Contacts
                </span>
                <Select
                  value={localFilters.partyId}
                  onChange={(e) =>
                    onLocalFiltersChange({
                      ...localFilters,
                      partyId: e.target.value,
                    })
                  }
                  className="h-9 w-full text-xs"
                >
                  <option value="">All contacts</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="min-w-0 flex-1 space-y-1 md:max-w-[11rem]">
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
                  className="h-9 w-full min-w-0 text-xs"
                />
              </label>
              <label className="min-w-0 flex-1 space-y-1 md:max-w-[11rem]">
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
                  className="h-9 w-full min-w-0 text-xs"
                />
              </label>
              <label className="min-w-0 flex-1 space-y-1 md:max-w-[10rem]">
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
                  className="h-9 w-full text-xs"
                >
                  <option value="">All</option>
                  <option value="sale">Sale</option>
                  <option value="purchase">Purchase</option>
                  <option value="payment">Payment</option>
                </Select>
              </label>
              {localFilters.fromDate ||
              localFilters.toDate ||
              localFilters.partyId ||
              localFilters.entryType ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 w-full shrink-0 md:w-auto md:self-end"
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
          </div>
          {filteredRows.length === 0 ? (
            <div className="bg-[var(--gs-surface)] px-3 py-6 sm:px-4">
              {ledgerEmptyMessage(rows.length, filteredRows.length)}
            </div>
          ) : (
            <div
              className={cn(
                "grid grid-cols-1 bg-[var(--gs-surface)]",
                notebookShowSplitKhata &&
                  "lg:grid-cols-2 lg:divide-x lg:divide-[var(--gs-border)]/60"
              )}
            >
              {notebookShowExpenseColumn ? (
                <div className="min-h-[10rem] px-2 py-2 lg:min-h-[14rem] lg:px-3 lg:py-2.5">
                  <p className="mb-1.5 border-b border-[var(--gs-border)]/50 pb-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gs-text-secondary)]">
                    Expense · buys & pay-out
                  </p>
                  <div className="space-y-2.5">
                    {notebookPartition.expense.map((g) =>
                      renderNotebookGroup(g, "expense")
                    )}
                  </div>
                </div>
              ) : null}
              {notebookShowIncomeColumn ? (
                <div
                  className={cn(
                    "min-h-[10rem] px-2 py-2 lg:min-h-[14rem] lg:px-3 lg:py-2.5",
                    notebookShowSplitKhata &&
                      "border-t border-[var(--gs-border)]/50 lg:border-t-0"
                  )}
                >
                  <p className="mb-1.5 border-b border-[var(--gs-border)]/50 pb-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gs-success)]">
                    Income · sales & receipts
                  </p>
                  <div className="space-y-2.5">
                    {notebookPartition.income.map((g) =>
                      renderNotebookGroup(g, "income")
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {followUpParent ? (
        <LedgerFollowUpPaymentModal
          userId={userId}
          parent={followUpParent}
          onClose={() => setFollowUpParent(null)}
          onRecorded={handleFollowUpRecorded}
        />
      ) : null}

      <PrintableDocModal
        payload={docPreview}
        onClose={() => setDocPreview(null)}
      />
    </section>
  );
}
