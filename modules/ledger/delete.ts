import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";

export async function deleteLedgerEntry(
  userId: string,
  entryId: string
): Promise<void> {
  const row = await db.ledger_entries.get(entryId);
  if (!row || row.user_id !== userId) {
    throw new Error("Entry not found");
  }
  if (row.ref_bill_id) {
    throw new Error(
      "This entry is linked to a bill. Delete the bill from Inventory → Transactions (Billing) instead."
    );
  }
  if (row.ref_purchase_id) {
    throw new Error(
      "This entry is linked to a purchase. Delete it from Inventory → Transactions (Purchase) instead."
    );
  }

  await db.transaction("rw", [db.ledger_entries, db.sync_queue], async () => {
    await db.ledger_entries.delete(entryId);
    await enqueueSync("ledger_entries", "delete", entryId, {});
  });
}
