import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type { InventoryRow } from "@/lib/types/domain";

const ORDER: InventoryRow["location"][] = ["shop", "godown"];

async function loadInventoryRows(
  userId: string,
  itemId: string
): Promise<InventoryRow[]> {
  return db.inventory
    .where("user_id")
    .equals(userId)
    .filter((r) => r.item_id === itemId)
    .toArray();
}

/** Returns updated rows to write. Throws if insufficient stock. */
export function planDeductQty(
  rows: InventoryRow[],
  qty: number
): InventoryRow[] {
  if (qty <= 0) return [];
  const byLoc = new Map(rows.map((r) => [r.location, r] as const));
  let remaining = qty;
  const out: InventoryRow[] = [];

  for (const loc of ORDER) {
    const row = byLoc.get(loc);
    if (!row) continue;
    const take = Math.min(row.qty, remaining);
    if (take <= 0) continue;
    const now = new Date().toISOString();
    const next = { ...row, qty: row.qty - take, updated_at: now };
    out.push(next);
    byLoc.set(loc, next);
    remaining -= take;
    if (remaining <= 0) break;
  }

  if (remaining > 0) throw new Error("Insufficient stock");
  return out;
}

/** Standalone deduct (own transaction). */
export async function deductInventory(
  userId: string,
  itemId: string,
  qty: number
): Promise<void> {
  const rows = await loadInventoryRows(userId, itemId);
  const updates = planDeductQty(rows, qty);
  await db.transaction("rw", [db.inventory, db.sync_queue], async () => {
    for (const row of updates) {
      await db.inventory.put(row);
      await enqueueSync("inventory", "upsert", row.id, { ...row });
    }
  });
}

export type LineDeduction = { item_id: string; qty: number };

/**
 * Plans inventory updates for a full bill (sequential lines; same item on multiple lines is OK).
 */
export async function planBillDeductions(
  userId: string,
  lines: LineDeduction[]
): Promise<Map<string, InventoryRow>> {
  const byRowId = new Map<string, InventoryRow>();

  for (const line of lines) {
    const base = await loadInventoryRows(userId, line.item_id);
    const merged = base.map((r) => byRowId.get(r.id) ?? r);
    const updates = planDeductQty(merged, line.qty);
    for (const u of updates) {
      byRowId.set(u.id, u);
    }
  }

  return byRowId;
}
