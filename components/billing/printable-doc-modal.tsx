"use client";

import { useEffect } from "react";
import type { TxDocPreview } from "@/lib/billing/doc-preview";
import { triggerDocumentPrint } from "@/lib/billing/doc-preview";
import { BillDocumentView } from "@/components/billing/bill-document";
import { PurchaseDocumentView } from "@/components/billing/purchase-document";
import { PaymentReceiptDocumentView } from "@/components/billing/payment-receipt-document";
import { Button } from "@/components/ui/button";

export function PrintableDocModal({
  payload,
  onClose,
}: {
  payload: TxDocPreview | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!payload) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [payload, onClose]);

  if (!payload) return null;

  const title =
    payload.kind === "bill"
      ? "Bill preview"
      : payload.kind === "purchase"
        ? "Purchase preview"
        : "Payment preview";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-3 py-6 sm:px-5"
      style={{ backgroundColor: "var(--gs-overlay)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      onClick={onClose}
    >
      <div
        className="mundika-doc-print-toolbar flex w-full max-w-2xl flex-shrink-0 items-center justify-between gap-3 pb-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="doc-preview-title"
          className="text-sm font-semibold text-[var(--gs-surface-plain)] drop-shadow-sm"
        >
          {title}
        </h2>
        <div className="flex flex-shrink-0 gap-2">
          <Button
            variant="secondary"
            className="border-[var(--gs-border)] bg-[var(--gs-surface-plain)] shadow-sm"
            onClick={triggerDocumentPrint}
          >
            Print
          </Button>
          <Button
            variant="secondary"
            className="border-[var(--gs-border)] bg-[var(--gs-surface-plain)] shadow-sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
      <div
        id="mundika-doc-print-target"
        className="max-h-[min(78vh,42rem)] w-full max-w-2xl overflow-y-auto rounded-xl shadow-lg ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {payload.kind === "bill" ? (
          <BillDocumentView bill={payload.bill} lines={payload.lines} />
        ) : payload.kind === "purchase" ? (
          <PurchaseDocumentView
            purchase={payload.purchase}
            lines={payload.lines}
          />
        ) : (
          <PaymentReceiptDocumentView entry={payload.entry} />
        )}
      </div>
    </div>
  );
}
