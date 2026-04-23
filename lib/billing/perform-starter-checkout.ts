"use client";

import { createStarterCheckoutSession } from "@/lib/billing/create-starter-checkout";
import {
  openRazorpayOrderCheckout,
  RazorpayCheckoutCanceledError,
} from "@/lib/billing/open-razorpay-checkout";
import { createClient } from "@/utils/supabase/client";

export type StarterCheckoutOutcome = "stripe_redirect" | "razorpay_ok";

/**
 * Stripe: full-page redirect to Checkout (browser navigates away).
 * Razorpay: modal + confirm Edge function.
 */
export async function performStarterCheckout(): Promise<StarterCheckoutOutcome> {
  const result = await createStarterCheckoutSession();
  if (result.provider === "stripe") {
    window.location.assign(result.url);
    return "stripe_redirect";
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Sign in required");
  }

  const rz = await openRazorpayOrderCheckout({
    keyId: result.keyId,
    orderId: result.orderId,
    amountPaise: result.amountPaise,
    currency: result.currency,
    userEmail: session.user.email ?? null,
  });

  const { data, error } = await supabase.functions.invoke(
    "razorpay-confirm-payment",
    {
      body: {
        razorpay_order_id: rz.razorpay_order_id,
        razorpay_payment_id: rz.razorpay_payment_id,
        razorpay_signature: rz.razorpay_signature,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    }
  );

  if (error) {
    throw new Error(error.message);
  }
  const payload = data as { error?: string } | null;
  if (payload && typeof payload.error === "string" && payload.error) {
    throw new Error(payload.error);
  }

  return "razorpay_ok";
}

export { RazorpayCheckoutCanceledError };
