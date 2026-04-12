import type { BillRow, LedgerEntryRow, PurchaseRow } from "@/lib/types/domain";
import type { BillPrintLine } from "@/components/billing/bill-document";
import type { PurchasePrintLine } from "@/components/billing/purchase-document";
import { formatINR } from "@/lib/format/inr";
import { paymentModeLabel } from "@/lib/billing/payment-mode-label";

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DOC_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 14px; line-height: 1.45; color: #1a1a1a; background: #fafafa; }
  .sheet { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #ccc; padding: 28px 32px; }
  h1 { margin: 0 0 4px; font-size: 1.5rem; }
  .muted { color: #555; font-size: 0.85rem; }
  .label { color: #666; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .row { margin: 8px 0; display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: baseline; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
  th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.center { text-align: center; }
  .total { margin-top: 16px; display: flex; justify-content: space-between; font-weight: 600; font-size: 1.1rem; }
  .hint { max-width: 720px; margin: 16px auto 0; font-size: 12px; color: #666; }
`;

function wrapDoc(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>${DOC_STYLES}</style>
</head>
<body>
<div class="sheet">${inner}</div>
<p class="hint">Open this file in your browser. Use <strong>Print → Save as PDF</strong> if you need a PDF copy.</p>
</body>
</html>`;
}

export function downloadHtmlFile(filename: string, htmlDocument: string): void {
  const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeDownloadBasename(part: string, max = 44): string {
  const cleaned = part.replace(/[/\\?%*:|"<>]/g, "-").trim().slice(0, max);
  return cleaned || "document";
}

export function buildBillDownloadHtml(
  bill: BillRow,
  lines: BillPrintLine[]
): string {
  const num = bill.bill_number != null ? `#${bill.bill_number}` : "Draft";
  const billPaymentLine =
    bill.bill_type === "cash"
      ? `Paid · ${paymentModeLabel(bill.payment_mode)}${
          bill.payment_reference ? ` · ${escapeHtml(bill.payment_reference)}` : ""
        }`
      : "Credit — amount added to party balance";

  const lineRows = lines
    .map(
      (l) =>
        `<tr>
  <td>${escapeHtml(l.itemName)}${l.unit ? ` <span class="muted">(${escapeHtml(l.unit)})</span>` : ""}</td>
  <td class="center">${escapeHtml(String(l.qty))}</td>
  <td class="num">${escapeHtml(formatINR(l.rate))}</td>
  <td class="num">${escapeHtml(formatINR(l.line_total))}</td>
</tr>`
    )
    .join("\n");

  const inner = `
<p class="label">Bill / Invoice</p>
<h1>${escapeHtml(num)}</h1>
<p class="muted">${escapeHtml(bill.bill_date)}</p>
<div class="row"><span class="muted">Customer</span> <strong>${escapeHtml(bill.party_name_snapshot)}</strong></div>
${bill.vehicle_info ? `<div class="row"><span class="muted">Vehicle / ref.</span> ${escapeHtml(bill.vehicle_info)}</div>` : ""}
${bill.address ? `<div class="row"><span class="muted">Address</span> ${escapeHtml(bill.address)}</div>` : ""}
${bill.phone ? `<div class="row"><span class="muted">Phone</span> ${escapeHtml(bill.phone)}</div>` : ""}
<div class="row"><span class="muted">Payment</span> ${billPaymentLine}</div>
<table>
  <thead><tr><th>Item</th><th class="center">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
  <tbody>${lineRows}</tbody>
</table>
<div class="total"><span>Total</span><span>${escapeHtml(formatINR(bill.total))}</span></div>
`;
  return wrapDoc(`Bill ${num}`, inner);
}

function destLabel(d: "shop" | "godown"): string {
  return d === "shop" ? "Shop" : "Godown";
}

export function buildPurchaseDownloadHtml(
  purchase: PurchaseRow,
  lines: PurchasePrintLine[]
): string {
  const num = `#${purchase.purchase_number}`;
  const purchasePaymentLine =
    purchase.payment_type === "cash"
      ? `Paid · ${paymentModeLabel(purchase.payment_mode)}${
          purchase.payment_reference
            ? ` · ${escapeHtml(purchase.payment_reference)}`
            : ""
        }`
      : "Credit — amount added to supplier balance";

  const lineRows = lines
    .map(
      (l) =>
        `<tr>
  <td>${escapeHtml(l.itemName)}${l.unit ? ` <span class="muted">(${escapeHtml(l.unit)})</span>` : ""}</td>
  <td class="center">${escapeHtml(destLabel(l.destination))}</td>
  <td class="center">${escapeHtml(String(l.qty))}</td>
  <td class="num">${escapeHtml(formatINR(l.unit_cost))}</td>
  <td class="num">${escapeHtml(formatINR(l.line_total))}</td>
</tr>`
    )
    .join("\n");

  const inner = `
<p class="label">Purchase / GRN</p>
<h1>${escapeHtml(num)}</h1>
<p class="muted">${escapeHtml(purchase.purchase_date)}</p>
<div class="row"><span class="muted">Supplier</span> <strong>${escapeHtml(purchase.party_name_snapshot)}</strong></div>
${purchase.ref_number ? `<div class="row"><span class="muted">Supplier ref.</span> ${escapeHtml(purchase.ref_number)}</div>` : ""}
${purchase.address ? `<div class="row"><span class="muted">Address</span> ${escapeHtml(purchase.address)}</div>` : ""}
${purchase.phone ? `<div class="row"><span class="muted">Phone</span> ${escapeHtml(purchase.phone)}</div>` : ""}
<div class="row"><span class="muted">Payment</span> ${purchasePaymentLine}</div>
${purchase.note ? `<div class="row"><span class="muted">Note</span> ${escapeHtml(purchase.note)}</div>` : ""}
<table>
  <thead><tr><th>Item</th><th class="center">Stock to</th><th class="center">Qty</th><th class="num">Unit cost</th><th class="num">Amount</th></tr></thead>
  <tbody>${lineRows}</tbody>
</table>
<div class="total"><span>Total</span><span>${escapeHtml(formatINR(purchase.total))}</span></div>
`;
  return wrapDoc(`Purchase ${num}`, inner);
}

export function buildPaymentReceiptDownloadHtml(r: LedgerEntryRow): string {
  const amount = formatINR(Math.abs(r.balance_delta));
  const inner = `
<p class="label">Payment receipt</p>
<h1>${escapeHtml(amount)}</h1>
<p class="muted">Date: ${escapeHtml(r.entry_date)}</p>
<div class="row"><span class="muted">Contact</span> <strong>${escapeHtml(r.party_name_snapshot ?? "—")}</strong></div>
<div class="row"><span class="muted">Medium</span> ${escapeHtml(paymentModeLabel(r.payment_mode))}</div>
<div class="row"><span class="muted">Transaction ID</span> ${escapeHtml(r.payment_reference ?? "—")}</div>
${r.note ? `<div class="row"><span class="muted">Note</span> ${escapeHtml(r.note)}</div>` : ""}
<p class="muted" style="margin-top:20px">This payment reduced the contact's outstanding balance (ledger).</p>
`;
  return wrapDoc(`Payment ${r.entry_date}`, inner);
}
