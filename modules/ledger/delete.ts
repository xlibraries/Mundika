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

  await db.transaction("rw", [db.ledger_entries, db.sync_queue], async () => {
    await db.ledger_entries.delete(entryId);
    await enqueueSync("ledger_entries", "delete", entryId, {});
  });
}
