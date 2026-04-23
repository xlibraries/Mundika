/** Shared copy for Khata context (analytics hero + ledger totals were aligned here). */

export function ledgerFilterPeriodHint(filters: {
  fromDate: string;
  toDate: string;
}): string {
  const { fromDate, toDate } = filters;
  if (fromDate && toDate) return `${fromDate} → ${toDate}`;
  if (fromDate) return `From ${fromDate}`;
  if (toDate) return `Until ${toDate}`;
  return "All dates in view";
}

export function ledgerKhataContactTitle(
  partyId: string,
  parties: Array<{ id: string; name: string }>
): string {
  if (!partyId) return "All contacts";
  return parties.find((p) => p.id === partyId)?.name ?? "Contact";
}
