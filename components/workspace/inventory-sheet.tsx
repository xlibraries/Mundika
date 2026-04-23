"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { getLocalDateInputValue } from "@/lib/date/local-date";
import { createStockTransfer } from "@/modules/inventory/transfer";
import { formatINR } from "@/lib/format/inr";
import type { InventoryRow, ItemRow } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/cn";
import {
  WORKSPACE_INSET_EXPANDED,
  WORKSPACE_PANEL,
  WORKSPACE_PANEL_HEADER,
  workspaceEntryShell,
} from "@/components/workspace/workspace-shell";

export function InventorySheet({
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
    itemId: string;
    minTotalQty: string;
  };
  onLocalFiltersChange: (next: { itemId: string; minTotalQty: string }) => void;
  onApplyToOverview?: (payload: { itemId?: string }) => void;
}) {
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [inv, setInv] = useState<InventoryRow[]>([]);

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

  const filteredItems = useMemo(() => {
    const minQty = Number(localFilters.minTotalQty);
    return items.filter((it) => {
      if (localFilters.itemId && it.id !== localFilters.itemId) return false;
      const shop = inv.find((r) => r.item_id === it.id && r.location === "shop");
      const godown = inv.find((r) => r.item_id === it.id && r.location === "godown");
      const totalQty = (shop?.qty ?? 0) + (godown?.qty ?? 0);
      if (!Number.isNaN(minQty) && localFilters.minTotalQty !== "" && totalQty < minQty) {
        return false;
      }
      return true;
    });
  }, [items, localFilters.itemId, localFilters.minTotalQty, inv]);

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
    <div className="space-y-3">
      <div className={WORKSPACE_PANEL}>
        <div className={WORKSPACE_PANEL_HEADER}>
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--gs-text-secondary)]">
            Inventory
          </p>
          <h3 className="mt-0.5 text-center text-lg font-semibold tracking-tight text-[var(--gs-text)]">
            Stock levels
          </h3>
          <p className="mt-0.5 text-center text-[11px] text-[var(--gs-text-secondary)]">
            Read-only view with header filters. Add stock via Dashboard → Transactions
            (Purchase).
          </p>
          <div className="mx-auto mt-3 flex w-full max-w-5xl flex-col gap-2 md:flex-row md:flex-nowrap md:items-end md:justify-center md:gap-3">
            <label className="min-w-0 flex-1 space-y-1 md:min-w-[12rem]">
              <span className="text-[10px] text-[var(--gs-text-secondary)]">Item</span>
              <Select
                value={localFilters.itemId}
                onChange={(e) =>
                  onLocalFiltersChange({
                    ...localFilters,
                    itemId: e.target.value,
                  })
                }
                className="h-9 w-full text-xs"
              >
                <option value="">All items</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="min-w-0 flex-1 space-y-1 md:max-w-[11rem]">
              <span className="text-[10px] text-[var(--gs-text-secondary)]">
                Min total qty
              </span>
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="Any"
                value={localFilters.minTotalQty}
                onChange={(e) =>
                  onLocalFiltersChange({
                    ...localFilters,
                    minTotalQty: e.target.value,
                  })
                }
                className="h-9 w-full text-xs"
              />
            </label>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:items-end md:w-auto">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 w-full shrink-0 md:w-auto"
                disabled={!localFilters.itemId}
                onClick={() =>
                  onApplyToOverview?.({
                    itemId: localFilters.itemId || undefined,
                  })
                }
              >
                Apply item to overview
              </Button>
              {localFilters.itemId || localFilters.minTotalQty ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 w-full shrink-0 md:w-auto"
                  onClick={() =>
                    onLocalFiltersChange({
                      itemId: "",
                      minTotalQty: "",
                    })
                  }
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 bg-[var(--gs-surface)] px-2 py-2 sm:px-3 sm:py-2.5">
          {items.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-[var(--gs-text-secondary)]">
              No items yet. Add stock via Dashboard → Transactions (Purchase).
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-[var(--gs-text-secondary)]">
              No items match these filters.
            </p>
          ) : (
            filteredItems.map((it) => {
              const shop = invRow(it.id, "shop");
              const godown = invRow(it.id, "godown");
              const shopQty = shop?.qty ?? 0;
              const godQty = godown?.qty ?? 0;
              const totalQty = shopQty + godQty;
              const isTransferOpen = transferItemId === it.id;
              return (
                <div key={it.id} className={workspaceEntryShell("neutral")}>
                  <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug text-[var(--gs-text)]">
                          {it.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--gs-text-secondary)]">
                          Unit · {it.unit ?? "—"}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Transfer stock for ${it.name}`}
                        aria-expanded={isTransferOpen}
                        className={cn(
                          "shrink-0 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                          isTransferOpen
                            ? "bg-[var(--gs-selection)] text-[var(--gs-primary)]"
                            : "text-[var(--gs-text-secondary)] hover:bg-[var(--gs-selection)] hover:text-[var(--gs-primary)]"
                        )}
                        onClick={() => openTransfer(it)}
                      >
                        Transfer
                      </button>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                      <div className="text-right sm:text-right">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
                          Shop
                        </span>
                        <p className="mt-0.5 font-mono text-[13px] tabular-nums text-[var(--gs-text)]">
                          {shop ? shopQty : "—"}
                        </p>
                      </div>
                      <div className="text-right sm:text-right">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
                          Godown
                        </span>
                        <p className="mt-0.5 font-mono text-[13px] tabular-nums text-[var(--gs-text)]">
                          {godown ? godQty : "—"}
                        </p>
                      </div>
                      <div className="text-right sm:text-right">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
                          Total
                        </span>
                        <p className="mt-0.5 font-mono text-[13px] tabular-nums text-[var(--gs-text)]">
                          {shop || godown ? totalQty : "—"}
                        </p>
                      </div>
                      <div className="text-right sm:text-right">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
                          Rate (INR)
                        </span>
                        <p className="mt-0.5 font-mono text-[13px] tabular-nums text-[var(--gs-text-secondary)]">
                          {it.rate_default != null ? formatINR(it.rate_default) : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  {isTransferOpen ? (
                    <div className={WORKSPACE_INSET_EXPANDED}>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] text-[var(--gs-text-secondary)]">From</span>
                          <select
                            value={transferFrom}
                            onChange={(e) => {
                              const from = e.target.value as "shop" | "godown";
                              setTransferFrom(from);
                              setTransferTo(from === "shop" ? "godown" : "shop");
                              setTransferErr(null);
                            }}
                            className="block h-9 rounded-md border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-2 text-xs text-[var(--gs-text)] focus:outline-none focus:ring-1 focus:ring-[var(--gs-primary)]"
                          >
                            <option value="shop">Shop</option>
                            <option value="godown">Godown</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-[var(--gs-text-secondary)]">To</span>
                          <select
                            value={transferTo}
                            onChange={(e) => {
                              const to = e.target.value as "shop" | "godown";
                              setTransferTo(to);
                              setTransferFrom(to === "shop" ? "godown" : "shop");
                              setTransferErr(null);
                            }}
                            className="block h-9 rounded-md border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-2 text-xs text-[var(--gs-text)] focus:outline-none focus:ring-1 focus:ring-[var(--gs-primary)]"
                          >
                            <option value="godown">Godown</option>
                            <option value="shop">Shop</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-[var(--gs-text-secondary)]">
                            Qty{" "}
                            <span className="text-[var(--gs-text-secondary)]/80">
                              (max{" "}
                              {transferFrom === "shop" ? shop?.qty ?? 0 : godown?.qty ?? 0})
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
                            className="h-9 w-24 text-xs"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-[var(--gs-text-secondary)]">Date</span>
                          <Input
                            type="date"
                            value={transferDate}
                            onChange={(e) => setTransferDate(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="min-w-[140px] flex-1 space-y-1">
                          <span className="text-[10px] text-[var(--gs-text-secondary)]">
                            Note (optional)
                          </span>
                          <Input
                            value={transferNote}
                            onChange={(e) => setTransferNote(e.target.value)}
                            placeholder="—"
                            className="h-9 text-xs"
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
                          className="mt-2 rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-1.5 text-[13px] text-[var(--gs-danger)]"
                        >
                          {transferErr}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
