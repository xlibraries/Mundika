"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import { createItem } from "@/modules/items/actions";
import { deleteItem } from "@/modules/items/delete";
import { updateItemFields } from "@/modules/items/update";
import { enqueueSync } from "@/lib/sync/queue";
import { formatINR } from "@/lib/format/inr";
import { parseNonnegativeStockQty } from "@/lib/inventory/quantity";
import type { InventoryRow, ItemRow } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InventorySheet({
  userId,
  refreshToken,
  onChanged,
}: {
  userId: string;
  refreshToken: number;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [inv, setInv] = useState<InventoryRow[]>([]);
  const [filter, setFilter] = useState("");
  const [cellError, setCellError] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);

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
  }, [load, refreshToken]);

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

  async function saveQty(row: InventoryRow, raw: string) {
    const parsed = parseNonnegativeStockQty(raw);
    if (!parsed.ok) {
      setCellError("Quantity must be 0 or more");
      await load();
      onChanged?.();
      return;
    }
    setCellError(null);
    const now = new Date().toISOString();
    const next = { ...row, qty: parsed.qty, updated_at: now };
    await db.inventory.put(next);
    await enqueueSync("inventory", "upsert", next.id, { ...next });
    setInv((prev) => prev.map((r) => (r.id === row.id ? next : r)));
    onChanged?.();
  }

  async function onBlurField(
    itemId: string,
    field: "name" | "unit" | "rate_default",
    raw: string
  ) {
    try {
      if (field === "rate_default") {
        if (raw.trim() === "") {
          await updateItemFields(userId, itemId, { rate_default: null });
        } else {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) {
            setCellError("Rate must be 0 or more");
            await load();
            return;
          }
          setCellError(null);
          await updateItemFields(userId, itemId, { rate_default: n });
        }
      } else if (field === "name") {
        if (!raw.trim()) {
          setCellError("Item name cannot be empty");
          return;
        }
        await updateItemFields(userId, itemId, { name: raw.trim() });
      } else {
        await updateItemFields(userId, itemId, {
          unit: raw.trim() === "" ? null : raw.trim(),
        });
      }
      await load();
      onChanged?.();
    } catch {
      /* ignore */
    }
  }

  async function onRemove(itemId: string) {
    if (
      !window.confirm(
        "Delete this item and its shop/godown rows? This cannot be undone."
      )
    ) {
      return;
    }
    try {
      await deleteItem(userId, itemId);
      await load();
      onChanged?.();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not delete");
    }
  }

  async function addRow() {
    await createItem(userId, {
      name: `Item ${items.length + 1}`,
      unit: null,
      rate_default: null,
    });
    await load();
    onChanged?.();
  }

  const cellInput =
    "rounded-none border-0 bg-transparent py-1.5 text-[#202124] focus:ring-0 focus-visible:outline-none";

  return (
    <div className="space-y-2">
      {cellError ? (
        <p role="alert" aria-live="polite" className="rounded border border-[#f9dedc] bg-[#fce8e6] px-3 py-2 text-sm text-[#c5221f]">
          {cellError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dadce0] pb-2">
        <div>
          <h2 className="text-sm font-medium text-[#202124]">Inventory</h2>
          <p className="text-[11px] text-[#5f6368]">
            Sheets-style cells · <kbd className="font-mono">/</kbd> focuses
            filter · quantities must be ≥ 0.
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
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void addRow()}
          >
            + Row
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.15)]">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#dadce0] bg-[#f8f9fa] text-[11px] font-medium text-[#5f6368]">
              <th className="sticky top-0 z-10 w-10 border-r border-[#dadce0] px-1 py-2 text-center font-mono">
                {" "}
              </th>
              <th className="sticky top-0 z-10 min-w-[180px] border-r border-[#dadce0] px-2 py-2 text-left">
                Item
              </th>
              <th className="sticky top-0 z-10 min-w-[72px] border-r border-[#dadce0] px-2 py-2 text-left">
                Unit label
              </th>
              <th className="sticky top-0 z-10 min-w-[88px] border-r border-[#dadce0] px-2 py-2 text-right">
                Shop
              </th>
              <th className="sticky top-0 z-10 min-w-[88px] border-r border-[#dadce0] px-2 py-2 text-right">
                Godown
              </th>
              <th className="sticky top-0 z-10 min-w-[88px] border-r border-[#dadce0] px-2 py-2 text-right">
                Total
              </th>
              <th className="sticky top-0 z-10 min-w-[104px] border-r border-[#dadce0] px-2 py-2 text-right">
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
              return (
                <tr
                  key={it.id}
                  className="border-b border-[#e8eaed] hover:bg-[#f8f9fa]"
                >
                  <td className="border-r border-[#dadce0] bg-[#f8f9fa] px-1 py-0 text-center font-mono text-xs text-[#5f6368]">
                    {rowNum}
                  </td>
                  <td className="border-r border-[#e8eaed] p-0 focus-within:bg-[#e8f0fe] focus-within:ring-1 focus-within:ring-inset focus-within:ring-[#1a73e8]">
                    <Input
                      defaultValue={it.name}
                      className={cellInput}
                      onBlur={(e) =>
                        void onBlurField(it.id, "name", e.target.value)
                      }
                    />
                  </td>
                  <td className="border-r border-[#e8eaed] p-0 focus-within:bg-[#e8f0fe] focus-within:ring-1 focus-within:ring-inset focus-within:ring-[#1a73e8]">
                    <Input
                      defaultValue={it.unit ?? ""}
                      className={cellInput}
                      placeholder="—"
                      title="Display label only; stock is shop + godown qty."
                      onBlur={(e) =>
                        void onBlurField(it.id, "unit", e.target.value)
                      }
                    />
                  </td>
                  <td className="border-r border-[#e8eaed] p-0 focus-within:bg-[#e8f0fe] focus-within:ring-1 focus-within:ring-inset focus-within:ring-[#1a73e8]">
                    {shop ? (
                      <Input
                        key={`${shop.id}-${shop.updated_at}`}
                        type="text"
                        inputMode="decimal"
                        defaultValue={String(shop.qty)}
                        className={`${cellInput} text-right font-mono tabular-nums`}
                        onBlur={(e) => void saveQty(shop, e.target.value)}
                      />
                    ) : (
                      <span className="block px-2 py-1.5 text-[#5f6368]">—</span>
                    )}
                  </td>
                  <td className="border-r border-[#e8eaed] p-0 focus-within:bg-[#e8f0fe] focus-within:ring-1 focus-within:ring-inset focus-within:ring-[#1a73e8]">
                    {godown ? (
                      <Input
                        key={`${godown.id}-${godown.updated_at}`}
                        type="text"
                        inputMode="decimal"
                        defaultValue={String(godown.qty)}
                        className={`${cellInput} text-right font-mono tabular-nums`}
                        onBlur={(e) => void saveQty(godown, e.target.value)}
                      />
                    ) : (
                      <span className="block px-2 py-1.5 text-[#5f6368]">—</span>
                    )}
                  </td>
                  <td className="border-r border-[#e8eaed] px-2 py-1.5 text-right font-mono tabular-nums text-[#202124]">
                    {shop || godown ? totalQty : "—"}
                  </td>
                  <td className="border-r border-[#e8eaed] p-0 focus-within:bg-[#e8f0fe] focus-within:ring-1 focus-within:ring-inset focus-within:ring-[#1a73e8]">
                    <Input
                      defaultValue={
                        it.rate_default != null ? String(it.rate_default) : ""
                      }
                      inputMode="decimal"
                      className={`${cellInput} text-right font-mono tabular-nums`}
                      placeholder="—"
                      title={
                        it.rate_default != null
                          ? formatINR(it.rate_default)
                          : "Default rate in INR"
                      }
                      onBlur={(e) =>
                        void onBlurField(it.id, "rate_default", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      aria-label={`Remove ${it.name}`}
                      className="rounded px-2 py-1 text-xs text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#d93025]"
                      onClick={() => void onRemove(it.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#5f6368]">
            No rows yet. Click + Row to add.
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#5f6368]">
            No items match this filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}
