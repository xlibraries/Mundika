import Dexie, { type Table } from "dexie";
import type {
  BillItemRow,
  BillRow,
  InventoryRow,
  ItemRow,
  LedgerEntryRow,
  PartyRow,
  PurchaseItemRow,
  PurchaseRow,
  SyncQueueRow,
} from "@/lib/types/domain";

export class MundikaDB extends Dexie {
  parties!: Table<PartyRow, string>;
  items!: Table<ItemRow, string>;
  inventory!: Table<InventoryRow, string>;
  bills!: Table<BillRow, string>;
  bill_items!: Table<BillItemRow, string>;
  ledger_entries!: Table<LedgerEntryRow, string>;
  sync_queue!: Table<SyncQueueRow, string>;
  purchases!: Table<PurchaseRow, string>;
  purchase_items!: Table<PurchaseItemRow, string>;

  constructor() {
    super("mundika");
    this.version(1).stores({
      parties: "id, user_id, name, updated_at",
      items: "id, user_id, name, updated_at",
      inventory: "id, user_id, item_id, location, updated_at",
      bills: "id, user_id, party_id, bill_date, updated_at",
      bill_items: "id, user_id, bill_id, item_id, updated_at",
      ledger_entries: "id, user_id, party_id, entry_date, updated_at",
      sync_queue: "id, table_name, created_at",
    });
    // v2: adds bill_number index (existing rows get undefined — handled gracefully)
    this.version(2).stores({
      bills: "id, user_id, party_id, bill_date, bill_number, updated_at",
    });
    // v3: adds purchases and purchase_items tables
    this.version(3).stores({
      purchases:
        "id, user_id, party_id, purchase_date, purchase_number, updated_at",
      purchase_items: "id, user_id, purchase_id, item_id, updated_at",
    });
  }
}

export const db = new MundikaDB();
