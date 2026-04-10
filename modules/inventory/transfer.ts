import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type { StockTransferRow } from "@/lib/types/domain";

export async function createStockTransfer(
  userId: string,
  input: {
    item_id: string;
    from_location: "shop" | "godown";
    to_location: "shop" | "godown";
    qty: number;
    note?: string | null;
    transfer_date: string;
  }
): Promise<void> {
  if (input.from_location === input.to_location) {
    throw new Error("From and To locations must be different");
  }
  if (!(input.qty > 0)) {
    throw new Error("Quantity must be greater than 0");
  }

  // Load inventory rows for this item + user
  const rows = await db.inventory
    .where("user_id")
    .equals(userId)
    .filter((r) => r.item_id === input.item_id)
    .toArray();

  const fromRow = rows.find((r) => r.location === input.from_location);
  if (!fromRow) {
    throw new Error(`No inventory row for ${input.from_location}`);
  }
  if (fromRow.qty < input.qty) {
    const loc = input.from_location === "shop" ? "Shop" : "Godown";
    throw new Error(`Insufficient stock in ${loc} (available: ${fromRow.qty})`);
  }

  const toRow = rows.find((r) => r.location === input.to_location);
  if (!toRow) {
    throw new Error(
      `No inventory row for destination (${input.to_location}). Add stock via Workspace → Transactions (Purchase) first.`
    );
  }

  const now = new Date().toISOString();
  const transferDate = input.transfer_date.slice(0, 10);

  // Load item name for snapshot
  const item = await db.items.get(input.item_id);
  const item_name_snapshot = item?.name ?? input.item_id;

  const updatedFrom = { ...fromRow, qty: fromRow.qty - input.qty, updated_at: now };
  const updatedTo = { ...toRow, qty: toRow.qty + input.qty, updated_at: now };

  const transfer: StockTransferRow = {
    id: crypto.randomUUID(),
    user_id: userId,
    item_id: input.item_id,
    item_name_snapshot,
    from_location: input.from_location,
    to_location: input.to_location,
    qty: input.qty,
    note: input.note?.trim() || null,
    transfer_date: transferDate,
    created_at: now,
    updated_at: now,
  };

  await db.transaction(
    "rw",
    [db.inventory, db.stock_transfers, db.sync_queue],
    async () => {
      await db.inventory.put(updatedFrom);
      await enqueueSync("inventory", "upsert", updatedFrom.id, { ...updatedFrom });

      await db.inventory.put(updatedTo);
      await enqueueSync("inventory", "upsert", updatedTo.id, { ...updatedTo });

      await db.stock_transfers.put(transfer);
      await enqueueSync("stock_transfers", "upsert", transfer.id, { ...transfer });
    }
  );
}
