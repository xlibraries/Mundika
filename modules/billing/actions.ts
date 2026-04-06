import { db } from "@/lib/db";
import { planBillDeductions } from "@/modules/inventory/deduct";
import { enqueueSync } from "@/lib/sync/queue";
import type {
  BillItemRow,
  BillRow,
  BillType,
  LedgerEntryRow,
} from "@/lib/types/domain";

export type BillLineInput = {
  item_id: string;
  qty: number;
  rate: number;
};

export async function createBill(
  userId: string,
  input: {
    party_id: string;
    party_name_snapshot: string;
    bill_date: string;
    bill_type: BillType;
    vehicle_info?: string | null;
    lines: BillLineInput[];
  }
): Promise<{ bill: BillRow }> {
  const party = await db.parties.get(input.party_id);
  if (!party || party.user_id !== userId) {
    throw new Error("Party not found");
  }

  if (input.lines.length === 0) {
    throw new Error("Add at least one line");
  }

  const lines = input.lines.map((l) => {
    const qty = Number(l.qty);
    const rate = Number(l.rate);
    const line_total = Math.round(qty * rate * 100) / 100;
    return { ...l, qty, rate, line_total };
  });

  const total =
    Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100) / 100;

  const billId = crypto.randomUUID();
  const now = new Date().toISOString();
  const billDate = input.bill_date.slice(0, 10);

  const bill: BillRow = {
    id: billId,
    user_id: userId,
    party_id: input.party_id,
    party_name_snapshot: input.party_name_snapshot.trim() || party.name,
    bill_date: billDate,
    total,
    bill_type: input.bill_type,
    vehicle_info: input.vehicle_info?.trim() || null,
    created_at: now,
    updated_at: now,
  };

  const { byRowId: invPlan, lineAllocations } = await planBillDeductions(
    userId,
    lines.map((l) => ({ item_id: l.item_id, qty: l.qty }))
  );

  const billItems: BillItemRow[] = lines.map((l, i) => {
    const id = crypto.randomUUID();
    const a = lineAllocations[i];
    return {
      id,
      user_id: userId,
      bill_id: billId,
      item_id: l.item_id,
      qty: l.qty,
      rate: l.rate,
      line_total: l.line_total,
      qty_from_shop: a.qty_from_shop,
      qty_from_godown: a.qty_from_godown,
      created_at: now,
      updated_at: now,
    };
  });

  const balance_delta = input.bill_type === "credit" ? total : 0;

  const ledgerId = crypto.randomUUID();
  const ledger: LedgerEntryRow = {
    id: ledgerId,
    user_id: userId,
    party_id: input.party_id,
    party_name_snapshot: bill.party_name_snapshot,
    entry_type: "sale",
    balance_delta,
    ref_bill_id: billId,
    note: null,
    entry_date: billDate,
    created_at: now,
    updated_at: now,
  };

  await db.transaction(
    "rw",
    [
      db.bills,
      db.bill_items,
      db.ledger_entries,
      db.inventory,
      db.sync_queue,
    ],
    async () => {
      for (const row of invPlan.values()) {
        await db.inventory.put(row);
        await enqueueSync("inventory", "upsert", row.id, { ...row });
      }

      await db.bills.put(bill);
      await enqueueSync("bills", "upsert", billId, { ...bill });

      for (const row of billItems) {
        await db.bill_items.put(row);
        await enqueueSync("bill_items", "upsert", row.id, { ...row });
      }

      await db.ledger_entries.put(ledger);
      await enqueueSync("ledger_entries", "upsert", ledgerId, { ...ledger });
    }
  );

  return { bill };
}
