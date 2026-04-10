/** Parse a non-negative stock quantity for shop/godown cells. */

export type ParsedQty = { ok: true; qty: number } | { ok: false };

const MAX_QTY = 1e12;

export function parseNonnegativeStockQty(raw: string): ParsedQty {
  const t = raw.trim();
  if (t === "") return { ok: false };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > MAX_QTY) return { ok: false };
  return { ok: true, qty: n };
}
