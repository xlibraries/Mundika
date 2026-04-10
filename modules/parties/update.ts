import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";

export async function updateParty(
  userId: string,
  partyId: string,
  input: { name: string; phone?: string | null }
): Promise<void> {
  const row = await db.parties.get(partyId);
  if (!row || row.user_id !== userId) {
    throw new Error("Party not found");
  }
  const next = {
    ...row,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  await db.parties.put(next);
  await enqueueSync("parties", "upsert", partyId, { ...next });
}
