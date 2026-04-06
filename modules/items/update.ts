import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type { ItemRow } from "@/lib/types/domain";

export async function updateItemFields(
  userId: string,
  itemId: string,
  patch: Partial<Pick<ItemRow, "name" | "unit" | "rate_default">>
): Promise<void> {
  const row = await db.items.get(itemId);
  if (!row || row.user_id !== userId) {
    throw new Error("Item not found");
  }

  const now = new Date().toISOString();
  const next: ItemRow = {
    ...row,
    name: patch.name !== undefined ? patch.name.trim() : row.name,
    unit:
      patch.unit !== undefined
        ? patch.unit === null
          ? null
          : String(patch.unit).trim() || null
        : row.unit,
    rate_default:
      patch.rate_default !== undefined ? patch.rate_default : row.rate_default,
    updated_at: now,
  };

  await db.items.put(next);
  await enqueueSync("items", "upsert", itemId, { ...next });
}
