import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";

export async function deleteItem(userId: string, itemId: string): Promise<void> {
  const item = await db.items.get(itemId);
  if (!item || item.user_id !== userId) {
    throw new Error("Item not found");
  }

  const lineCount = await db.bill_items.where("item_id").equals(itemId).count();
  if (lineCount > 0) {
    throw new Error("Cannot delete: item appears on bills.");
  }

  const purchaseLineCount = await db.purchase_items
    .where("item_id")
    .equals(itemId)
    .count();
  if (purchaseLineCount > 0) {
    throw new Error("Cannot delete: item appears on purchases.");
  }

  const transferCount = await db.stock_transfers
    .where("item_id")
    .equals(itemId)
    .count();
  if (transferCount > 0) {
    throw new Error(
      "Cannot delete: item has stock transfers. Remove or adjust transfers first."
    );
  }

  const invRows = await db.inventory
    .where("user_id")
    .equals(userId)
    .filter((r) => r.item_id === itemId)
    .toArray();

  await db.transaction(
    "rw",
    [db.items, db.inventory, db.sync_queue],
    async () => {
      for (const r of invRows) {
        await db.inventory.delete(r.id);
        await enqueueSync("inventory", "delete", r.id, {});
      }
      await db.items.delete(itemId);
      await enqueueSync("items", "delete", itemId, {});
    }
  );
}
