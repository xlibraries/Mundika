import { createClient } from "@/utils/supabase/client";
import { db } from "@/lib/db";
import type {
  BillItemRow,
  BillRow,
  InventoryRow,
  ItemRow,
  LedgerEntryRow,
  PartyRow,
  PurchaseItemRow,
  PurchaseRow,
  StockTransferRow,
} from "@/lib/types/domain";

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nnum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function mapParty(r: Record<string, unknown>): PartyRow {
  return {
    id: str(r.id),
    user_id: str(r.user_id),
    name: str(r.name),
    phone: r.phone == null || r.phone === "" ? null : str(r.phone),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
}

function mapItem(r: Record<string, unknown>): ItemRow {
  return {
    id: str(r.id),
    user_id: str(r.user_id),
    name: str(r.name),
    unit: r.unit == null || r.unit === "" ? null : str(r.unit),
    rate_default: nnum(r.rate_default),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
}

function mapInventory(r: Record<string, unknown>): InventoryRow {
  return {
    id: str(r.id),
    user_id: str(r.user_id),
    item_id: str(r.item_id),
    location: r.location === "godown" ? "godown" : "shop",
    qty: num(r.qty),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
}

function mapBill(r: Record<string, unknown>): BillRow {
  const row: BillRow = {
    id: str(r.id),
    user_id: str(r.user_id),
    party_id: str(r.party_id),
    party_name_snapshot: str(r.party_name_snapshot),
    bill_date: str(r.bill_date).slice(0, 10),
    total: num(r.total),
    bill_type: r.bill_type === "credit" ? "credit" : "cash",
    vehicle_info: r.vehicle_info == null ? null : str(r.vehicle_info),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
  if (r.bill_number != null && r.bill_number !== "")
    row.bill_number = Math.round(num(r.bill_number));
  if (r.address != null) row.address = str(r.address) || null;
  if (r.phone != null) row.phone = str(r.phone) || null;
  return row;
}

function mapBillItem(r: Record<string, unknown>): BillItemRow {
  const row: BillItemRow = {
    id: str(r.id),
    user_id: str(r.user_id),
    bill_id: str(r.bill_id),
    item_id: str(r.item_id),
    qty: num(r.qty),
    rate: num(r.rate),
    line_total: num(r.line_total),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
  if (r.qty_from_shop != null) row.qty_from_shop = num(r.qty_from_shop);
  if (r.qty_from_godown != null) row.qty_from_godown = num(r.qty_from_godown);
  return row;
}

function mapPurchase(r: Record<string, unknown>): PurchaseRow {
  const row: PurchaseRow = {
    id: str(r.id),
    user_id: str(r.user_id),
    purchase_number: Math.round(num(r.purchase_number)),
    party_id: str(r.party_id),
    party_name_snapshot: str(r.party_name_snapshot),
    purchase_date: str(r.purchase_date).slice(0, 10),
    ref_number: r.ref_number == null || r.ref_number === "" ? null : str(r.ref_number),
    payment_type: r.payment_type === "credit" ? "credit" : "cash",
    total: num(r.total),
    note: r.note == null || r.note === "" ? null : str(r.note),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
  if (r.address != null) row.address = str(r.address) || null;
  if (r.phone != null) row.phone = str(r.phone) || null;
  return row;
}

function mapPurchaseItem(r: Record<string, unknown>): PurchaseItemRow {
  return {
    id: str(r.id),
    user_id: str(r.user_id),
    purchase_id: str(r.purchase_id),
    item_id: str(r.item_id),
    qty: num(r.qty),
    unit_cost: num(r.unit_cost),
    line_total: num(r.line_total),
    destination: r.destination === "shop" ? "shop" : "godown",
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
}

function mapLedger(r: Record<string, unknown>): LedgerEntryRow {
  return {
    id: str(r.id),
    user_id: str(r.user_id),
    party_id: str(r.party_id),
    party_name_snapshot:
      r.party_name_snapshot == null ? null : str(r.party_name_snapshot),
    entry_type:
      r.entry_type === "purchase"
        ? "purchase"
        : r.entry_type === "payment"
          ? "payment"
          : "sale",
    balance_delta: num(r.balance_delta),
    ref_bill_id: r.ref_bill_id == null || r.ref_bill_id === "" ? null : str(r.ref_bill_id),
    ref_purchase_id:
      r.ref_purchase_id == null || r.ref_purchase_id === ""
        ? null
        : str(r.ref_purchase_id),
    note: r.note == null || r.note === "" ? null : str(r.note),
    entry_date: str(r.entry_date).slice(0, 10),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
}

function mapTransfer(r: Record<string, unknown>): StockTransferRow {
  return {
    id: str(r.id),
    user_id: str(r.user_id),
    item_id: str(r.item_id),
    item_name_snapshot: str(r.item_name_snapshot),
    from_location: r.from_location === "shop" ? "shop" : "godown",
    to_location: r.to_location === "shop" ? "shop" : "godown",
    qty: num(r.qty),
    note: r.note == null || r.note === "" ? null : str(r.note),
    transfer_date: str(r.transfer_date).slice(0, 10),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
}

async function fetchRows(
  table: string,
  userId: string
): Promise<Record<string, unknown>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Replace this user's mirrored tables in IndexedDB with data from Supabase.
 * Call only after outbound sync queue is empty (see {@link syncWithRemote}).
 */
export async function pullRemoteToLocal(userId: string): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const [
    partyRows,
    itemRows,
    invRows,
    billRows,
    billItemRows,
    purchaseRows,
    purchaseItemRows,
    ledgerRows,
    transferRows,
  ] = await Promise.all([
    fetchRows("parties", userId),
    fetchRows("items", userId),
    fetchRows("inventory", userId),
    fetchRows("bills", userId),
    fetchRows("bill_items", userId),
    fetchRows("purchases", userId),
    fetchRows("purchase_items", userId),
    fetchRows("ledger_entries", userId),
    fetchRows("stock_transfers", userId),
  ]);

  const parties = partyRows.map(mapParty);
  const items = itemRows.map(mapItem);
  const inventory = invRows.map(mapInventory);
  const bills = billRows.map(mapBill);
  const billItems = billItemRows.map(mapBillItem);
  const purchases = purchaseRows.map(mapPurchase);
  const purchaseItems = purchaseItemRows.map(mapPurchaseItem);
  const ledger = ledgerRows.map(mapLedger);
  const transfers = transferRows.map(mapTransfer);

  await db.transaction(
    "rw",
    [
      db.stock_transfers,
      db.purchase_items,
      db.purchases,
      db.ledger_entries,
      db.bill_items,
      db.bills,
      db.inventory,
      db.items,
      db.parties,
    ],
    async () => {
      await db.stock_transfers.where("user_id").equals(userId).delete();
      await db.purchase_items.where("user_id").equals(userId).delete();
      await db.purchases.where("user_id").equals(userId).delete();
      await db.ledger_entries.where("user_id").equals(userId).delete();
      await db.bill_items.where("user_id").equals(userId).delete();
      await db.bills.where("user_id").equals(userId).delete();
      await db.inventory.where("user_id").equals(userId).delete();
      await db.items.where("user_id").equals(userId).delete();
      await db.parties.where("user_id").equals(userId).delete();

      if (parties.length) await db.parties.bulkPut(parties);
      if (items.length) await db.items.bulkPut(items);
      if (inventory.length) await db.inventory.bulkPut(inventory);
      if (bills.length) await db.bills.bulkPut(bills);
      if (billItems.length) await db.bill_items.bulkPut(billItems);
      if (purchases.length) await db.purchases.bulkPut(purchases);
      if (purchaseItems.length) await db.purchase_items.bulkPut(purchaseItems);
      if (ledger.length) await db.ledger_entries.bulkPut(ledger);
      if (transfers.length) await db.stock_transfers.bulkPut(transfers);
    }
  );
}
