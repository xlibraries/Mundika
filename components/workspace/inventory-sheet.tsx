"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import { getLocalDateInputValue } from "@/lib/date/local-date";
import { createStockTransfer } from "@/modules/inventory/transfer";
import { formatINR } from "@/lib/format/inr";
import type { InventoryRow, ItemRow } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/app-store";

export function InventorySheet({
  userId,
  refreshToken,
  onChanged,
}: {
  userId: string;
  refreshToken: number;
  onChanged?: () => void;
}) {
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [inv, setInv] = useState<InventoryRow[]>([]);
  const [filter, setFilter] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);

  // Transfer panel state
  const [transferItemId, setTransferItemId] = useState<string | null>(null);
  const [transferFrom, setTransferFrom] = useState<"shop" | "godown">("shop");
  const [transferTo, setTransferTo] = useState<"shop" | "godown">("godown");
  const [transferQty, setTransferQty] = useState("1");
  const [transferNote, setTransferNote] = useState("");
  const [transferDate, setTransferDate] = useState(() => getLocalDateInputValue());
  const [transferErr, setTransferErr] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const load = useCallback(async () => {
    const [i, n] = await Promise.all([
      db.items.where("user_id").equals(userId).toArray(),
      db.inventory.where("user_id").equals(userId).toArray(),
    ]);
    i.sort((a, b) => a.name.localeCompare(b.name));
    setItems(i);
    setInv(n);
  }, [userId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load, refreshToken, lastSyncAt]);

  useEffect(() => {
    function onWinKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [role='combobox']")) return;
      e.preventDefault();
      filterRef.current?.focus();
    }
    window.addEventListener("keydown", onWinKey);
    return () => window.removeEventListener("keydown", onWinKey);
  }, []);

  const filteredItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, filter]);

  function invRow(itemId: string, loc: InventoryRow["location"]) {
    return inv.find((r) => r.item_id === itemId && r.location === loc);
  }

  function openTransfer(item: ItemRow) {
    if (transferItemId === item.id) {
      setTransferItemId(null);
      return;
    }
    const shop = invRow(item.id, "shop");
    const godown = invRow(item.id, "godown");
    // Default: from whichever has more stock
    const from: "shop" | "godown" =
      (godown?.qty ?? 0) > (shop?.qty ?? 0) ? "godown" : "shop";
    const to: "shop" | "godown" = from === "shop" ? "godown" : "shop";
    setTransferFrom(from);
    setTransferTo(to);
    setTransferQty("1");
    setTransferNote("");
    setTransferDate(getLocalDateInputValue());
    setTransferErr(null);
    setTransferItemId(item.id);
  }

  async function handleTransfer(item: ItemRow) {
    if (isTransferring) return;
    setIsTransferring(true);
    setTransferErr(null);
    try {
      const qty = Number(transferQty);
      if (!(qty > 0) || !Number.isFinite(qty)) {
        setTransferErr("Quantity must be a positive number");
        return;
      }
      await createStockTransfer(userId, {
        item_id: item.id,
        from_location: transferFrom,
        to_location: transferTo,
        qty,
        note: transferNote || null,
        transfer_date: transferDate,
      });
      setTransferItemId(null);
      await load();
      onChanged?.();
    } catch (e) {
      setTransferErr(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setIsTransferring(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--gs-border)] pb-2">
        <div>
          <h2 className="text-sm font-medium text-[var(--gs-text)]">Inventory</h2>
          <p className="text-[11px] text-[var(--gs-text-secondary)]">
            Read-only view · <kbd className="font-mono">/</kbd> focuses filter ·
            use Inventory → Transactions (Purchase) to add stock
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter items…"
            className="h-8 w-44 text-xs"
            aria-label="Filter inventory rows"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] shadow-[0_1px_2px_rgba(58,42,31,0.08)]">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--gs-border)] bg-[var(--gs-surface)] text-[11px] font-medium text-[var(--gs-text-secondary)]">
              <th className="sticky top-0 z-10 w-10 border-r border-[var(--gs-border)] px-1 py-2 text-center font-mono">
                {" "}
              </th>
              <th className="sticky top-0 z-10 min-w-[180px] border-r border-[var(--gs-border)] px-2 py-2 text-left">
                Item
              </th>
              <th className="sticky top-0 z-10 min-w-[72px] border-r border-[var(--gs-border)] px-2 py-2 text-left">
                Unit label
              </th>
              <th className="sticky top-0 z-10 min-w-[88px] border-r border-[var(--gs-border)] px-2 py-2 text-right">
                Shop
              </th>
              <th className="sticky top-0 z-10 min-w-[88px] border-r border-[var(--gs-border)] px-2 py-2 text-right">
                Godown
              </th>
              <th className="sticky top-0 z-10 min-w-[88px] border-r border-[var(--gs-border)] px-2 py-2 text-right">
                Total
              </th>
              <th className="sticky top-0 z-10 min-w-[104px] border-r border-[var(--gs-border)] px-2 py-2 text-right">
                Rate (INR)
              </th>
              <th className="sticky top-0 z-10 w-24 px-2 py-2 text-center">
                {" "}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((it, rowIdx) => {
              const shop = invRow(it.id, "shop");
              const godown = invRow(it.id, "godown");
              const shopQty = shop?.qty ?? 0;
              const godQty = godown?.qty ?? 0;
              const totalQty = shopQty + godQty;
              const rowNum = rowIdx + 1;
              const isTransferOpen = transferItemId === it.id;
              return (
                <Fragment key={it.id}>
                  <tr className="border-b border-[var(--gs-grid)] hover:bg-[var(--gs-surface)]">
                    <td className="border-r border-[var(--gs-border)] bg-[var(--gs-surface)] px-1 py-0 text-center font-mono text-xs text-[var(--gs-text-secondary)]">
                      {rowNum}
                    </td>
                    <td className="border-r border-[var(--gs-grid)] px-2 py-1.5 text-[var(--gs-text)]">
                      {it.name}
                    </td>
                    <td className="border-r border-[var(--gs-grid)] px-2 py-1.5 text-[var(--gs-text-secondary)]">
                      {it.unit ?? "—"}
                    </td>
                    <td className="border-r border-[var(--gs-grid)] px-2 py-1.5 text-right font-mono tabular-nums text-[var(--gs-text)]">
                      {shop ? shopQty : "—"}
                    </td>
                    <td className="border-r border-[var(--gs-grid)] px-2 py-1.5 text-right font-mono tabular-nums text-[var(--gs-text)]">
                      {godown ? godQty : "—"}
                    </td>
                    <td className="border-r border-[var(--gs-grid)] px-2 py-1.5 text-right font-mono tabular-nums text-[var(--gs-text)]">
                      {shop || godown ? totalQty : "—"}
                    </td>
                    <td className="border-r border-[var(--gs-grid)] px-2 py-1.5 text-right font-mono tabular-nums text-[var(--gs-text-secondary)]">
                      {it.rate_default != null ? formatINR(it.rate_default) : "—"}
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        aria-label={`Transfer stock for ${it.name}`}
                        aria-expanded={isTransferOpen}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          isTransferOpen
                            ? "bg-[var(--gs-selection)] text-[var(--gs-primary)]"
                            : "text-[var(--gs-text-secondary)] hover:bg-[var(--gs-selection)] hover:text-[var(--gs-primary)]"
                        }`}
                        onClick={() => openTransfer(it)}
                      >
                        Transfer
                      </button>
                    </td>
                  </tr>
                  {isTransferOpen && (
                    <tr className="border-b border-[var(--gs-border)] bg-[var(--gs-surface)]">
                      <td />
                      <td colSpan={7} className="px-3 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="space-y-1">
                            <span className="text-[11px] text-[var(--gs-text-secondary)]">From</span>
                            <select
                              value={transferFrom}
                              onChange={(e) => {
                                const from = e.target.value as "shop" | "godown";
                                setTransferFrom(from);
                                setTransferTo(from === "shop" ? "godown" : "shop");
                                setTransferErr(null);
                              }}
                              className="block h-8 rounded border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-2 text-xs text-[var(--gs-text)] focus:outline-none focus:ring-1 focus:ring-[var(--gs-primary)]"
                            >
                              <option value="shop">Shop</option>
                              <option value="godown">Godown</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[11px] text-[var(--gs-text-secondary)]">To</span>
                            <select
                              value={transferTo}
                              onChange={(e) => {
                                const to = e.target.value as "shop" | "godown";
                                setTransferTo(to);
                                setTransferFrom(to === "shop" ? "godown" : "shop");
                                setTransferErr(null);
                              }}
                              className="block h-8 rounded border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-2 text-xs text-[var(--gs-text)] focus:outline-none focus:ring-1 focus:ring-[var(--gs-primary)]"
                            >
                              <option value="godown">Godown</option>
                              <option value="shop">Shop</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[11px] text-[var(--gs-text-secondary)]">
                              Qty{" "}
                              <span className="text-[var(--gs-text-secondary)]/80">
                                (max{" "}
                                {transferFrom === "shop"
                                  ? shop?.qty ?? 0
                                  : godown?.qty ?? 0}
                                )
                              </span>
                            </span>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={transferQty}
                              onChange={(e) => {
                                setTransferQty(e.target.value);
                                setTransferErr(null);
                              }}
                              className="h-8 w-24 text-xs"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[11px] text-[var(--gs-text-secondary)]">Date</span>
                            <Input
                              type="date"
                              value={transferDate}
                              onChange={(e) => setTransferDate(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="min-w-[140px] flex-1 space-y-1">
                            <span className="text-[11px] text-[var(--gs-text-secondary)]">
                              Note (optional)
                            </span>
                            <Input
                              value={transferNote}
                              onChange={(e) => setTransferNote(e.target.value)}
                              placeholder="—"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={isTransferring}
                              onClick={() => void handleTransfer(it)}
                            >
                              {isTransferring ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setTransferItemId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                        {transferErr ? (
                          <p
                            role="alert"
                            aria-live="polite"
                            className="mt-2 rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-1.5 text-xs text-[var(--gs-danger)]"
                          >
                            {transferErr}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--gs-text-secondary)]">
            No items yet. Add stock via Inventory → Transactions (Purchase).
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--gs-text-secondary)]">
            No items match this filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}
