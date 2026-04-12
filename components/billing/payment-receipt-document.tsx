import type { LedgerEntryRow } from "@/lib/types/domain";
import { formatINR } from "@/lib/format/inr";
import { paymentModeLabel } from "@/lib/billing/payment-mode-label";
import { cn } from "@/lib/cn";

export function PaymentReceiptDocumentView({
  entry,
}: {
  entry: LedgerEntryRow;
}) {
  const amount = formatINR(Math.abs(entry.balance_delta));

  return (
    <article
      className={cn(
        "mundika-doc-sheet rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] p-6 text-[var(--gs-text)] shadow-sm"
      )}
    >
      <header className="border-b border-[var(--gs-border)] pb-4 text-center print:border-black">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gs-text-secondary)] print:text-neutral-600">
          Payment receipt
        </p>
        <h1 className="mt-1 font-semibold tracking-tight text-[var(--gs-text)] print:text-xl print:text-black">
          {amount}
        </h1>
        <p className="mt-1 font-mono text-sm text-[var(--gs-text-secondary)] print:text-neutral-700">
          {entry.entry_date}
        </p>
      </header>

      <div className="mt-4 grid gap-2 text-sm print:text-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
            Contact
          </span>
          <span className="font-medium text-[var(--gs-text)] print:text-black">
            {entry.party_name_snapshot ?? "—"}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
            Medium
          </span>
          <span className="print:text-black">
            {paymentModeLabel(entry.payment_mode)}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
            Transaction ID
          </span>
          <span className="font-mono text-xs print:text-black">
            {entry.payment_reference ?? "—"}
          </span>
        </div>
        {entry.note ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[var(--gs-text-secondary)] print:text-neutral-600">
              Note
            </span>
            <span className="max-w-prose print:text-black">{entry.note}</span>
          </div>
        ) : null}
      </div>

      <p className="mt-6 border-t border-[var(--gs-border)] pt-4 text-xs text-[var(--gs-text-secondary)] print:border-black print:text-neutral-600">
        This payment updated the contact&apos;s balance on the ledger.
      </p>
    </article>
  );
}
