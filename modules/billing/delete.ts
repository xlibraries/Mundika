import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type { BillItemRow } from "@/lib/types/domain";

function allocationForRestore(line: BillItemRow): {
  qty_from_shop: number;
  qty_from_godown: number;
} {
  if (line.qty_from_shop === undefined && line.qty_from_godown === undefined) {
    return { qty_from_shop: line.qty, qty_from_godown: 0 };
  }
  return {
    qty_from_shop: line.qty_from_shop ?? 0,
    qty_from_godown: line.qty_from_godown ?? 0,
  };
}

export async function deleteBill(userId: string, billId: string): Promise<void> {
  const bill = await db.bills.get(billId);
  if (!bill || bill.user_id !== userId) {
    throw new Error("Bill not found");
  }

  const billItems = await db.bill_items
    .where("bill_id")
    .equals(billId)
    .toArray();

  const ledgerRows = await db.ledger_entries
    .where("user_id")
    .equals(userId)
    .filter((e) => e.ref_bill_id === billId)
    .toArray();

  await db.transaction(
    "rw",
    [
      db.bills,
      db.bill_items,
      db.ledger_entries,
      db.inventory,
      db.sync_queue,
    ],
    async () => {
      for (const line of billItems) {
        const { qty_from_shop, qty_from_godown } = allocationForRestore(line);
        const rows = await db.inventory
          .where("user_id")
          .equals(userId)
          .filter((r) => r.item_id === line.item_id)
          .toArray();
        const shop = rows.find((r) => r.location === "shop");
        const godown = rows.find((r) => r.location === "godown");
        const now = new Date().toISOString();

        if (shop && qty_from_shop > 0) {
          const next = {
            ...shop,
            qty: shop.qty + qty_from_shop,
            updated_at: now,
          };
          await db.inventory.put(next);
          await enqueueSync("inventory", "upsert", next.id, { ...next });
        }
        if (godown && qty_from_godown > 0) {
          const next = {
            ...godown,
            qty: godown.qty + qty_from_godown,
            updated_at: now,
          };
          await db.inventory.put(next);
          await enqueueSync("inventory", "upsert", next.id, { ...next });
        }
      }

      for (const le of ledgerRows) {
        await db.ledger_entries.delete(le.id);
        await enqueueSync("ledger_entries", "delete", le.id, {});
      }

      for (const bi of billItems) {
        await db.bill_items.delete(bi.id);
        await enqueueSync("bill_items", "delete", bi.id, {});
      }

      await db.bills.delete(billId);
      await enqueueSync("bills", "delete", billId, {});
    }
  );
}
