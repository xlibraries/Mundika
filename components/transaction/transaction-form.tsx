"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { db } from "@/lib/db";
import { createBill } from "@/modules/billing/actions";
import { deleteBill } from "@/modules/billing/delete";
import { createPurchase } from "@/modules/purchases/actions";
import { deletePurchase } from "@/modules/purchases/delete";
import { createParty } from "@/modules/parties/actions";
import { createItem } from "@/modules/items/actions";
import type {
  BillRow,
  InventoryRow,
  ItemRow,
  PartyRow,
  PurchaseRow,
} from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format/inr";
import {
  EntityCombobox,
  type EntityComboboxHandle,
} from "@/components/billing/entity-combobox";
import { rememberId, readRecentIds } from "@/lib/billing/recent-ids";
import { useAppStore } from "@/store/app-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransactionFormProps = {
  defaultMode?: "billing" | "purchase";
  userId: string;
  /** Framed panel inside workspace (single shell). */
  embedded?: boolean;
};

type TxLine = {
  item_id: string;
  qty: string;
  rate: string;
  destination: "shop" | "godown";
};

type LineIssue = { qty?: boolean; rate?: boolean };

function emptyLine(): TxLine {
  return { item_id: "", qty: "1", rate: "", destination: "godown" };
}

function parseFilledLine(l: TxLine): {
  ok: boolean;
  qty: number;
  rate: number;
  issue?: LineIssue;
} {
  const qty = Number(l.qty);
  const rate = Number(l.rate);
  const badQty = !(qty > 0);
  const badRate = rate < 0 || Number.isNaN(rate);
  if (badQty || badRate) {
    return { ok: false, qty: 0, rate: 0, issue: { qty: badQty, rate: badRate } };
  }
  return { ok: true, qty, rate };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionForm({
  defaultMode = "billing",
  userId,
  embedded = false,
}: TransactionFormProps) {
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  // ---- mode ----------------------------------------------------------------
  const [mode, setMode] = useState<"billing" | "purchase">(defaultMode);

  // ---- data ----------------------------------------------------------------
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [inv, setInv] = useState<InventoryRow[]>([]);

  // ---- form fields ---------------------------------------------------------
  const [partyId, setPartyId] = useState("");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [refNumber, setRefNumber] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<TxLine[]>([emptyLine()]);

  // ---- ui state ------------------------------------------------------------
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [partyMissing, setPartyMissing] = useState(false);
  const [lineIssues, setLineIssues] = useState<Record<number, LineIssue>>({});
  const [recentPartyIds, setRecentPartyIds] = useState<string[]>([]);
  const [recentItemIds, setRecentItemIds] = useState<string[]>([]);

  // ---- history -------------------------------------------------------------
  const [bills, setBills] = useState<BillRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  // ---- refs ----------------------------------------------------------------
  const partyRef = useRef<EntityComboboxHandle>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const paymentCashRef = useRef<HTMLButtonElement>(null);
  const refNumberRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(EntityComboboxHandle | null)[]>([]);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rateRefs = useRef<(HTMLInputElement | null)[]>([]);
  const destRefs = useRef<(HTMLSelectElement | null)[]>([]);

  // ---- derived -------------------------------------------------------------
  const partyOptions = useMemo(
    () => parties.map((p) => ({ id: p.id, label: p.name })),
    [parties]
  );
  const itemOptions = useMemo(
    () => items.map((it) => ({ id: it.id, label: it.name })),
    [items]
  );
  const itemById = useMemo(
    () => new Map(items.map((it) => [it.id, it] as const)),
    [items]
  );

  // stock totals (shop + godown) per item
  const stockByItemId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inv) {
      m.set(r.item_id, (m.get(r.item_id) ?? 0) + r.qty);
    }
    return m;
  }, [inv]);

  // live row totals + stock warnings
  const liveTotals = useMemo(() => {
    const rowTotals: (number | null)[] = [];
    const stockWarnings: boolean[] = [];
    let grand = 0;
    for (const line of lines) {
      if (!line.item_id) {
        rowTotals.push(null);
        stockWarnings.push(false);
        continue;
      }
      const p = parseFilledLine(line);
      if (!p.ok) {
        rowTotals.push(null);
        stockWarnings.push(false);
        continue;
      }
      if (mode === "billing") {
        const available = stockByItemId.get(line.item_id) ?? 0;
        stockWarnings.push(p.qty > available);
      } else {
        stockWarnings.push(false);
      }
      const t = Math.round(p.qty * p.rate * 100) / 100;
      grand += t;
      rowTotals.push(t);
    }
    return { rowTotals, grand: Math.round(grand * 100) / 100, stockWarnings };
  }, [lines, stockByItemId, mode]);

  // dirty flag for beforeunload
  const isDirty =
    partyId !== "" ||
    refNumber !== "" ||
    lines.some((l) => l.item_id || l.qty !== "1" || l.rate !== "");

  // ---- data loaders --------------------------------------------------------
  const loadBills = useCallback(async () => {
    const list = await db.bills.where("user_id").equals(userId).toArray();
    list.sort((a, b) =>
      a.bill_date < b.bill_date ? 1 : a.bill_date > b.bill_date ? -1 : 0
    );
    setBills(list);
  }, [userId]);

  const loadPurchases = useCallback(async () => {
    const list = await db.purchases.where("user_id").equals(userId).toArray();
    list.sort((a, b) =>
      a.purchase_date < b.purchase_date
        ? 1
        : a.purchase_date > b.purchase_date
        ? -1
        : 0
    );
    setPurchases(list);
  }, [userId]);

  // ---- initial load --------------------------------------------------------
  useEffect(() => {
    const t = window.setTimeout(() => {
      setRecentPartyIds(readRecentIds("parties"));
      setRecentItemIds(readRecentIds("items"));
      void Promise.all([
        db.parties.where("user_id").equals(userId).toArray(),
        db.items.where("user_id").equals(userId).toArray(),
        db.inventory.where("user_id").equals(userId).toArray(),
      ]).then(([p, i, n]) => {
        p.sort((a, b) => a.name.localeCompare(b.name));
        i.sort((a, b) => a.name.localeCompare(b.name));
        setParties(p);
        setItems(i);
        setInv(n);
      });
      void loadBills();
      void loadPurchases();
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId, lastSyncAt, loadBills, loadPurchases]);

  // auto-focus party on mount
  useEffect(() => {
    const t = window.setTimeout(() => partyRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);

  // sync ref array lengths
  useEffect(() => {
    itemRefs.current.length = lines.length;
    qtyRefs.current.length = lines.length;
    rateRefs.current.length = lines.length;
    destRefs.current.length = lines.length;
  }, [lines.length]);

  // auto-clear success msg
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [msg]);

  // beforeunload guard
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // ---- mode switch ---------------------------------------------------------
  function switchMode(next: "billing" | "purchase") {
    if (next === mode) return;
    setMode(next);
    setPartyId("");
    setLines([emptyLine()]);
    setMsg(null);
    setErr(null);
    setPartyMissing(false);
    setLineIssues({});
    setRefNumber("");
    setAddress("");
    setPhone("");
    setNote("");
    window.setTimeout(() => partyRef.current?.focus(), 60);
  }

  // ---- party handlers ------------------------------------------------------
  function onPartyPick(id: string) {
    setPartyId(id);
    setPartyMissing(false);
    rememberId("parties", id);
    setRecentPartyIds(readRecentIds("parties"));
  }

  async function handleCreateContact(name: string) {
    const existing = parties.find(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) {
      onPartyPick(existing.id);
      requestAnimationFrame(() => dateRef.current?.focus());
      return;
    }
    try {
      const created = await createParty(userId, { name: name.trim() });
      setParties((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      onPartyPick(created.id);
      requestAnimationFrame(() => dateRef.current?.focus());
    } catch {
      setErr(
        mode === "billing"
          ? "Could not create customer"
          : "Could not create supplier"
      );
    }
  }

  // ---- item create ---------------------------------------------------------
  async function handleCreateItem(lineIndex: number, name: string) {
    const trimmed = name.trim();
    const existing = items.find(
      (it) => it.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      onItemPick(lineIndex, existing.id);
      requestAnimationFrame(() => qtyRefs.current[lineIndex]?.focus());
      return;
    }
    try {
      const created = await createItem(userId, { name: trimmed });
      setItems((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      onItemPick(lineIndex, created.id);
      requestAnimationFrame(() => qtyRefs.current[lineIndex]?.focus());
    } catch {
      setErr("Could not create item");
    }
  }

  // ---- item / line handlers ------------------------------------------------
  function onItemPick(i: number, id: string) {
    const item = itemById.get(id);
    setLines((prev) => {
      const next = [...prev];
      const row = next[i];
      if (!row) return prev;
      next[i] = {
        ...row,
        item_id: id,
        rate:
          item?.rate_default != null ? String(item.rate_default) : row.rate,
      };
      return next;
    });
    rememberId("items", id);
    setRecentItemIds(readRecentIds("items"));
    setLineIssues((prev) => {
      if (!prev[i]) return prev;
      const copy = { ...prev };
      delete copy[i];
      return copy;
    });
  }

  function updateLine(i: number, patch: Partial<TxLine>) {
    setLines((prev) => {
      const next = [...prev];
      const row = next[i];
      if (!row) return prev;
      next[i] = { ...row, ...patch };
      return next;
    });
  }

  function clearLineIssue(i: number, field: keyof LineIssue) {
    setLineIssues((prev) => {
      const cur = prev[i];
      if (!cur) return prev;
      const next = { ...cur };
      delete next[field];
      if (Object.keys(next).length === 0) {
        const copy = { ...prev };
        delete copy[i];
        return copy;
      }
      return { ...prev, [i]: next };
    });
  }

  function advanceToNextLine(i: number) {
    if (i < lines.length - 1) {
      requestAnimationFrame(() => itemRefs.current[i + 1]?.focus());
      return;
    }
    setLines((prev) => {
      const next = [...prev, emptyLine()];
      const ni = next.length - 1;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => itemRefs.current[ni]?.focus());
      });
      return next;
    });
  }

  function onRateEnter(i: number) {
    const line = lines[i];
    if (!line) return;
    if (!line.item_id) {
      itemRefs.current[i]?.focus();
      return;
    }
    const p = parseFilledLine(line);
    if (!p.ok) {
      setLineIssues((prev) => ({ ...prev, [i]: p.issue ?? {} }));
      if (p.issue?.qty) qtyRefs.current[i]?.focus();
      else rateRefs.current[i]?.focus();
      return;
    }
    setLineIssues((prev) => {
      if (!prev[i]) return prev;
      const copy = { ...prev };
      delete copy[i];
      return copy;
    });
    if (mode === "purchase") {
      destRefs.current[i]?.focus();
    } else {
      advanceToNextLine(i);
    }
  }

  function onDestEnter(i: number) {
    advanceToNextLine(i);
  }

  // ---- save ----------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErr(null);
    setMsg(null);
    setPartyMissing(false);
    setLineIssues({});

    try {
      if (!partyId) {
        setPartyMissing(true);
        partyRef.current?.focus();
        return;
      }

      const party = parties.find((p) => p.id === partyId);
      if (!party) {
        setErr("Party not found");
        return;
      }

      const filledLines = lines.filter((l) => l.item_id);
      if (filledLines.length === 0) {
        setErr("Add at least one line with an item");
        return;
      }

      const issues: Record<number, LineIssue> = {};
      lines.forEach((l, i) => {
        if (!l.item_id) return;
        const p = parseFilledLine(l);
        if (!p.ok && p.issue) issues[i] = p.issue;
      });
      if (Object.keys(issues).length > 0) {
        setLineIssues(issues);
        const first = Number(
          Object.keys(issues).sort((a, b) => Number(a) - Number(b))[0]
        );
        if (issues[first]?.qty) qtyRefs.current[first]?.focus();
        else rateRefs.current[first]?.focus();
        return;
      }

      if (mode === "billing") {
        const parsed = filledLines.map((l) => ({
          item_id: l.item_id,
          qty: Number(l.qty),
          rate: Number(l.rate),
        }));

        const { bill } = await createBill(userId, {
          party_id: partyId,
          party_name_snapshot: party.name,
          bill_date: txDate,
          bill_type: paymentType,
          vehicle_info: refNumber || null,
          address: address || null,
          phone: phone || null,
          lines: parsed,
        });

        setMsg(`Bill #${bill.bill_number ?? "—"} saved · ${formatINR(bill.total)}`);
        setLines([emptyLine()]);
        setRefNumber("");
        setAddress("");
        setPhone("");
        await loadBills();
      } else {
        const parsed = filledLines.map((l) => ({
          item_id: l.item_id,
          qty: Number(l.qty),
          unit_cost: Number(l.rate),
          destination: l.destination,
        }));

        const { purchase } = await createPurchase(userId, {
          party_id: partyId,
          party_name_snapshot: party.name,
          purchase_date: txDate,
          ref_number: refNumber || null,
          payment_type: paymentType,
          lines: parsed,
          note: note || null,
          address: address || null,
          phone: phone || null,
        });

        setMsg(
          `Purchase #${purchase.purchase_number} saved · ${formatINR(purchase.total)}`
        );
        setLines([emptyLine()]);
        setRefNumber("");
        setAddress("");
        setPhone("");
        setNote("");
        await loadPurchases();
      }
    } catch (er) {
      setErr(
        er instanceof Error
          ? er.message
          : mode === "billing"
          ? "Could not save bill"
          : "Could not save purchase"
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    partyId,
    parties,
    lines,
    mode,
    userId,
    txDate,
    paymentType,
    refNumber,
    address,
    phone,
    note,
    loadBills,
    loadPurchases,
  ]);

  // ---- keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-tx-stop-shortcut]")) return;
      e.preventDefault();
      void handleSave();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  useEffect(() => {
    function onPaymentHotkey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "c" && k !== "u") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input, textarea, select, [role='combobox']")) return;
      e.preventDefault();
      setPaymentType(k === "c" ? "cash" : "credit");
    }
    window.addEventListener("keydown", onPaymentHotkey);
    return () => window.removeEventListener("keydown", onPaymentHotkey);
  }, []);

  // ---- delete handlers -----------------------------------------------------
  async function onDeleteBill(billId: string) {
    if (
      !window.confirm(
        "Delete this bill? Stock goes back to shop/godown (same split as when sold), and the sale is removed from the ledger."
      )
    ) {
      return;
    }
    setErr(null);
    setMsg(null);
    try {
      await deleteBill(userId, billId);
      await loadBills();
      setMsg("Bill deleted.");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Could not delete bill");
    }
  }

  async function onDeletePurchase(purchaseId: string, label: string) {
    if (
      !window.confirm(
        `Delete purchase "${label}"? Stock added by this purchase will be subtracted from inventory, and the ledger entry will be removed.`
      )
    ) {
      return;
    }
    setErr(null);
    setMsg(null);
    try {
      await deletePurchase(userId, purchaseId);
      await loadPurchases();
      setMsg("Purchase deleted.");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Could not delete purchase");
    }
  }

  // ---- labels --------------------------------------------------------------
  const partyLabel = mode === "billing" ? "Customer" : "Supplier";
  const refLabel =
    mode === "billing" ? "Vehicle / Owner" : "Supplier Ref / Bill No.";
  const saveLabel = mode === "billing" ? "Save bill" : "Save purchase";
  const nextNumber = mode === "billing" ? bills.length + 1 : purchases.length + 1;
  const qtyPlaceholder = (unit?: string | null) =>
    unit ? `Qty (${unit})` : "Qty";

  const modeTablist = (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-surface)] p-1 shadow-[inset_0_1px_0_rgba(255,248,238,0.72),0_10px_22px_-18px_rgba(58,42,31,0.55)]",
        embedded
          ? "rounded-none border-x-0 border-t-0 border-b-0 bg-[var(--gs-grid)] shadow-none"
          : ""
      )}
      role="tablist"
      aria-label="Transaction mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "purchase"}
        onClick={() => switchMode("purchase")}
        className={`relative z-[1] flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold tracking-wide transition duration-200 ease-out ${
          mode === "purchase"
            ? "border-[var(--gs-grid)] bg-[var(--gs-surface-plain)] text-[var(--gs-text)] shadow-[0_6px_14px_-10px_rgba(58,42,31,0.45)]"
            : "border-[var(--gs-border)]/85 bg-[var(--gs-surface)]/75 text-[var(--gs-text-secondary)] hover:border-[var(--gs-border)] hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]"
        }`}
      >
        Purchase
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "billing"}
        onClick={() => switchMode("billing")}
        className={`relative z-[1] flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold tracking-wide transition duration-200 ease-out ${
          mode === "billing"
            ? "border-[var(--gs-grid)] bg-[var(--gs-surface-plain)] text-[var(--gs-text)] shadow-[0_6px_14px_-10px_rgba(58,42,31,0.45)]"
            : "border-[var(--gs-border)]/85 bg-[var(--gs-surface)]/75 text-[var(--gs-text-secondary)] hover:border-[var(--gs-border)] hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]"
        }`}
      >
        Billing
      </button>
    </div>
  );

  const modeHint = (
    <p className="text-right text-xs text-[var(--gs-text-secondary)]">
      {mode === "billing" ? "Bill" : "Purchase"}&nbsp;#
      <span className="font-mono font-medium text-[var(--gs-text)]">{nextNumber}</span>
      &nbsp;·&nbsp;Enter → next · C/U · Ctrl+Enter → save
    </p>
  );

  const modeToolbar = (
    <div className="flex w-full flex-col gap-2">
      {modeTablist}
      {modeHint}
    </div>
  );

  // ---- render --------------------------------------------------------------
  return (
    <div
      className={cn(
        !embedded && "space-y-8",
        embedded && "flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
      )}
    >
      {embedded ? (
        <div className="shrink-0 border-b border-[var(--gs-grid)] bg-[var(--gs-surface)]">
          <div className="w-full py-1.5">{modeTablist}</div>
          <div className="px-4 pb-2 pt-0.5 md:px-6">{modeHint}</div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* FORM                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={cn(
          "space-y-5",
          embedded && "px-4 py-4 md:px-6 md:py-5"
        )}
      >
        {!embedded ? modeToolbar : null}

        {/* Row 1: party, date, ref */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">{partyLabel}</span>
            <EntityCombobox
              ref={partyRef}
              aria-label={partyLabel}
              valueId={partyId}
              options={partyOptions}
              priorityIds={recentPartyIds}
              invalid={partyMissing}
              placeholder={`Type to search ${partyLabel.toLowerCase()}…`}
              onValueChange={onPartyPick}
              onAdvance={() => dateRef.current?.focus()}
              onCreateOption={handleCreateContact}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">Date</span>
            <div className="flex gap-2">
              <Input
                ref={dateRef}
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  refNumberRef.current?.focus();
                }}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 self-stretch px-3"
                onClick={() => setTxDate(new Date().toISOString().slice(0, 10))}
              >
                Today
              </Button>
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">{refLabel}</span>
            <Input
              ref={refNumberRef}
              placeholder="Optional"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                addressRef.current?.focus();
              }}
            />
          </label>
        </div>

        {/* Row 2: address, phone, payment */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Address (optional)
            </span>
            <Input
              ref={addressRef}
              placeholder="Street, city…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                phoneRef.current?.focus();
              }}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Phone (optional)
            </span>
            <Input
              ref={phoneRef}
              type="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                paymentCashRef.current?.focus();
              }}
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Payment (Cash / Credit)
            </span>
            <div
              className="flex rounded border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] p-0.5"
              role="radiogroup"
              aria-label="Payment type"
            >
              <button
                ref={paymentCashRef}
                type="button"
                role="radio"
                aria-checked={paymentType === "cash"}
                className={`flex-1 rounded px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--gs-primary)] ${
                  paymentType === "cash"
                    ? "bg-[var(--gs-primary)] text-[var(--gs-surface-plain)]"
                    : "text-[var(--gs-text-secondary)] hover:bg-[var(--gs-surface-hover)]"
                }`}
                onClick={() => setPaymentType("cash")}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  itemRefs.current[0]?.focus();
                }}
              >
                Cash
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={paymentType === "credit"}
                className={`flex-1 rounded px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--gs-primary)] ${
                  paymentType === "credit"
                    ? "bg-[var(--gs-primary)] text-[var(--gs-surface-plain)]"
                    : "text-[var(--gs-text-secondary)] hover:bg-[var(--gs-surface-hover)]"
                }`}
                onClick={() => setPaymentType("credit")}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  itemRefs.current[0]?.focus();
                }}
              >
                Credit
              </button>
            </div>
            <p className="text-[11px] text-[var(--gs-text-secondary)]">
              Press <kbd className="font-mono">C</kbd> or{" "}
              <kbd className="font-mono">U</kbd> when focus is not in a text field.
            </p>
          </div>
        </div>

        {/* Purchase-only: note */}
        {mode === "purchase" ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Note (optional)
            </span>
            <Input
              placeholder="Internal note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        ) : null}

        {/* Item composer + line review */}
        <div className="space-y-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] p-3 md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
              Lines
            </p>
            <p className="text-sm font-medium tabular-nums text-[var(--gs-text)]">
              Total{" "}
              <span className="font-mono">{formatINR(liveTotals.grand)}</span>
            </p>
          </div>

          {lines.length > 0 ? (
            (() => {
              const composerIndex = lines.length - 1;
              const composerLine = lines[composerIndex]!;
              const composerIssue = lineIssues[composerIndex];
              const composerTotal = liveTotals.rowTotals[composerIndex];
              const composerItem = composerLine.item_id
                ? itemById.get(composerLine.item_id)
                : null;
              const composerStock = composerLine.item_id
                ? stockByItemId.get(composerLine.item_id) ?? 0
                : null;
              const composerStockWarn =
                liveTotals.stockWarnings[composerIndex] ?? false;
              const reviewIndexes = lines
                .map((line, idx) => ({ line, idx }))
                .filter(
                  ({ line, idx }) =>
                    idx !== composerIndex &&
                    (line.item_id || line.qty !== "1" || line.rate !== "")
                )
                .map(({ idx }) => idx);

              return (
                <div className="space-y-3">
                  <div className="space-y-2 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
                        Item composer
                      </p>
                      <p className="text-[11px] text-[var(--gs-text-secondary)]">
                        Enter on rate adds next line.
                      </p>
                      {composerStock != null ? (
                        <p
                          className={cn(
                            "text-xs",
                            composerStockWarn
                              ? "text-[var(--gs-danger)]"
                              : "text-[var(--gs-text-secondary)]"
                          )}
                        >
                          Available stock:{" "}
                          <span className="font-mono">
                            {composerStock}
                            {composerItem?.unit ? ` ${composerItem.unit}` : ""}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    {composerStockWarn ? (
                      <p className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-2 py-1 text-xs text-[var(--gs-danger)]">
                        Quantity exceeds available stock.
                      </p>
                    ) : null}
                    <div
                      className={cn(
                        "grid gap-2",
                        mode === "purchase"
                          ? "md:grid-cols-[2.2fr_0.8fr_1fr_1fr_1fr_auto]"
                          : "md:grid-cols-[2.6fr_0.9fr_1fr_1fr_auto]"
                      )}
                    >
                      <EntityCombobox
                        ref={(el) => {
                          itemRefs.current[composerIndex] = el;
                        }}
                        aria-label="Item composer item"
                        valueId={composerLine.item_id}
                        options={itemOptions}
                        priorityIds={recentItemIds}
                        placeholder="Search or create item…"
                        onValueChange={(id) => onItemPick(composerIndex, id)}
                        onAdvance={() => qtyRefs.current[composerIndex]?.focus()}
                        onCreateOption={(label) =>
                          void handleCreateItem(composerIndex, label)
                        }
                        createLabel="item"
                      />
                      <Input
                        ref={(el) => {
                          qtyRefs.current[composerIndex] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        placeholder={qtyPlaceholder(composerItem?.unit)}
                        value={composerLine.qty}
                        aria-invalid={composerIssue?.qty || undefined}
                        onChange={(e) => {
                          updateLine(composerIndex, { qty: e.target.value });
                          clearLineIssue(composerIndex, "qty");
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          rateRefs.current[composerIndex]?.focus();
                        }}
                        className={cn(
                          "font-mono tabular-nums text-right",
                          composerIssue?.qty && "border-[var(--gs-warning)]"
                        )}
                      />
                      <Input
                        ref={(el) => {
                          rateRefs.current[composerIndex] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        placeholder={mode === "billing" ? "Rate" : "Cost"}
                        value={composerLine.rate}
                        aria-invalid={composerIssue?.rate || undefined}
                        onChange={(e) => {
                          updateLine(composerIndex, { rate: e.target.value });
                          clearLineIssue(composerIndex, "rate");
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          onRateEnter(composerIndex);
                        }}
                        className={cn(
                          "font-mono tabular-nums text-right",
                          composerIssue?.rate && "border-[var(--gs-warning)]"
                        )}
                      />
                      <div className="rounded border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-3 py-2 text-right font-mono text-sm text-[var(--gs-text)]">
                        {composerTotal != null ? formatINR(composerTotal) : "—"}
                      </div>
                      {mode === "purchase" ? (
                        <select
                          ref={(el) => {
                            destRefs.current[composerIndex] = el;
                          }}
                          value={composerLine.destination}
                          onChange={(e) =>
                            updateLine(composerIndex, {
                              destination: e.target.value as "shop" | "godown",
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            onDestEnter(composerIndex);
                          }}
                          aria-label="Composer destination"
                          className="w-full rounded border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-2 py-2 text-sm text-[var(--gs-text)] focus:border-[var(--gs-primary)] focus:outline-none"
                        >
                          <option value="godown">Godown</option>
                          <option value="shop">Shop</option>
                        </select>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-full min-h-[2.5rem]"
                        onClick={() => {
                          if (!composerLine.item_id) {
                            itemRefs.current[composerIndex]?.focus();
                            return;
                          }
                          onRateEnter(composerIndex);
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
                      Line review
                    </p>
                    {reviewIndexes.length === 0 ? (
                      <p className="rounded border border-dashed border-[var(--gs-border)] px-3 py-2 text-sm text-[var(--gs-text-secondary)]">
                        Added lines will appear here for quick review and edits.
                      </p>
                    ) : (
                      reviewIndexes.map((i) => {
                        const line = lines[i]!;
                        const rowIssue = lineIssues[i];
                        const rowTotal = liveTotals.rowTotals[i];
                        const stockWarn = liveTotals.stockWarnings[i] ?? false;
                        const rowItem = line.item_id ? itemById.get(line.item_id) : null;
                        const stock = line.item_id
                          ? stockByItemId.get(line.item_id) ?? 0
                          : null;

                        return (
                          <div
                            key={i}
                            className={cn(
                              "space-y-2 rounded-lg border p-3 transition-colors",
                              rowIssue?.qty || rowIssue?.rate
                                ? "border-[var(--gs-warning)]/45 bg-[var(--gs-warning-soft)]"
                                : stockWarn
                                ? "border-[var(--gs-danger)]/40 bg-[var(--gs-danger-soft)]"
                                : "border-[var(--gs-border)] bg-[var(--gs-surface)]"
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-[var(--gs-text-secondary)]">
                                Line {i + 1}
                                {stock != null ? (
                                  <>
                                    {" "}
                                    · Available:{" "}
                                    <span className="font-mono">
                                      {stock}
                                      {rowItem?.unit ? ` ${rowItem.unit}` : ""}
                                    </span>
                                  </>
                                ) : null}
                              </p>
                              <button
                                type="button"
                                aria-label={`Remove line ${i + 1}`}
                                onClick={() =>
                                  setLines((prev) => prev.filter((_, j) => j !== i))
                                }
                                className="rounded px-2 py-1 text-xs text-[var(--gs-text-secondary)] transition hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-danger)]"
                              >
                                Remove
                              </button>
                            </div>
                            {stockWarn ? (
                              <p className="text-xs text-[var(--gs-danger)]">
                                Quantity exceeds available stock.
                              </p>
                            ) : null}
                            <div
                              className={cn(
                                "grid gap-2",
                                mode === "purchase"
                                  ? "md:grid-cols-[2.2fr_0.8fr_1fr_1fr_1fr]"
                                  : "md:grid-cols-[2.6fr_0.9fr_1fr_1fr]"
                              )}
                            >
                              <EntityCombobox
                                ref={(el) => {
                                  itemRefs.current[i] = el;
                                }}
                                aria-label={`Line ${i + 1} item`}
                                valueId={line.item_id}
                                options={itemOptions}
                                priorityIds={recentItemIds}
                                placeholder="Search item…"
                                onValueChange={(id) => onItemPick(i, id)}
                                onAdvance={() => qtyRefs.current[i]?.focus()}
                                onCreateOption={(label) => void handleCreateItem(i, label)}
                                createLabel="item"
                              />
                              <Input
                                ref={(el) => {
                                  qtyRefs.current[i] = el;
                                }}
                                type="text"
                                inputMode="decimal"
                                placeholder={qtyPlaceholder(rowItem?.unit)}
                                value={line.qty}
                                aria-invalid={rowIssue?.qty || undefined}
                                onChange={(e) => {
                                  updateLine(i, { qty: e.target.value });
                                  clearLineIssue(i, "qty");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  rateRefs.current[i]?.focus();
                                }}
                                className={cn(
                                  "font-mono tabular-nums text-right",
                                  rowIssue?.qty && "border-[var(--gs-warning)]"
                                )}
                              />
                              <Input
                                ref={(el) => {
                                  rateRefs.current[i] = el;
                                }}
                                type="text"
                                inputMode="decimal"
                                placeholder={mode === "billing" ? "Rate" : "Cost"}
                                value={line.rate}
                                aria-invalid={rowIssue?.rate || undefined}
                                onChange={(e) => {
                                  updateLine(i, { rate: e.target.value });
                                  clearLineIssue(i, "rate");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  onRateEnter(i);
                                }}
                                className={cn(
                                  "font-mono tabular-nums text-right",
                                  rowIssue?.rate && "border-[var(--gs-warning)]"
                                )}
                              />
                              <div className="rounded border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-3 py-2 text-right font-mono text-sm text-[var(--gs-text)]">
                                {rowTotal != null ? formatINR(rowTotal) : "—"}
                              </div>
                              {mode === "purchase" ? (
                                <select
                                  ref={(el) => {
                                    destRefs.current[i] = el;
                                  }}
                                  value={line.destination}
                                  onChange={(e) =>
                                    updateLine(i, {
                                      destination: e.target.value as "shop" | "godown",
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key !== "Enter") return;
                                    e.preventDefault();
                                    onDestEnter(i);
                                  }}
                                  aria-label={`Line ${i + 1} destination`}
                                  className="w-full rounded border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-2 py-2 text-sm text-[var(--gs-text)] focus:border-[var(--gs-primary)] focus:outline-none"
                                >
                                  <option value="godown">Godown</option>
                                  <option value="shop">Shop</option>
                                </select>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()
          ) : null}
        </div>

        {/* Messages */}
        {err ? (
          <p
            role="alert"
            aria-live="polite"
            className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]"
          >
            {err}
          </p>
        ) : null}
        {msg ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded border border-[var(--gs-success)]/30 bg-[var(--gs-success-soft)] px-3 py-2 text-sm text-[var(--gs-success)]"
          >
            {msg}
          </p>
        ) : null}

        {/* Save */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* HISTORY                                                             */}
      {/* ------------------------------------------------------------------ */}
      {mode === "billing" ? (
        <section
          className={cn(
            "space-y-3 border-t",
            embedded
              ? "border-[var(--gs-grid)] px-4 pb-4 pt-6 md:px-6 md:pb-6"
              : "border-[var(--gs-border)] pt-8"
          )}
        >
          <h2 className="text-sm font-medium text-[var(--gs-text)]">Saved bills</h2>
          <p className="text-xs text-[var(--gs-text-secondary)]">
            Delete a bill to undo the sale and free items for deletion from the
            inventory sheet.
          </p>
          <div className="overflow-x-auto rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface-plain)]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--gs-border)] bg-[var(--gs-surface)] text-[11px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
                  <th className="w-12 px-3 py-2">#</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="w-24 px-3 py-2 text-center"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--gs-grid)]">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--gs-surface)]">
                    <td className="px-3 py-2 font-mono text-xs text-[var(--gs-text-secondary)]">
                      {b.bill_number != null ? `#${b.bill_number}` : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--gs-text-secondary)]">
                      {b.bill_date}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[var(--gs-text)]">
                      {b.party_name_snapshot}
                    </td>
                    <td className="px-3 py-2 capitalize text-[var(--gs-text-secondary)]">
                      {b.bill_type}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--gs-text)]">
                      {formatINR(b.total)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        aria-label={`Delete bill for ${b.party_name_snapshot} on ${b.bill_date}`}
                        className="text-xs text-[var(--gs-text-secondary)] hover:text-[var(--gs-danger)]"
                        onClick={() => void onDeleteBill(b.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bills.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[var(--gs-text-secondary)]">
                No bills yet.
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <section
          className={cn(
            "space-y-3 border-t",
            embedded
              ? "border-[var(--gs-grid)] px-4 pb-4 pt-6 md:px-6 md:pb-6"
              : "border-[var(--gs-border)] pt-8"
          )}
        >
          <h2 className="text-sm font-medium text-[var(--gs-text)]">Purchase history</h2>
          <p className="text-xs text-[var(--gs-text-secondary)]">
            Delete a purchase to reverse stock and remove the ledger entry.
          </p>
          <div className="overflow-x-auto rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface-plain)]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--gs-border)] bg-[var(--gs-surface)] text-[11px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)]">
                  <th className="w-12 px-3 py-2">#</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="w-24 px-3 py-2 text-center"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--gs-grid)]">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--gs-surface)]">
                    <td className="px-3 py-2 font-mono text-xs text-[var(--gs-text-secondary)]">
                      #{p.purchase_number}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--gs-text-secondary)]">
                      {p.purchase_date}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[var(--gs-text)]">
                      {p.party_name_snapshot}
                    </td>
                    <td className="px-3 py-2 capitalize text-[var(--gs-text-secondary)]">
                      {p.payment_type}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--gs-text)]">
                      {formatINR(p.total)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        aria-label={`Delete purchase #${p.purchase_number} from ${p.party_name_snapshot} on ${p.purchase_date}`}
                        className="text-xs text-[var(--gs-text-secondary)] hover:text-[var(--gs-danger)]"
                        onClick={() =>
                          void onDeletePurchase(
                            p.id,
                            `#${p.purchase_number} from ${p.party_name_snapshot}`
                          )
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {purchases.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[var(--gs-text-secondary)]">
                No purchases yet.
              </p>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
