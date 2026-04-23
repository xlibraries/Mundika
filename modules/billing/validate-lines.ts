export type BillLineInput = {
  item_id: string;
  qty: number;
  rate: number;
};

export function validateBillLines(lines: BillLineInput[]) {
  for (const line of lines) {
    if (!line.item_id) throw new Error("Each line must have an item");
    if (!Number.isFinite(line.qty) || !(line.qty > 0)) {
      throw new Error("Qty must be greater than 0");
    }
    if (!Number.isFinite(line.rate) || line.rate < 0) {
      throw new Error("Rate cannot be negative");
    }
  }
}
