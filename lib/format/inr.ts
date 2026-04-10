/** Consistent Indian Rupee formatting (en-IN locale, INR currency). */

export function formatINR(
  value: number,
  options?: { minFractionDigits?: number; maxFractionDigits?: number }
): string {
  const min = options?.minFractionDigits ?? 2;
  const max = options?.maxFractionDigits ?? 2;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(value);
}
