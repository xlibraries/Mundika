/**
 * Re-queues every local row for all tables so they get pushed to Supabase.
 * Use this after a schema migration that caused previous sync attempts to fail.
 * Safe to run multiple times — Supabase upserts are idempotent.
 */
import { db } from "@/lib/db";
import { enqueueSync } from "@/lib/sync/queue";

export async function resyncAll(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const parties = await db.parties.where("user_id").equals(userId).toArray();
  for (const r of parties) await enqueueSync("parties", "upsert", r.id, { ...r });
  counts.parties = parties.length;

  const items = await db.items.where("user_id").equals(userId).toArray();
  for (const r of items) await enqueueSync("items", "upsert", r.id, { ...r });
  counts.items = items.length;

  const inventory = await db.inventory.where("user_id").equals(userId).toArray();
  for (const r of inventory) await enqueueSync("inventory", "upsert", r.id, { ...r });
  counts.inventory = inventory.length;

  const bills = await db.bills.where("user_id").equals(userId).toArray();
  for (const r of bills) await enqueueSync("bills", "upsert", r.id, { ...r });
  counts.bills = bills.length;

  const billItems = await db.bill_items.where("user_id").equals(userId).toArray();
  for (const r of billItems) await enqueueSync("bill_items", "upsert", r.id, { ...r });
  counts.bill_items = billItems.length;

  const ledger = await db.ledger_entries.where("user_id").equals(userId).toArray();
  for (const r of ledger) await enqueueSync("ledger_entries", "upsert", r.id, { ...r });
  counts.ledger_entries = ledger.length;

  const purchases = await db.purchases.where("user_id").equals(userId).toArray();
  for (const r of purchases) await enqueueSync("purchases", "upsert", r.id, { ...r });
  counts.purchases = purchases.length;

  const purchaseItems = await db.purchase_items.where("user_id").equals(userId).toArray();
  for (const r of purchaseItems) await enqueueSync("purchase_items", "upsert", r.id, { ...r });
  counts.purchase_items = purchaseItems.length;

  const transfers = await db.stock_transfers.where("user_id").equals(userId).toArray();
  for (const r of transfers) await enqueueSync("stock_transfers", "upsert", r.id, { ...r });
  counts.stock_transfers = transfers.length;

  return counts;
}
