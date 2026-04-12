import type { PurchaseRow } from "@/lib/types/domain";
import { formatINR } from "@/lib/format/inr";
import { paymentModeLabel } from "@/lib/billing/payment-mode-label";
import { cn } from "@/lib/cn";

export type PurchasePrintLine = {
  itemName: string;
  unit: string | null;
  qty: number;
  unit_cost: number;
  line_total: number;
  destination: "shop" | "godown";
};

type PurchaseDocumentViewProps = {
  purchase: PurchaseRow;
  lines: PurchasePrintLine[];
};

function destLabel(d: "shop" | "godown"): string {
  return d === "shop" ? "Shop" : "Godown";
}

export function PurchaseDocumentView({
  purchase,
  lines,
}: PurchaseDocumentViewProps) {
  const num = `#${purchase.purchase_number}`;
  const paymentLine =
    purchase.payment_type === "cash"
      ? `Paid · ${paymentModeLabel(purchase.payment_mode)}${
          purchase.payment_reference ? ` · ${purchase.payment_reference}` : ""
        }`
      : "Credit — amount added to supplier balance";

  return (
    <article
      className={cn(
        "mundika-doc-sheet rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] p-6 text-[var(--gs-text)] shadow-sm"
      )}
    >
      <header className="border-b border-[var(--gs-border)] pb-4 text-center print:border-black">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gs-text-secondary)] print:text-neutral-600">
          Purchase / GRN
        </p>
        <h1 className="mt-1 font-semibold tracking-tight text-[var(--gs-text)] print:text-xl print:text-black">
          {num}
        </h1>
        <p className="mt-1 font-mono text-sm text-[var(--gs-text-secondary)] print:text-neutral-700">
          {purchase.purchase_date}
        </p>
      </header>

      <div className="mt-4 grid gap-1 text-sm print:text-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
            Supplier
          </span>
          <span className="font-medium text-[var(--gs-text)] print:text-black">
            {purchase.party_name_snapshot}
          </span>
        </div>
        {purchase.ref_number ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
              Supplier ref.
            </span>
            <span className="font-mono print:text-black">{purchase.ref_number}</span>
          </div>
        ) : null}
        {purchase.address ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
              Address
            </span>
            <span className="max-w-prose print:text-black">{purchase.address}</span>
          </div>
        ) : null}
        {purchase.phone ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
              Phone
            </span>
            <span className="font-mono print:text-black">{purchase.phone}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
            Payment
          </span>
          <span className="capitalize print:text-black">{paymentLine}</span>
        </div>
        {purchase.note ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
              Note
            </span>
            <span className="max-w-prose print:text-black">{purchase.note}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-[var(--gs-border)] print:border-black">
        <table className="w-full border-collapse text-left text-sm print:text-sm">
          <thead>
            <tr className="border-b border-[var(--gs-border)] bg-[var(--gs-surface)] text-[11px] font-medium uppercase tracking-wide text-[var(--gs-text-secondary)] print:border-black print:bg-neutral-100 print:text-neutral-700">
              <th className="px-3 py-2">Item</th>
              <th className="w-20 px-2 py-2 text-center">Stock to</th>
              <th className="w-14 px-2 py-2 text-center">Qty</th>
              <th className="w-28 px-2 py-2 text-right">Unit cost</th>
              <th className="w-32 px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--gs-grid)] print:divide-neutral-200">
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="px-3 py-2.5 print:text-black">
                  <span className="font-medium">{line.itemName}</span>
                  {line.unit ? (
                    <span className="ml-1 text-[var(--gs-text-secondary)] print:text-neutral-600">
                      ({line.unit})
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2.5 text-center text-xs print:text-black">
                  {destLabel(line.destination)}
                </td>
                <td className="px-2 py-2.5 text-center font-mono tabular-nums print:text-black">
                  {line.qty}
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[var(--gs-text-secondary)] print:text-neutral-800">
                  {formatINR(line.unit_cost)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums font-medium text-[var(--gs-text)] print:text-black">
                  {formatINR(line.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="mt-4 flex items-center justify-between border-t border-[var(--gs-border)] pt-4 print:border-black">
        <span className="text-sm font-medium text-[var(--gs-text-secondary)] print:text-neutral-700">
          Total
        </span>
        <span className="text-lg font-semibold tabular-nums tracking-tight text-[var(--gs-text)] print:text-xl print:text-black">
          {formatINR(purchase.total)}
        </span>
      </footer>
    </article>
  );
}
