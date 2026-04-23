"use client";

import { Button } from "@/components/ui/button";

/**
 * Optional local fixture helper (Analytics). Shown only when
 * {@link isTransactionDemoSeedEnabled} from `@/lib/dev/transaction-demo-seed` is true.
 * Extend this component to insert bills, purchases, ledger rows, etc.
 */
export function TransactionSeedPanel({
  userId: _userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) {
  return (
    <aside
      className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-xl border border-[var(--gs-border)]/90 bg-[var(--gs-surface-plain)] p-4 shadow-lg ring-1 ring-inset ring-black/[0.04]"
      aria-label="Demo transaction seed"
    >
      <p className="text-[13px] font-semibold text-[var(--gs-text)]">Demo seed</p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--gs-text-secondary)]">
        Dev-only panel. Add repeatable bill, purchase, and ledger fixtures here when you
        need them; set{" "}
        <code className="rounded bg-[var(--gs-surface)] px-1 font-mono text-[10px]">
          NEXT_PUBLIC_TRANSACTION_DEMO_SEED=true
        </code>{" "}
        in <span className="font-mono text-[10px]">.env.local</span> to show this control.
      </p>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" variant="secondary" onClick={onDone}>
          Close
        </Button>
      </div>
    </aside>
  );
}
