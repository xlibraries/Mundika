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
import type { BillRow, BillType, ItemRow, PartyRow } from "@/lib/types/domain";
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

type Line = { item_id: string; qty: string; rate: string };

type LineIssue = { qty?: boolean; rate?: boolean };

type PrintBill = {
  id: string;
  bill_date: string;
  party_name: string;
  bill_type: BillType;
  vehicle: string | null;
  total: number;
  lines: { name: string; qty: number; rate: number; line_total: number }[];
};

function parseFilledLine(l: Line): {
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

export default function BillingPage() {
  const { userId, loading } = useUserId();
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);

  const [partyId, setPartyId] = useState("");
  const [billDate, setBillDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [billType, setBillType] = useState<BillType>("cash");
  const [vehicle, setVehicle] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { item_id: "", qty: "1", rate: "" },
  ]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [lineIssues, setLineIssues] = useState<Record<number, LineIssue>>({});
  const [partyMissing, setPartyMissing] = useState(false);
  const [recentPartyIds, setRecentPartyIds] = useState<string[]>([]);
  const [recentItemIds, setRecentItemIds] = useState<string[]>([]);
  const [printBill, setPrintBill] = useState<PrintBill | null>(null);

  const partyRef = useRef<EntityComboboxHandle>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const paymentCashRef = useRef<HTMLButtonElement>(null);
  const vehicleRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(EntityComboboxHandle | null)[]>([]);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rateRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const loadBills = useCallback(async () => {
    if (!userId) return;
    const list = await db.bills.where("user_id").equals(userId).toArray();
    list.sort((a, b) =>
      a.bill_date < b.bill_date ? 1 : a.bill_date > b.bill_date ? -1 : 0
    );
    setBills(list);
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
      void loadBills();
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId, loadBills]);

  useEffect(() => {
    if (loading || !userId) return;
    const t = window.setTimeout(() => partyRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [loading, userId]);

  useEffect(() => {
    function afterPrint() {
      setPrintBill(null);
    }
    window.addEventListener("afterprint", afterPrint);
    return () => window.removeEventListener("afterprint", afterPrint);
  }, []);

  useEffect(() => {
    itemRefs.current.length = lines.length;
    qtyRefs.current.length = lines.length;
    rateRefs.current.length = lines.length;
  }, [lines.length]);

  // Auto-clear success message after 4 s (#8)
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [msg]);

  // Warn before navigating away when form has unsaved data (#10)
  const isDirty = partyId !== "" || lines.some((l) => l.item_id || l.qty !== "1" || l.rate !== "");
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
      const t = Math.round(p.qty * p.rate * 100) / 100;
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

  const handleSave = useCallback(
    async (printAfter: boolean) => {
      if (!userId || isSaving) return;
      setIsSaving(true);
      setErr(null);
      setMsg(null);
      setPartyMissing(false);
      setLineIssues({});

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

      const parsed = lines
        .filter((l) => l.item_id)
        .map((l) => ({
          item_id: l.item_id,
          qty: Number(l.qty),
          rate: Number(l.rate),
        }));

      if (parsed.length === 0) {
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
        const first = Number(Object.keys(issues).sort((a, b) => Number(a) - Number(b))[0]);
        if (issues[first]?.qty) qtyRefs.current[first]?.focus();
        else rateRefs.current[first]?.focus();
        return;
      }

      try {
        const { bill } = await createBill(userId, {
          party_id: partyId,
          party_name_snapshot: party.name,
          bill_date: billDate,
          bill_type: billType,
          vehicle_info: vehicle || null,
          lines: parsed.map((l) => ({
            item_id: l.item_id,
            qty: l.qty,
            rate: l.rate,
          })),
        });
        setMsg(
          `Bill saved · ${bill.id.slice(0, 8)} · ${formatINR(bill.total)}`
        );
        setLines([{ item_id: "", qty: "1", rate: "" }]);
        setVehicle("");
        await loadBills();

        if (printAfter) {
          const slip: PrintBill = {
            id: bill.id,
            bill_date: bill.bill_date,
            party_name: bill.party_name_snapshot,
            bill_type: bill.bill_type,
            vehicle: bill.vehicle_info,
            total: bill.total,
            lines: parsed.map((l) => {
              const name = itemById.get(l.item_id)?.name ?? "Item";
              const line_total = Math.round(l.qty * l.rate * 100) / 100;
              return { name, qty: l.qty, rate: l.rate, line_total };
            }),
          };
          setPrintBill(slip);
          requestAnimationFrame(() => window.print());
        }
      } catch (er) {
        setErr(er instanceof Error ? er.message : "Could not save bill");
      } finally {
        setIsSaving(false);
      }
    },
    [
      userId,
      isSaving,
      partyId,
      parties,
      billDate,
      billType,
      vehicle,
      lines,
      loadBills,
      itemById,
    ]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-billing-stop-shortcut]")) return;
      e.preventDefault();
      void handleSave(false);
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
      setBillType(k === "c" ? "cash" : "credit");
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
    if (i < lines.length - 1) {
      requestAnimationFrame(() => itemRefs.current[i + 1]?.focus());
      return;
    }
    setLines((prev) => {
      const next = [...prev, { item_id: "", qty: "1", rate: "" }];
      const ni = next.length - 1;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => itemRefs.current[ni]?.focus());
      });
      return next;
    });
  }

  async function onDeleteBill(billId: string) {
    if (!userId) return;
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

  if (loading || !userId) {
    return (
      <div className="h-40 animate-pulse rounded border border-[#dadce0] bg-[#f8f9fa]" />
    );
  }

  return (
    <div className="space-y-8">
      <div className="print:hidden">
        <PageHeader
          title="New bill"
          description="Party and items are searchable (type a few letters, Enter). Enter moves through fields; C / U set cash or credit when not typing; Ctrl+Enter saves. Stock is reduced from shop first, then godown."
          actions={
            <span className="text-xs text-[#5f6368]">
              Enter → next · C/U · Ctrl+Enter → save
            </span>
          }
        />

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[#5f6368]">Party</span>
              <EntityCombobox
                ref={partyRef}
                aria-label="Party"
                valueId={partyId}
                options={partyOptions}
                priorityIds={recentPartyIds}
                invalid={partyMissing}
                placeholder="Type to search party…"
                onValueChange={onPartyPick}
                onAdvance={() => dateRef.current?.focus()}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[#5f6368]">Date</span>
              <div className="flex gap-2">
                <Input
                  ref={dateRef}
                  type="date"
                  required
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    paymentCashRef.current?.focus();
                  }}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0 self-stretch px-3"
                  onClick={() =>
                    setBillDate(new Date().toISOString().slice(0, 10))
                  }
                >
                  Today
                </Button>
              </div>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
                  aria-checked={billType === "cash"}
                  className={`flex-1 rounded px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a73e8] ${
                    billType === "cash"
                      ? "bg-[#1a73e8] text-white"
                      : "text-[#5f6368] hover:bg-[#f1f3f4]"
                  }`}
                  onClick={() => setBillType("cash")}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    vehicleRef.current?.focus();
                  }}
                >
                  Cash
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={billType === "credit"}
                  className={`flex-1 rounded px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a73e8] ${
                    billType === "credit"
                      ? "bg-[#1a73e8] text-white"
                      : "text-[#5f6368] hover:bg-[#f1f3f4]"
                  }`}
                  onClick={() => setBillType("credit")}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    vehicleRef.current?.focus();
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
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[#5f6368]">
                Vehicle / owner
              </span>
              <Input
                ref={vehicleRef}
                placeholder="Optional"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  itemRefs.current[0]?.focus();
                }}
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[#5f6368]">
                Lines
              </p>
              <p className="text-sm font-medium tabular-nums text-[#202124]">
                Total <span className="font-mono">{formatINR(liveTotals.grand)}</span>
              </p>
            </div>
            {lines.map((line, i) => {
              const rowIssue = lineIssues[i];
              const rowBad = Boolean(rowIssue?.qty || rowIssue?.rate);
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
                        rateRefs.current[i]?.focus();
                      }}
                      className={`font-mono tabular-nums ${
                        rowIssue?.qty ? "border-[#f9ab00]" : ""
                      }`}
                    />
                  </label>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-[11px] text-[#5f6368]">Rate (INR)</span>
                    <Input
                      ref={(el) => {
                        rateRefs.current[i] = el;
                      }}
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
                      className={`font-mono tabular-nums ${
                        rowIssue?.rate ? "border-[#f9ab00]" : ""
                      }`}
                    />
                  </label>
                  <div className="flex flex-col justify-end sm:col-span-2">
                    <span className="text-[11px] text-[#5f6368]">Line</span>
                    <p className="py-2 text-right font-mono text-sm tabular-nums text-[#202124]">
                      {rowTotal != null ? formatINR(rowTotal) : "—"}
                    </p>
                  </div>
                  <div className="flex sm:col-span-2 sm:justify-end">
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
                  { item_id: "", qty: "1", rate: "" },
                ]);
              }}
            >
              + Add line
            </Button>
          </div>

          {err ? (
            <p role="alert" aria-live="polite" className="rounded border border-[#f9dedc] bg-[#fce8e6] px-3 py-2 text-sm text-[#c5221f]">
              {err}
            </p>
          ) : null}
          {msg ? (
            <p role="status" aria-live="polite" className="rounded border border-[#ceead6] bg-[#e6f4ea] px-3 py-2 text-sm text-[#137333]">
              {msg}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              disabled={isSaving}
              onClick={() => void handleSave(false)}
            >
              {isSaving ? "Saving…" : "Save bill"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={isSaving}
              onClick={() => void handleSave(true)}
            >
              Save &amp; print
            </Button>
          </div>
        </div>

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
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Party</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="w-24 px-3 py-2 text-center"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8eaed]">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-[#f8f9fa]">
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
      </div>

      {printBill ? (
        <div className="hidden print:block">
          <div className="mx-auto max-w-md space-y-4 p-6 font-sans text-black">
            <header className="border-b border-black pb-3">
              <h1 className="text-xl font-semibold">Bill</h1>
              <p className="mt-1 text-sm text-neutral-700">
                {printBill.party_name}
              </p>
              <p className="text-xs text-neutral-600">
                {printBill.bill_date} · {printBill.bill_type}
                {printBill.vehicle ? ` · ${printBill.vehicle}` : ""}
              </p>
              <p className="mt-2 font-mono text-xs text-neutral-500">
                {printBill.id}
              </p>
            </header>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1 pr-2">Item</th>
                  <th className="py-1 pr-2 text-right">Qty</th>
                  <th className="py-1 pr-2 text-right">Rate</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {printBill.lines.map((row, idx) => (
                  <tr key={idx} className="border-b border-neutral-300">
                    <td className="py-1 pr-2">{row.name}</td>
                    <td className="py-1 pr-2 text-right font-mono tabular-nums">
                      {row.qty}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono tabular-nums">
                      {formatINR(row.rate)}
                    </td>
                    <td className="py-1 text-right font-mono tabular-nums">
                      {formatINR(row.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-right text-base font-semibold">
              Total {formatINR(printBill.total)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
