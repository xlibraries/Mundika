import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type { InventoryRow, ItemRow } from "@/lib/types/domain";

export async function createItem(
  userId: string,
  input: { name: string; unit?: string | null; rate_default?: number | null }
): Promise<ItemRow> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: ItemRow = {
    id,
    user_id: userId,
    name: input.name.trim(),
    unit: input.unit?.trim() || null,
    rate_default:
      input.rate_default === undefined || input.rate_default === null
        ? null
        : Number(input.rate_default),
    created_at: now,
    updated_at: now,
  };

  await db.transaction("rw", [db.items, db.inventory, db.sync_queue], async () => {
    await db.items.put(row);
    await enqueueSync("items", "upsert", id, { ...row });

    const locations: Array<InventoryRow["location"]> = ["shop", "godown"];
    for (const location of locations) {
      const invId = crypto.randomUUID();
      const inv: InventoryRow = {
        id: invId,
        user_id: userId,
        item_id: id,
        location,
        qty: 0,
        created_at: now,
        updated_at: now,
      };
      await db.inventory.put(inv);
      await enqueueSync("inventory", "upsert", invId, { ...inv });
    }
  });

  return row;
}
