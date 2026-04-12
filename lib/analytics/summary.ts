import { db } from "@/lib/db";

export type AnalyticsSummaryFilters = {
  fromDate: string;
  toDate: string;
  partyId?: string;
  itemId?: string;
};

type PartyOption = { id: string; name: string };
type ItemOption = { id: string; name: string; unit: string | null };

type ContactSummaryRow = {
  partyId: string;
  partyName: string;
  sales: number;
  purchases: number;
};

type ItemSummaryRow = {
  itemId: string;
  itemName: string;
  unit: string | null;
  soldQty: number;
  soldValue: number;
  boughtQty: number;
  boughtValue: number;
};

type LowStockRow = {
  itemId: string;
  itemName: string;
  unit: string | null;
  qty: number;
};

export type AnalyticsSummaryResult = {
  options: {
    parties: PartyOption[];
    items: ItemOption[];
  };
  totals: {
    sales: number;
    purchases: number;
    cashSales: number;
    creditSales: number;
    cashPurchases: number;
    creditPurchases: number;
    paymentsLogged: number;
    billsCount: number;
    purchasesCount: number;
    paymentsCount: number;
  };
  topContacts: ContactSummaryRow[];
  topItems: ItemSummaryRow[];
  lowStock: LowStockRow[];
  itemFilterNote: string | null;
};

function inDateRange(date: string, fromDate: string, toDate: string): boolean {
  const d = date.slice(0, 10);
  return d >= fromDate && d <= toDate;
}

