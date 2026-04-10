/** Shared domain types — mirror local + Supabase (snake_case fields). */

export type InventoryLocation = "shop" | "godown";

export type BillType = "cash" | "credit";

export type LedgerEntryType = "sale" | "payment" | "purchase";

export type SyncOp = "upsert" | "delete";

export interface PartyRow {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemRow {
  id: string;
  user_id: string;
  name: string;
  /**
   * Display-only label (e.g. "bag", "10Kg"). Shop/godown quantities are plain
   * numbers in that label’s row; there is no separate pack vs base-unit layer
   * in billing or deductions yet.
   */
  unit: string | null;
  rate_default: number | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryRow {
  id: string;
  user_id: string;
  item_id: string;
  location: InventoryLocation;
  qty: number;
  created_at: string;
  updated_at: string;
}

export interface BillRow {
  id: string;
  user_id: string;
  party_id: string;
  party_name_snapshot: string;
  bill_date: string;
  total: number;
  bill_type: BillType;
  vehicle_info: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillItemRow {
  id: string;
  user_id: string;
  bill_id: string;
  item_id: string;
  qty: number;
  rate: number;
  line_total: number;
  /** Qty taken from shop for this line (for delete / restore). */
  qty_from_shop?: number;
  /** Qty taken from godown for this line. */
  qty_from_godown?: number;
  created_at: string;
  updated_at: string;
}

/** Signed delta toward party running balance (credit sale +, payment -). */
export interface LedgerEntryRow {
  id: string;
  user_id: string;
  party_id: string;
  party_name_snapshot: string | null;
  entry_type: LedgerEntryType;
  balance_delta: number;
  ref_bill_id: string | null;
  note: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

export interface SyncQueueRow {
  id: string;
  table_name: string;
  op: SyncOp;
  row_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
}
