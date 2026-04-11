import { db } from "@/lib/db";

/** Remove one user's mirrored rows from the offline cache (Dexie). */
export async function clearLocalUserData(userId: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.stock_transfers,
      db.purchase_items,
      db.purchases,
      db.ledger_entries,
      db.bill_items,
      db.bills,
      db.inventory,
      db.items,
      db.parties,
    ],
    async () => {
      await db.stock_transfers.where("user_id").equals(userId).delete();
      await db.purchase_items.where("user_id").equals(userId).delete();
      await db.purchases.where("user_id").equals(userId).delete();
      await db.ledger_entries.where("user_id").equals(userId).delete();
      await db.bill_items.where("user_id").equals(userId).delete();
      await db.bills.where("user_id").equals(userId).delete();
      await db.inventory.where("user_id").equals(userId).delete();
      await db.items.where("user_id").equals(userId).delete();
      await db.parties.where("user_id").equals(userId).delete();
    }
  );
}
