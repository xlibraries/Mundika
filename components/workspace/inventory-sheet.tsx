"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { createItem } from "@/modules/items/actions";
import { deleteItem } from "@/modules/items/delete";
import { updateItemFields } from "@/modules/items/update";
import { enqueueSync } from "@/lib/sync/queue";
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

  function invRow(itemId: string, loc: InventoryRow["location"]) {
    return inv.find((r) => r.item_id === itemId && r.location === loc);
  }

  async function saveQty(row: InventoryRow, qty: number) {
    const now = new Date().toISOString();
    const next = { ...row, qty, updated_at: now };
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
        const n = raw.trim() === "" ? null : Number(raw);
        if (raw.trim() !== "" && Number.isNaN(n)) return;
        await updateItemFields(userId, itemId, { rate_default: n });
      } else if (field === "name") {
        if (!raw.trim()) return;
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-400">Inventory sheet</h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => void addRow()}>
          + Row
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/[0.08] bg-zinc-950/40">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] bg-zinc-950/90 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <th className="sticky top-0 z-10 w-10 border-r border-white/[0.06] px-2 py-2 text-center font-mono text-zinc-600">
                #
              </th>
              <th className="sticky top-0 z-10 min-w-[180px] border-r border-white/[0.06] px-2 py-2">
                Item
              </th>
              <th className="sticky top-0 z-10 min-w-[72px] border-r border-white/[0.06] px-2 py-2">
                Unit
              </th>
              <th className="sticky top-0 z-10 min-w-[88px] border-r border-white/[0.06] px-2 py-2 text-right">
                Shop
              </th>
              <th className="sticky top-0 z-10 min-w-[88px] border-r border-white/[0.06] px-2 py-2 text-right">
                Godown
              </th>
              <th className="sticky top-0 z-10 min-w-[96px] border-r border-white/[0.06] px-2 py-2 text-right">
                Rate
              </th>
              <th className="sticky top-0 z-10 w-24 px-2 py-2 text-center">
                —
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const shop = invRow(it.id, "shop");
              const godown = invRow(it.id, "godown");
              return (
                <tr
                  key={it.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className="border-r border-white/[0.04] px-2 py-1 text-center font-mono text-xs text-zinc-600">
                    {idx + 1}
                  </td>
                  <td className="border-r border-white/[0.04] p-0">
                    <Input
                      defaultValue={it.name}
                      className="rounded-none border-0 bg-transparent py-1.5 focus:ring-0"
                      onBlur={(e) =>
                        void onBlurField(it.id, "name", e.target.value)
                      }
                    />
                  </td>
                  <td className="border-r border-white/[0.04] p-0">
                    <Input
                      defaultValue={it.unit ?? ""}
                      className="rounded-none border-0 bg-transparent py-1.5 focus:ring-0"
                      placeholder="—"
                      onBlur={(e) =>
                        void onBlurField(it.id, "unit", e.target.value)
                      }
                    />
                  </td>
                  <td className="border-r border-white/[0.04] p-0">
                    {shop ? (
                      <Input
                        key={`${shop.id}-${shop.updated_at}`}
                        type="number"
                        defaultValue={shop.qty}
                        className="rounded-none border-0 bg-transparent py-1.5 text-right font-mono tabular-nums focus:ring-0"
                        onBlur={(e) =>
                          void saveQty(shop, Number(e.target.value))
                        }
                      />
                    ) : (
                      <span className="block px-2 py-1.5 text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="border-r border-white/[0.04] p-0">
                    {godown ? (
                      <Input
                        key={`${godown.id}-${godown.updated_at}`}
                        type="number"
                        defaultValue={godown.qty}
                        className="rounded-none border-0 bg-transparent py-1.5 text-right font-mono tabular-nums focus:ring-0"
                        onBlur={(e) =>
                          void saveQty(godown, Number(e.target.value))
                        }
                      />
                    ) : (
                      <span className="block px-2 py-1.5 text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="border-r border-white/[0.04] p-0">
                    <Input
                      defaultValue={
                        it.rate_default != null ? String(it.rate_default) : ""
                      }
                      inputMode="decimal"
                      className="rounded-none border-0 bg-transparent py-1.5 text-right font-mono tabular-nums focus:ring-0"
                      placeholder="—"
                      onBlur={(e) =>
                        void onBlurField(it.id, "rate_default", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
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
          <p className="px-4 py-6 text-center text-sm text-zinc-500">
            No rows yet. Click + Row to add.
          </p>
        ) : null}
      </div>
    </div>
  );
}
