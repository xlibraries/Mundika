export type PaymentCheckoutProvider = "stripe" | "razorpay";

/**
 * Which payment rails the client should use for SaaS Starter checkout.
 * Razorpay: Edge `create-razorpay-order` + modal + `razorpay-confirm-payment` (and optional webhook).
 */
export function getPaymentCheckoutProvider(): PaymentCheckoutProvider {
  const raw = (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER ?? "stripe")
    .toLowerCase()
    .trim();
  return raw === "razorpay" ? "razorpay" : "stripe";
}

/** True when Starter self-serve checkout should appear for the active provider. */
export function isStarterCheckoutEnabled(): boolean {
  if (getPaymentCheckoutProvider() === "razorpay") {
    return process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_ENABLED === "true";
  }
  return process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_ENABLED === "true";
}

export function paymentProviderLabel(
  p: PaymentCheckoutProvider = getPaymentCheckoutProvider()
): string {
  return p === "razorpay" ? "Razorpay" : "Stripe";
}
