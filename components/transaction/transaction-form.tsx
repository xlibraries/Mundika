"use client";

import {
  Fragment,
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
import type {
  BillRow,
  InventoryRow,
  ItemRow,
  PartyRow,
  PurchaseRow,
} from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/format/inr";
import {
  EntityCombobox,
  type EntityComboboxHandle,
} from "@/components/billing/entity-combobox";
import { rememberId, readRecentIds } from "@/lib/billing/recent-ids";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransactionFormProps = {
  defaultMode?: "billing" | "purchase";
  userId: string;
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
}: TransactionFormProps) {
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
  }, [userId, loadBills, loadPurchases]);

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

  // ---- render --------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* FORM                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-5">

        {/* Mode switch + auto number */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex rounded border border-[#dadce0] bg-[#f8f9fa] p-0.5"
            role="tablist"
            aria-label="Transaction mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "billing"}
              onClick={() => switchMode("billing")}
              className={`rounded px-4 py-1.5 text-sm font-medium transition ${
                mode === "billing"
                  ? "bg-white shadow-sm text-[#202124]"
                  : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              Billing
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "purchase"}
              onClick={() => switchMode("purchase")}
              className={`rounded px-4 py-1.5 text-sm font-medium transition ${
                mode === "purchase"
                  ? "bg-white shadow-sm text-[#202124]"
                  : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              Purchase
            </button>
          </div>

          <span className="text-xs text-[#5f6368]">
            {mode === "billing" ? "Bill" : "Purchase"}&nbsp;#
            <span className="font-mono font-medium text-[#202124]">
              {nextNumber}
            </span>
            &nbsp;·&nbsp;Enter → next · C/U · Ctrl+Enter → save
          </span>
        </div>

        {/* Row 1: party, date, ref */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[#5f6368]">{partyLabel}</span>
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
            <span className="text-xs font-medium text-[#5f6368]">Date</span>
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
            <span className="text-xs font-medium text-[#5f6368]">{refLabel}</span>
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
            <span className="text-xs font-medium text-[#5f6368]">
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
            <span className="text-xs font-medium text-[#5f6368]">
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
            <span className="text-xs font-medium text-[#5f6368]">
              Payment (Cash / Credit)
            </span>
            <div
              className="flex rounded border border-[#dadce0] bg-white p-0.5"
              role="radiogroup"
              aria-label="Payment type"
            >
              <button
                ref={paymentCashRef}
                type="button"
                role="radio"
                aria-checked={paymentType === "cash"}
                className={`flex-1 rounded px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a73e8] ${
                  paymentType === "cash"
                    ? "bg-[#1a73e8] text-white"
                    : "text-[#5f6368] hover:bg-[#f1f3f4]"
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
                className={`flex-1 rounded px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a73e8] ${
                  paymentType === "credit"
                    ? "bg-[#1a73e8] text-white"
                    : "text-[#5f6368] hover:bg-[#f1f3f4]"
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
            <p className="text-[11px] text-[#80868b]">
              Press <kbd className="font-mono">C</kbd> or{" "}
              <kbd className="font-mono">U</kbd> when focus is not in a text field.
            </p>
          </div>
        </div>

        {/* Purchase-only: note */}
        {mode === "purchase" ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#5f6368]">
              Note (optional)
            </span>
            <Input
              placeholder="Internal note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        ) : null}

        {/* Line items table */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[#5f6368]">
              Lines
            </p>
            <p className="text-sm font-medium tabular-nums text-[#202124]">
              Total{" "}
              <span className="font-mono">{formatINR(liveTotals.grand)}</span>
            </p>
          </div>

          <div className="overflow-x-auto rounded-sm border border-[#dadce0] bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#dadce0] bg-[#f8f9fa] text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
                  <th className="px-2 py-1.5 text-left" style={{ width: "38%" }}>
                    Item
                  </th>
                  <th className="px-2 py-1.5 text-right w-20">Qty</th>
                  <th className="px-2 py-1.5 text-right w-24">
                    {mode === "billing" ? "Rate (₹)" : "Cost (₹)"}
                  </th>
                  <th className="px-2 py-1.5 text-right w-24">Total</th>
                  {mode === "purchase" ? (
                    <th className="px-2 py-1.5 text-center w-24">Destination</th>
                  ) : null}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const rowIssue = lineIssues[i];
                  const rowBad = Boolean(rowIssue?.qty || rowIssue?.rate);
                  const rowTotal = liveTotals.rowTotals[i];
                  const stockWarn = liveTotals.stockWarnings[i] ?? false;

                  return (
                    <Fragment key={i}>
                      {/* stock warning banner row */}
                      {stockWarn ? (
                        <tr className="bg-[#fce8e6]">
                          <td
                            colSpan={mode === "purchase" ? 6 : 5}
                            className="px-2 py-1"
                          >
                            <p className="text-[11px] font-medium text-[#c5221f]">
                              Insufficient stock — qty exceeds available (
                              {stockByItemId.get(line.item_id) ?? 0} in stock)
                            </p>
                          </td>
                        </tr>
                      ) : null}
                      {/* main data row */}
                      <tr
                        className={`border-b border-[#e8eaed] ${
                          rowBad
                            ? "bg-[#fef7e0]"
                            : stockWarn
                            ? "bg-[#fce8e6]"
                            : ""
                        }`}
                      >
                        <td className="p-1">
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
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            ref={(el) => {
                              qtyRefs.current[i] = el;
                            }}
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
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
                            className={`w-full font-mono tabular-nums text-right ${
                              rowIssue?.qty ? "border-[#f9ab00]" : ""
                            }`}
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            ref={(el) => {
                              rateRefs.current[i] = el;
                            }}
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
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
                            className={`w-full font-mono tabular-nums text-right ${
                              rowIssue?.rate ? "border-[#f9ab00]" : ""
                            }`}
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-mono tabular-nums text-[#202124] whitespace-nowrap">
                          {rowTotal != null ? formatINR(rowTotal) : "—"}
                        </td>
                        {mode === "purchase" ? (
                          <td className="p-1">
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
                              className="w-full rounded border border-[#dadce0] bg-white px-2 py-2 text-sm text-[#202124] focus:border-[#1a73e8] focus:outline-none"
                            >
                              <option value="godown">Godown</option>
                              <option value="shop">Shop</option>
                            </select>
                          </td>
                        ) : null}
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            aria-label={`Remove line ${i + 1}`}
                            disabled={lines.length <= 1}
                            onClick={() =>
                              setLines((prev) => prev.filter((_, j) => j !== i))
                            }
                            className="rounded px-1.5 py-1 text-sm text-[#5f6368] transition hover:bg-[#f1f3f4] hover:text-[#c5221f] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            + Add line
          </Button>
        </div>

        {/* Messages */}
        {err ? (
          <p
            role="alert"
            aria-live="polite"
            className="rounded border border-[#f9dedc] bg-[#fce8e6] px-3 py-2 text-sm text-[#c5221f]"
          >
            {err}
          </p>
        ) : null}
        {msg ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded border border-[#ceead6] bg-[#e6f4ea] px-3 py-2 text-sm text-[#137333]"
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
        <section className="space-y-3 border-t border-[#dadce0] pt-8">
          <h2 className="text-sm font-medium text-[#202124]">Saved bills</h2>
          <p className="text-xs text-[#5f6368]">
            Delete a bill to undo the sale and free items for deletion from the
            inventory sheet.
          </p>
          <div className="overflow-x-auto rounded-sm border border-[#dadce0] bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dadce0] bg-[#f8f9fa] text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
                  <th className="w-12 px-3 py-2">#</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="w-24 px-3 py-2 text-center"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8eaed]">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-[#f8f9fa]">
                    <td className="px-3 py-2 font-mono text-xs text-[#5f6368]">
                      {b.bill_number ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#5f6368]">
                      {b.bill_date}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[#202124]">
                      {b.party_name_snapshot}
                    </td>
                    <td className="px-3 py-2 capitalize text-[#5f6368]">
                      {b.bill_type}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[#202124]">
                      {formatINR(b.total)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        aria-label={`Delete bill for ${b.party_name_snapshot} on ${b.bill_date}`}
                        className="text-xs text-[#5f6368] hover:text-[#c5221f]"
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
              <p className="px-3 py-8 text-center text-sm text-[#5f6368]">
                No bills yet.
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="space-y-3 border-t border-[#dadce0] pt-8">
          <h2 className="text-sm font-medium text-[#202124]">Purchase history</h2>
          <p className="text-xs text-[#5f6368]">
            Delete a purchase to reverse stock and remove the ledger entry.
          </p>
          <div className="overflow-x-auto rounded-sm border border-[#dadce0] bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dadce0] bg-[#f8f9fa] text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
                  <th className="w-12 px-3 py-2">#</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="w-24 px-3 py-2 text-center"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8eaed]">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-[#f8f9fa]">
                    <td className="px-3 py-2 font-mono text-xs text-[#5f6368]">
                      {p.purchase_number}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#5f6368]">
                      {p.purchase_date}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[#202124]">
                      {p.party_name_snapshot}
                    </td>
                    <td className="px-3 py-2 capitalize text-[#5f6368]">
                      {p.payment_type}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[#202124]">
                      {formatINR(p.total)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        aria-label={`Delete purchase #${p.purchase_number} from ${p.party_name_snapshot} on ${p.purchase_date}`}
                        className="text-xs text-[#5f6368] hover:text-[#c5221f]"
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
              <p className="px-3 py-8 text-center text-sm text-[#5f6368]">
                No purchases yet.
              </p>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
