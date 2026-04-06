"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type { InventoryRow, ItemRow } from "@/lib/types/domain";
import { useUserId } from "@/hooks/use-user-id";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";

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
    return <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inventory"
        description="Shop and godown quantities. Billing consumes shop stock first, then godown."
      />

      <div className="overflow-x-auto overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Shop</th>
              <th className="px-4 py-3 text-right">Godown</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {items.map((it) => {
              const shop = inv.find(
                (r) => r.item_id === it.id && r.location === "shop"
              );
              const godown = inv.find(
                (r) => r.item_id === it.id && r.location === "godown"
              );
              return (
                <tr key={it.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 font-medium text-zinc-200">
                    {it.name}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {shop ? (
                      <Input
                        className="ml-auto w-24 py-1.5 text-right font-mono text-sm tabular-nums"
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
                  <td className="px-4 py-2.5 text-right">
                    {godown ? (
                      <Input
                        className="ml-auto w-24 py-1.5 text-right font-mono text-sm tabular-nums"
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
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            Add items first.
          </p>
        ) : null}
      </div>
    </div>
  );
}