export async function getAnalyticsSummary(
  userId: string,
  filters: AnalyticsSummaryFilters
): Promise<AnalyticsSummaryResult> {
  const [parties, items, bills, billItems, purchases, purchaseItems, ledger, inventory] =
    await Promise.all([
      db.parties.where("user_id").equals(userId).toArray(),
      db.items.where("user_id").equals(userId).toArray(),
      db.bills.where("user_id").equals(userId).toArray(),
      db.bill_items.where("user_id").equals(userId).toArray(),
      db.purchases.where("user_id").equals(userId).toArray(),
      db.purchase_items.where("user_id").equals(userId).toArray(),
      db.ledger_entries.where("user_id").equals(userId).toArray(),
      db.inventory.where("user_id").equals(userId).toArray(),
    ]);

  const partyNameById = new Map(parties.map((p) => [p.id, p.name] as const));
  const itemMetaById = new Map(items.map((i) => [i.id, i] as const));

  const itemAmountByBillId = new Map<string, number>();
  for (const row of billItems) {
    if (filters.itemId && row.item_id !== filters.itemId) continue;
    itemAmountByBillId.set(
      row.bill_id,
      (itemAmountByBillId.get(row.bill_id) ?? 0) + row.line_total
    );
  }

  const itemAmountByPurchaseId = new Map<string, number>();
  for (const row of purchaseItems) {
    if (filters.itemId && row.item_id !== filters.itemId) continue;
    itemAmountByPurchaseId.set(
      row.purchase_id,
      (itemAmountByPurchaseId.get(row.purchase_id) ?? 0) + row.line_total
    );
  }

  const contactAgg = new Map<string, { sales: number; purchases: number }>();
  const itemAgg = new Map<
    string,
    {
      soldQty: number;
      soldValue: number;
      boughtQty: number;
      boughtValue: number;
    }
  >();

  let sales = 0;
  let purchasesTotal = 0;
  let cashSales = 0;
  let creditSales = 0;
  let cashPurchases = 0;
  let creditPurchases = 0;
  let billsCount = 0;
  let purchasesCount = 0;

  const includedBillIds = new Set<string>();
  for (const b of bills) {
    if (!inDateRange(b.bill_date, filters.fromDate, filters.toDate)) continue;
    if (filters.partyId && b.party_id !== filters.partyId) continue;

    const includedAmount = filters.itemId ? itemAmountByBillId.get(b.id) ?? 0 : b.total;
    if (!(includedAmount > 0)) continue;

    includedBillIds.add(b.id);
    billsCount += 1;
    sales += includedAmount;
    if (b.bill_type === "cash") cashSales += includedAmount;
    else creditSales += includedAmount;

    const cur = contactAgg.get(b.party_id) ?? { sales: 0, purchases: 0 };
    cur.sales += includedAmount;
    contactAgg.set(b.party_id, cur);
  }

  const includedPurchaseIds = new Set<string>();
  for (const p of purchases) {
    if (!inDateRange(p.purchase_date, filters.fromDate, filters.toDate)) continue;
    if (filters.partyId && p.party_id !== filters.partyId) continue;

    const includedAmount = filters.itemId
      ? itemAmountByPurchaseId.get(p.id) ?? 0
      : p.total;
    if (!(includedAmount > 0)) continue;

    includedPurchaseIds.add(p.id);
    purchasesCount += 1;
    purchasesTotal += includedAmount;
    if (p.payment_type === "cash") cashPurchases += includedAmount;
    else creditPurchases += includedAmount;

    const cur = contactAgg.get(p.party_id) ?? { sales: 0, purchases: 0 };
    cur.purchases += includedAmount;
    contactAgg.set(p.party_id, cur);
  }

  const billById = new Map(bills.map((b) => [b.id, b] as const));
  for (const row of billItems) {
    if (filters.itemId && row.item_id !== filters.itemId) continue;
    const bill = billById.get(row.bill_id);
    if (!bill || !includedBillIds.has(bill.id)) continue;
    const agg = itemAgg.get(row.item_id) ?? {
      soldQty: 0,
      soldValue: 0,
      boughtQty: 0,
      boughtValue: 0,
    };
    agg.soldQty += row.qty;
    agg.soldValue += row.line_total;
    itemAgg.set(row.item_id, agg);
  }

  const purchaseById = new Map(purchases.map((p) => [p.id, p] as const));
  for (const row of purchaseItems) {
    if (filters.itemId && row.item_id !== filters.itemId) continue;
    const purchase = purchaseById.get(row.purchase_id);
    if (!purchase || !includedPurchaseIds.has(purchase.id)) continue;
    const agg = itemAgg.get(row.item_id) ?? {
      soldQty: 0,
      soldValue: 0,
      boughtQty: 0,
      boughtValue: 0,
    };
    agg.boughtQty += row.qty;
    agg.boughtValue += row.line_total;
    itemAgg.set(row.item_id, agg);
  }

  let paymentsLogged = 0;
  let paymentsCount = 0;
  for (const entry of ledger) {
    if (entry.entry_type !== "payment") continue;
    if (!inDateRange(entry.entry_date, filters.fromDate, filters.toDate)) continue;
    if (filters.partyId && entry.party_id !== filters.partyId) continue;
    if (filters.itemId) continue; // Payments are not item-linked.
    paymentsCount += 1;
    paymentsLogged += Math.abs(entry.balance_delta);
  }

  const topContacts: ContactSummaryRow[] = [];
  for (const [partyId, val] of contactAgg) {
    topContacts.push({
      partyId,
      partyName: partyNameById.get(partyId) ?? "Contact",
      sales: Math.round(val.sales * 100) / 100,
      purchases: Math.round(val.purchases * 100) / 100,
    });
  }
  topContacts.sort(
    (a, b) =>
      b.sales + b.purchases - (a.sales + a.purchases) ||
      a.partyName.localeCompare(b.partyName)
  );

  const topItems: ItemSummaryRow[] = [];
  for (const [itemId, agg] of itemAgg) {
    const item = itemMetaById.get(itemId);
    topItems.push({
      itemId,
      itemName: item?.name ?? "Item",
      unit: item?.unit ?? null,
      soldQty: Math.round(agg.soldQty * 100) / 100,
      soldValue: Math.round(agg.soldValue * 100) / 100,
      boughtQty: Math.round(agg.boughtQty * 100) / 100,
      boughtValue: Math.round(agg.boughtValue * 100) / 100,
    });
  }
  topItems.sort(
    (a, b) =>
      b.soldValue + b.boughtValue - (a.soldValue + a.boughtValue) ||
      a.itemName.localeCompare(b.itemName)
  );

  const qtyByItem = new Map<string, number>();
  for (const row of inventory) {
    qtyByItem.set(row.item_id, (qtyByItem.get(row.item_id) ?? 0) + row.qty);
  }
  const lowStock: LowStockRow[] = [];
  for (const [itemId, qty] of qtyByItem) {
    if (qty >= 10) continue;
    const item = itemMetaById.get(itemId);
    lowStock.push({
      itemId,
      itemName: item?.name ?? "Item",
      unit: item?.unit ?? null,
      qty,
    });
  }
  lowStock.sort((a, b) => a.qty - b.qty || a.itemName.localeCompare(b.itemName));

  const partyOptions = parties
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const itemOptions = items
    .map((i) => ({ id: i.id, name: i.name, unit: i.unit ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    options: {
      parties: partyOptions,
      items: itemOptions,
    },
    totals: {
      sales: Math.round(sales * 100) / 100,
      purchases: Math.round(purchasesTotal * 100) / 100,
      cashSales: Math.round(cashSales * 100) / 100,
      creditSales: Math.round(creditSales * 100) / 100,
      cashPurchases: Math.round(cashPurchases * 100) / 100,
      creditPurchases: Math.round(creditPurchases * 100) / 100,
      paymentsLogged: Math.round(paymentsLogged * 100) / 100,
      billsCount,
      purchasesCount,
      paymentsCount,
    },
    topContacts: topContacts.slice(0, 8),
    topItems: topItems.slice(0, 8),
    lowStock: lowStock.slice(0, 8),
    itemFilterNote: filters.itemId
      ? "Payment settlements are not item-linked, so payment totals are hidden for item filters."
      : null,
  };
}
