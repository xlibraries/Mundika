"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { db } from "@/lib/db";
import { createPurchase } from "@/modules/purchases/actions";
import { deletePurchase } from "@/modules/purchases/delete";
import { createParty } from "@/modules/parties/actions";
import type {
  ItemRow,
  PartyRow,
  PurchasePaymentType,
  PurchaseRow,
} from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/format/inr";
import {
  EntityCombobox,
  type EntityComboboxHandle,
} from "@/components/billing/entity-combobox";
import { rememberId, readRecentIds } from "@/lib/billing/recent-ids";

type Line = {
  item_id: string;
  qty: string;
  unit_cost: string;
  destination: "shop" | "godown";
};

type LineIssue = { qty?: boolean; unit_cost?: boolean };

function parseFilledLine(l: Line): {
  ok: boolean;
  qty: number;
  unit_cost: number;
  issue?: LineIssue;
} {
  const qty = Number(l.qty);
  const unit_cost = Number(l.unit_cost);
  const badQty = !(qty > 0);
  const badCost = unit_cost < 0 || Number.isNaN(unit_cost);
  if (badQty || badCost) {
    return {
      ok: false,
      qty: 0,
      unit_cost: 0,
      issue: { qty: badQty, unit_cost: badCost },
    };
  }
  return { ok: true, qty, unit_cost };
}

