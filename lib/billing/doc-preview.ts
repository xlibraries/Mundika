import { db } from "@/lib/db";
import type { BillRow, PurchaseRow } from "@/lib/types/domain";
import type { BillPrintLine } from "@/components/billing/bill-document";
import type { PurchasePrintLine } from "@/components/billing/purchase-document";

export type TxDocPreview =
  | { kind: "bill"; bill: BillRow; lines: BillPrintLine[] }
  | { kind: "purchase"; purchase: PurchaseRow; lines: PurchasePrintLine[] };

export async function loadBillPrintPayload(
  userId: string,
  billId: string
): Promise<{ bill: BillRow; lines: BillPrintLine[] } | null> {
  const bill = await db.bills.get(billId);
  if (!bill || bill.user_id !== userId) return null;

  const allItems = await db.items.where("user_id").equals(userId).toArray();
  const itemById = new Map(allItems.map((it) => [it.id, it] as const));
  const rows = await db.bill_items.where("bill_id").equals(billId).toArray();
  rows.sort((a, b) =>
    (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1
  );
  const lines: BillPrintLine[] = [];
  for (const row of rows) {
    const it = itemById.get(row.item_id);
    lines.push({
      itemName: it?.name ?? "Item",
      unit: it?.unit ?? null,
      qty: row.qty,
      rate: row.rate,
      line_total: row.line_total,
    });
  }
  return { bill, lines };
}

export async function loadPurchasePrintPayload(
  userId: string,
  purchaseId: string
): Promise<{ purchase: PurchaseRow; lines: PurchasePrintLine[] } | null> {
  const purchase = await db.purchases.get(purchaseId);
  if (!purchase || purchase.user_id !== userId) return null;

  const allItems = await db.items.where("user_id").equals(userId).toArray();
  const itemById = new Map(allItems.map((it) => [it.id, it] as const));
  const rows = await db.purchase_items
    .where("purchase_id")
    .equals(purchaseId)
    .toArray();
  rows.sort((a, b) =>
    (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1
  );
  const lines: PurchasePrintLine[] = [];
  for (const row of rows) {
    const it = itemById.get(row.item_id);
    lines.push({
      itemName: it?.name ?? "Item",
      unit: it?.unit ?? null,
      qty: row.qty,
      unit_cost: row.unit_cost,
      line_total: row.line_total,
      destination: row.destination,
    });
  }
  return { purchase, lines };
}

export function triggerDocumentPrint(): void {
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    document.documentElement.classList.remove("mundika-printing-doc");
    window.removeEventListener("afterprint", cleanup);
  };
  document.documentElement.classList.add("mundika-printing-doc");
  window.addEventListener("afterprint", cleanup);
  requestAnimationFrame(() => {
    window.print();
    window.setTimeout(cleanup, 2000);
  });
}
