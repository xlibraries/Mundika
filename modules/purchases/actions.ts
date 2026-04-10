import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type {
  InventoryRow,
  LedgerEntryRow,
  PurchaseItemRow,
  PurchaseRow,
  PurchasePaymentType,
} from "@/lib/types/domain";

export type PurchaseLineInput = {
  item_id: string;
  qty: number;
  unit_cost: number;
  destination: "shop" | "godown";
};

export async function createPurchase(
  userId: string,
  input: {
    party_id: string;
    party_name_snapshot: string;
    purchase_date: string;
    ref_number?: string | null;
    payment_type: PurchasePaymentType;
    lines: PurchaseLineInput[];
    note?: string | null;
  }
): Promise<{ purchase: PurchaseRow }> {
  const party = await db.parties.get(input.party_id);
  if (!party || party.user_id !== userId) {
    throw new Error("Party not found");
  }

  if (input.lines.length === 0) {
    throw new Error("Add at least one line");
  }

  // Validate lines
  for (const l of input.lines) {
    if (!l.item_id) throw new Error("Each line must have an item");
    if (!(l.qty > 0)) throw new Error("Qty must be greater than 0");
    if (l.unit_cost < 0 || Number.isNaN(l.unit_cost))
      throw new Error("Unit cost cannot be negative");
  }

  const lines = input.lines.map((l) => {
    const qty = Number(l.qty);
    const unit_cost = Number(l.unit_cost);
    const line_total = Math.round(qty * unit_cost * 100) / 100;
    return { ...l, qty, unit_cost, line_total };
  });

  const total =
    Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100) / 100;

  const purchaseId = crypto.randomUUID();
  const now = new Date().toISOString();
  const purchaseDate = input.purchase_date.slice(0, 10);

  const existingCount = await db.purchases
    .where("user_id")
    .equals(userId)
    .count();
  const purchase_number = existingCount + 1;

  const purchase: PurchaseRow = {
    id: purchaseId,
    user_id: userId,
    purchase_number,
    party_id: input.party_id,
    party_name_snapshot: input.party_name_snapshot.trim() || party.name,
    purchase_date: purchaseDate,
    ref_number: input.ref_number?.trim() || null,
    payment_type: input.payment_type,
    total,
    note: input.note?.trim() || null,
    created_at: now,
    updated_at: now,
  };

  const purchaseItems: PurchaseItemRow[] = lines.map((l) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    purchase_id: purchaseId,
    item_id: l.item_id,
    qty: l.qty,
    unit_cost: l.unit_cost,
    line_total: l.line_total,
    destination: l.destination,
    created_at: now,
    updated_at: now,
  }));

  // For credit purchases, balance_delta is positive (we owe the party)
  const balance_delta = input.payment_type === "credit" ? total : 0;

  const ledgerId = crypto.randomUUID();
  const ledger: LedgerEntryRow = {
    id: ledgerId,
    user_id: userId,
    party_id: input.party_id,
    party_name_snapshot: purchase.party_name_snapshot,
    entry_type: "purchase",
    balance_delta,
    ref_bill_id: null,
    ref_purchase_id: purchaseId,
    note: input.note?.trim() || null,
    entry_date: purchaseDate,
    created_at: now,
    updated_at: now,
  };

  await db.transaction(
    "rw",
    [
      db.purchases,
      db.purchase_items,
      db.ledger_entries,
      db.inventory,
      db.sync_queue,
    ],
    async () => {
      // Increment inventory for each purchase line
      for (const item of purchaseItems) {
        const existing = await db.inventory
          .where("user_id")
          .equals(userId)
          .filter(
            (r) => r.item_id === item.item_id && r.location === item.destination
          )
          .first();

        let invRow: InventoryRow;
        if (existing) {
          invRow = {
            ...existing,
            qty: existing.qty + item.qty,
            updated_at: now,
          };
        } else {
          invRow = {
            id: crypto.randomUUID(),
            user_id: userId,
            item_id: item.item_id,
            location: item.destination,
            qty: item.qty,
            created_at: now,
            updated_at: now,
          };
        }
        await db.inventory.put(invRow);
        await enqueueSync("inventory", "upsert", invRow.id, { ...invRow });
      }

      await db.purchases.put(purchase);
      await enqueueSync("purchases", "upsert", purchaseId, { ...purchase });

      for (const row of purchaseItems) {
        await db.purchase_items.put(row);
        await enqueueSync("purchase_items", "upsert", row.id, { ...row });
      }

      await db.ledger_entries.put(ledger);
      await enqueueSync("ledger_entries", "upsert", ledgerId, { ...ledger });
    }
  );

  return { purchase };
}
