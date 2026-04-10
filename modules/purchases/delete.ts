import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";

export async function deletePurchase(
  userId: string,
  purchaseId: string
): Promise<void> {
  const purchase = await db.purchases.get(purchaseId);
  if (!purchase || purchase.user_id !== userId) {
    throw new Error("Purchase not found");
  }

  const purchaseItems = await db.purchase_items
    .where("purchase_id")
    .equals(purchaseId)
    .toArray();

  const ledgerRows = await db.ledger_entries
    .where("user_id")
    .equals(userId)
    .filter((e) => e.ref_purchase_id === purchaseId)
    .toArray();

  await db.transaction(
    "rw",
    [
      db.purchases,
      db.purchase_items,
      db.ledger_entries,
      db.inventory,
      db.sync_queue,
    ],
    async () => {
      const now = new Date().toISOString();

      // Reverse stock: subtract qty from the destination location
      for (const item of purchaseItems) {
        const invRow = await db.inventory
          .where("user_id")
          .equals(userId)
          .filter(
            (r) =>
              r.item_id === item.item_id && r.location === item.destination
          )
          .first();

        if (invRow) {
          const next = {
            ...invRow,
            qty: Math.max(0, invRow.qty - item.qty),
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

      for (const pi of purchaseItems) {
        await db.purchase_items.delete(pi.id);
        await enqueueSync("purchase_items", "delete", pi.id, {});
      }

      await db.purchases.delete(purchaseId);
      await enqueueSync("purchases", "delete", purchaseId, {});
    }
  );
}
