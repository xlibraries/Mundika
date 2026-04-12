import type { PaymentMode } from "@/lib/types/domain";

export const PAYMENT_MODE_OPTIONS: Array<{ value: PaymentMode; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "imps", label: "IMPS" },
  { value: "rtgs", label: "RTGS" },
  { value: "neft", label: "NEFT" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export function paymentModeLabel(mode: PaymentMode | null | undefined): string {
  if (!mode) return "—";
  return PAYMENT_MODE_OPTIONS.find((opt) => opt.value === mode)?.label ?? "Other";
}
