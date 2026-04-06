"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type { InventoryRow, ItemRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";

export default function InventoryPage() {
  const { userId, loading } = useUserId();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [inv, setInv] = useState<InventoryRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    void Promise.all([
      db.items.where("user_id").equals(userId).toArray(),
      db.inventory.where("user_id").equals(userId).toArray(),
    ]).then(([i, n]) => {
      i.sort((a, b) => a.name.localeCompare(b.name));
      setItems(i);
      setInv(n);
    });
  }, [userId]);

  async function setQty(row: InventoryRow, qty: number) {
    const now = new Date().toISOString();
    const next = { ...row, qty, updated_at: now };
    await db.inventory.put(next);
    await enqueueSync("inventory", "upsert", next.id, { ...next });
    setInv((prev) => prev.map((r) => (r.id === row.id ? next : r)));
  }

  if (loading || !userId) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Inventory</h1>
      <p className="text-sm text-zinc-500">
        Shop and godown quantities. Billing deducts shop first, then godown.
      </p>

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Shop</th>
              <th className="px-3 py-2">Godown</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const shop = inv.find(
                (r) => r.item_id === it.id && r.location === "shop"
              );
              const godown = inv.find(
                (r) => r.item_id === it.id && r.location === "godown"
              );
              return (
                <tr key={it.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2">
                    {shop ? (
                      <input
                        className="w-24 rounded border border-zinc-300 px-2 py-1 tabular-nums dark:border-zinc-700"
                        type="number"
                        value={shop.qty}
                        onChange={(e) =>
                          void setQty(shop, Number(e.target.value))
                        }
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {godown ? (
                      <input
                        className="w-24 rounded border border-zinc-300 px-2 py-1 tabular-nums dark:border-zinc-700"
                        type="number"
                        value={godown.qty}
                        onChange={(e) =>
                          void setQty(godown, Number(e.target.value))
                        }
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
