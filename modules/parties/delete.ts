import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";

export async function deleteParty(userId: string, partyId: string): Promise<void> {
  const party = await db.parties.get(partyId);
  if (!party || party.user_id !== userId) {
    throw new Error("Party not found");
  }

  const billCount = await db.bills
    .where("party_id")
    .equals(partyId)
    .count();

  if (billCount > 0) {
    throw new Error("Cannot delete: this party has bills. Remove bills first.");
  }

  await db.transaction("rw", [db.parties, db.sync_queue], async () => {
    await db.parties.delete(partyId);
    await enqueueSync("parties", "delete", partyId, {});
  });
}
