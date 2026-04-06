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

export type DeductPlan = {
  updates: InventoryRow[];
  qty_from_shop: number;
  qty_from_godown: number;
};

/** Returns updated rows to write. Throws if insufficient stock. */
export function planDeductQty(rows: InventoryRow[], qty: number): DeductPlan {
  if (qty <= 0) {
    return { updates: [], qty_from_shop: 0, qty_from_godown: 0 };
  }
  const byLoc = new Map(rows.map((r) => [r.location, r] as const));
  let remaining = qty;
  const out: InventoryRow[] = [];
  let qty_from_shop = 0;
  let qty_from_godown = 0;

  for (const loc of ORDER) {
    const row = byLoc.get(loc);
    if (!row) continue;
    const take = Math.min(row.qty, remaining);
    if (take <= 0) continue;
    const now = new Date().toISOString();
    const next = { ...row, qty: row.qty - take, updated_at: now };
    out.push(next);
    byLoc.set(loc, next);
    if (loc === "shop") qty_from_shop += take;
    else qty_from_godown += take;
    remaining -= take;
    if (remaining <= 0) break;
  }

  if (remaining > 0) throw new Error("Insufficient stock");
  return { updates: out, qty_from_shop, qty_from_godown };
}

/** Standalone deduct (own transaction). */
export async function deductInventory(
  userId: string,
  itemId: string,
  qty: number
): Promise<void> {
  const rows = await loadInventoryRows(userId, itemId);
  const { updates } = planDeductQty(rows, qty);
  await db.transaction("rw", [db.inventory, db.sync_queue], async () => {
    for (const row of updates) {
      await db.inventory.put(row);
      await enqueueSync("inventory", "upsert", row.id, { ...row });
    }
  });
}

export type LineDeduction = { item_id: string; qty: number };

export type LineAllocation = {
  qty_from_shop: number;
  qty_from_godown: number;
};

/**
 * Plans inventory updates for a full bill (sequential lines; same item on multiple lines is OK).
 */
export async function planBillDeductions(
  userId: string,
  lines: LineDeduction[]
): Promise<{
  byRowId: Map<string, InventoryRow>;
  lineAllocations: LineAllocation[];
}> {
  const byRowId = new Map<string, InventoryRow>();
  const lineAllocations: LineAllocation[] = [];

  for (const line of lines) {
    const base = await loadInventoryRows(userId, line.item_id);
    const merged = base.map((r) => byRowId.get(r.id) ?? r);
    const { updates, qty_from_shop, qty_from_godown } = planDeductQty(
      merged,
      line.qty
    );
    lineAllocations.push({ qty_from_shop, qty_from_godown });
    for (const u of updates) {
      byRowId.set(u.id, u);
    }
  }

  return { byRowId, lineAllocations };
}
