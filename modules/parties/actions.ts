import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type { PartyRow } from "@/lib/types/domain";

export async function createParty(
  userId: string,
  input: { name: string; phone?: string | null }
): Promise<PartyRow> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: PartyRow = {
    id,
    user_id: userId,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    created_at: now,
    updated_at: now,
  };

  await db.parties.put(row);
  await enqueueSync("parties", "upsert", id, { ...row });
  return row;
}