export default function PurchasesPage() {
  const { userId, loading } = useUserId();
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);

  const [partyId, setPartyId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [refNumber, setRefNumber] = useState("");
  const [paymentType, setPaymentType] = useState<PurchasePaymentType>("cash");
  const [lines, setLines] = useState<Line[]>([
    { item_id: "", qty: "1", unit_cost: "", destination: "shop" },
  ]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [lineIssues, setLineIssues] = useState<Record<number, LineIssue>>({});
  const [partyMissing, setPartyMissing] = useState(false);
  const [recentPartyIds, setRecentPartyIds] = useState<string[]>([]);
  const [recentItemIds, setRecentItemIds] = useState<string[]>([]);

  const partyRef = useRef<EntityComboboxHandle>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const refNumberRef = useRef<HTMLInputElement>(null);
  const paymentCashRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(EntityComboboxHandle | null)[]>([]);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const costRefs = useRef<(HTMLInputElement | null)[]>([]);
  const destRefs = useRef<(HTMLSelectElement | null)[]>([]);

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

  const loadPurchases = useCallback(async () => {
    if (!userId) return;
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

  useEffect(() => {
    if (!userId) return;
    const t = window.setTimeout(() => {
      setRecentPartyIds(readRecentIds("parties"));
      setRecentItemIds(readRecentIds("items"));
      void Promise.all([
        db.parties.where("user_id").equals(userId).toArray(),
        db.items.where("user_id").equals(userId).toArray(),
      ]).then(([p, i]) => {
        p.sort((a, b) => a.name.localeCompare(b.name));
        i.sort((a, b) => a.name.localeCompare(b.name));
        setParties(p);
        setItems(i);
      });
      void loadPurchases();
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId, loadPurchases]);

  useEffect(() => {
    if (loading || !userId) return;
    const t = window.setTimeout(() => partyRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [loading, userId]);

  useEffect(() => {
    itemRefs.current.length = lines.length;
    qtyRefs.current.length = lines.length;
    costRefs.current.length = lines.length;
    destRefs.current.length = lines.length;
  }, [lines.length]);

  // Auto-clear success message after 4 s
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [msg]);

  // Warn before navigating away when form has unsaved data
  const isDirty =
    partyId !== "" ||
    refNumber !== "" ||
    lines.some((l) => l.item_id || l.qty !== "1" || l.unit_cost !== "");
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const liveTotals = useMemo(() => {
    const rowTotals: (number | null)[] = [];
    let grand = 0;
    for (const line of lines) {
      if (!line.item_id) {
        rowTotals.push(null);
        continue;
      }
      const p = parseFilledLine(line);
      if (!p.ok) {
        rowTotals.push(null);
        continue;
      }
      const t = Math.round(p.qty * p.unit_cost * 100) / 100;
      grand += t;
      rowTotals.push(t);
    }
    const grandRounded = Math.round(grand * 100) / 100;
    return { rowTotals, grand: grandRounded };
  }, [lines]);

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

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => {
      const next = [...prev];
      const row = next[i];
      if (!row) return prev;
      next[i] = { ...row, ...patch };
      return next;
    });
  }

  const handleSave = useCallback(async () => {
    if (!userId || isSaving) return;
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
        else costRefs.current[first]?.focus();
        return;
      }

      const parsedLines = filledLines.map((l) => ({
        item_id: l.item_id,
        qty: Number(l.qty),
        unit_cost: Number(l.unit_cost),
        destination: l.destination,
      }));

      const { purchase } = await createPurchase(userId, {
        party_id: partyId,
        party_name_snapshot: party.name,
        purchase_date: purchaseDate,
        ref_number: refNumber || null,
        payment_type: paymentType,
        lines: parsedLines,
        note: note || null,
      });

      setMsg(
        `Purchase #${purchase.purchase_number} saved · ${formatINR(purchase.total)}`
      );
      setLines([{ item_id: "", qty: "1", unit_cost: "", destination: "shop" }]);
      setRefNumber("");
      setNote("");
      await loadPurchases();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Could not save purchase");
    } finally {
      setIsSaving(false);
    }
  }, [
    userId,
    isSaving,
    partyId,
    parties,
    purchaseDate,
    refNumber,
    paymentType,
    lines,
    note,
    loadPurchases,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-purchases-stop-shortcut]")) return;
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

  function onPartyPick(id: string) {
    setPartyId(id);
    setPartyMissing(false);
    rememberId("parties", id);
    setRecentPartyIds(readRecentIds("parties"));
  }

  async function handleCreateSupplier(name: string) {
    if (!userId) return;
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
      setErr("Could not create supplier");
    }
  }

  function onItemPick(i: number, id: string) {
    setLines((prev) => {
      const next = [...prev];
      const row = next[i];
      if (!row) return prev;
      next[i] = { ...row, item_id: id };
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

  function onCostEnter(i: number) {
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
      else costRefs.current[i]?.focus();
      return;
    }
    setLineIssues((prev) => {
      if (!prev[i]) return prev;
      const copy = { ...prev };
      delete copy[i];
      return copy;
    });
    // Move to destination select
    destRefs.current[i]?.focus();
  }

  function onDestEnter(i: number) {
    if (i < lines.length - 1) {
      requestAnimationFrame(() => itemRefs.current[i + 1]?.focus());
      return;
    }
    setLines((prev) => {
      const next = [
        ...prev,
        { item_id: "", qty: "1", unit_cost: "", destination: "shop" as const },
      ];
      const ni = next.length - 1;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => itemRefs.current[ni]?.focus());
      });
      return next;
    });
  }

  async function onDeletePurchase(purchaseId: string, label: string) {
    if (!userId) return;
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

  if (loading || !userId) {
    return (
      <div className="h-40 animate-pulse rounded border border-[#dadce0] bg-[#f8f9fa]" />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="New purchase"
        description="Record stock received from a supplier. Stock is added to the selected destination (shop or godown). Enter moves through fields; C / U set cash or credit when not typing; Ctrl+Enter saves."
        actions={
          <span className="text-xs text-[#5f6368]">
            Enter → next · C/U · Ctrl+Enter → save
          </span>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[#5f6368]">
              Supplier
            </span>
            <EntityCombobox
              ref={partyRef}
              aria-label="Supplier"
              valueId={partyId}
              options={partyOptions}
              priorityIds={recentPartyIds}
              invalid={partyMissing}
              placeholder="Type to search supplier…"
              onValueChange={onPartyPick}
              onAdvance={() => dateRef.current?.focus()}
              onCreateOption={handleCreateSupplier}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[#5f6368]">Date</span>
            <div className="flex gap-2">
              <Input
                ref={dateRef}
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
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
                onClick={() =>
                  setPurchaseDate(new Date().toISOString().slice(0, 10))
                }
              >
                Today
              </Button>
            </div>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[#5f6368]">
              Supplier Ref / Bill No.
            </span>
            <Input
              ref={refNumberRef}
              placeholder="Optional"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
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
              <kbd className="font-mono">U</kbd> when focus is not in a text
              field.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[#5f6368]">
              Lines
            </p>
            <p className="text-sm font-medium tabular-nums text-[#202124]">
              Total{" "}
              <span className="font-mono">{formatINR(liveTotals.grand)}</span>
            </p>
          </div>
          {lines.map((line, i) => {
            const rowIssue = lineIssues[i];
            const rowBad = Boolean(rowIssue?.qty || rowIssue?.unit_cost);
            const rowTotal = liveTotals.rowTotals[i];
            return (
              <div
                key={i}
                className={`grid gap-3 rounded-sm border p-3 sm:grid-cols-12 sm:items-end ${
                  rowBad
                    ? "border-[#f9ab00] bg-[#fef7e0]"
                    : "border-[#dadce0] bg-[#f8f9fa]"
                }`}
              >
                <label className="space-y-1.5 sm:col-span-4">
                  <span className="text-[11px] text-[#5f6368]">Item</span>
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
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] text-[#5f6368]">Qty</span>
                  <Input
                    ref={(el) => {
                      qtyRefs.current[i] = el;
                    }}
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
                      costRefs.current[i]?.focus();
                    }}
                    className={`font-mono tabular-nums ${
                      rowIssue?.qty ? "border-[#f9ab00]" : ""
                    }`}
                  />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] text-[#5f6368]">
                    Unit Cost (INR)
                  </span>
                  <Input
                    ref={(el) => {
                      costRefs.current[i] = el;
                    }}
                    inputMode="decimal"
                    placeholder="0"
                    value={line.unit_cost}
                    aria-invalid={rowIssue?.unit_cost || undefined}
                    onChange={(e) => {
                      updateLine(i, { unit_cost: e.target.value });
                      clearLineIssue(i, "unit_cost");
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      onCostEnter(i);
                    }}
                    className={`font-mono tabular-nums ${
                      rowIssue?.unit_cost ? "border-[#f9ab00]" : ""
                    }`}
                  />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] text-[#5f6368]">Destination</span>
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
                    className="w-full rounded border border-[#dadce0] bg-white px-2 py-2 text-sm text-[#202124] focus:border-[#1a73e8] focus:outline-none"
                    aria-label={`Line ${i + 1} destination`}
                  >
                    <option value="shop">Shop</option>
                    <option value="godown">Godown</option>
                  </select>
                </label>
                <div className="flex flex-col justify-end sm:col-span-1">
                  <span className="text-[11px] text-[#5f6368]">Line</span>
                  <p className="py-2 text-right font-mono text-sm tabular-nums text-[#202124]">
                    {rowTotal != null ? formatINR(rowTotal) : "—"}
                  </p>
                </div>
                <div className="flex sm:col-span-1 sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[#5f6368] hover:text-[#202124]"
                    disabled={lines.length <= 1}
                    onClick={() =>
                      setLines((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setLines((prev) => [
                ...prev,
                {
                  item_id: "",
                  qty: "1",
                  unit_cost: "",
                  destination: "shop",
                },
              ]);
            }}
          >
            + Add line
          </Button>
        </div>

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

        {err ? (
          <p
            role="alert"
            aria-live="assertive"
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving…" : "Save purchase"}
          </Button>
        </div>
      </div>

      <section className="space-y-3 border-t border-[#dadce0] pt-8">
        <h2 className="text-sm font-medium text-[#202124]">
          Purchase history
        </h2>
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
    </div>
  );
}
