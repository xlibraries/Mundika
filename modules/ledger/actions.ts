import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";
import type { LedgerEntryRow, PaymentMode } from "@/lib/types/domain";

export async function createLedgerPayment(
  userId: string,
  input: {
    party_id: string;
    party_name_snapshot?: string;
    entry_date: string;
    amount: number;
    payment_mode: PaymentMode;
    payment_reference?: string | null;
    note?: string | null;
    /** When set, khata groups this payment under that bill’s sale row. */
    ref_bill_id?: string | null;
    /** When set, khata groups this payment under that purchase row. */
    ref_purchase_id?: string | null;
  }
): Promise<LedgerEntryRow> {
  const party = await db.parties.get(input.party_id);
  if (!party || party.user_id !== userId) {
    throw new Error("Party not found");
  }

  const amount = Number(input.amount);
  if (!(amount > 0) || Number.isNaN(amount)) {
    throw new Error("Amount must be greater than 0");
  }

  let refBillId: string | null = null;
  let refPurchaseId: string | null = null;
  if (input.ref_bill_id) {
    if (input.ref_purchase_id) {
      throw new Error("Link to either a bill or a purchase, not both");
    }
    const bill = await db.bills.get(input.ref_bill_id);
    if (!bill || bill.user_id !== userId) {
      throw new Error("Bill not found");
    }
    if (bill.party_id !== input.party_id) {
      throw new Error("Bill does not belong to this contact");
    }
    refBillId = input.ref_bill_id;
  } else if (input.ref_purchase_id) {
    const purchase = await db.purchases.get(input.ref_purchase_id);
    if (!purchase || purchase.user_id !== userId) {
      throw new Error("Purchase not found");
    }
    if (purchase.party_id !== input.party_id) {
      throw new Error("Purchase does not belong to this contact");
    }
    refPurchaseId = input.ref_purchase_id;
  }

  const now = new Date().toISOString();
  const row: LedgerEntryRow = {
    id: crypto.randomUUID(),
    user_id: userId,
    party_id: input.party_id,
    party_name_snapshot: input.party_name_snapshot?.trim() || party.name,
    entry_type: "payment",
    // Payment settlement reduces outstanding credit balance.
    balance_delta: -Math.round(amount * 100) / 100,
    ref_bill_id: refBillId,
    ref_purchase_id: refPurchaseId,
    payment_mode: input.payment_mode,
    payment_reference: input.payment_reference?.trim() || null,
    note: input.note?.trim() || null,
    entry_date: input.entry_date.slice(0, 10),
    created_at: now,
    updated_at: now,
  };

  await db.transaction("rw", [db.ledger_entries, db.sync_queue], async () => {
    await db.ledger_entries.put(row);
    await enqueueSync("ledger_entries", "upsert", row.id, { ...row });
  });

  return row;
}
