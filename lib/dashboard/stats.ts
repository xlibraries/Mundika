import { db } from "@/lib/db";

const LOW_STOCK = 10;

export async function getDashboardStats(userId: string, day: string) {
  const dayStr = day.slice(0, 10);

  const bills = await db.bills
    .where("user_id")
    .equals(userId)
    .filter((b) => b.bill_date === dayStr)
    .toArray();

  let salesTotal = 0;
  let cashTotal = 0;
  let creditTotal = 0;
  for (const b of bills) {
    salesTotal += b.total;
    if (b.bill_type === "cash") cashTotal += b.total;
    else creditTotal += b.total;
  }

  // No purchase flow exists yet; always 0 until a purchase entry type is implemented.
  const purchasesTotal = 0;

  const inv = await db.inventory
    .where("user_id")
    .equals(userId)
    .toArray();
  const qtyByItem = new Map<string, number>();
  for (const r of inv) {
    qtyByItem.set(r.item_id, (qtyByItem.get(r.item_id) ?? 0) + r.qty);
  }
  const lowStock: { item_id: string; name: string; qty: number }[] = [];
  const items = await db.items.where("user_id").equals(userId).toArray();
  const itemName = new Map(items.map((i) => [i.id, i.name] as const));
  for (const [itemId, qty] of qtyByItem) {
    if (qty <= LOW_STOCK) {
      lowStock.push({
        item_id: itemId,
        name: itemName.get(itemId) ?? "Item",
        qty,
      });
    }
  }
  lowStock.sort((a, b) => a.qty - b.qty);

  return {
    billsCount: bills.length,
    salesTotal,
    cashTotal,
    creditTotal,
    purchasesTotal,
    lowStock,
  };
}
