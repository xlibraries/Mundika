import { createClient } from "@/utils/supabase/client";
import { withBasePath } from "@/lib/auth/site-url";
import { getPaymentCheckoutProvider } from "@/lib/billing/payment-provider";

export type StarterCheckoutResult =
  | { provider: "stripe"; url: string }
  | {
      provider: "razorpay";
      keyId: string;
      orderId: string;
      amountPaise: number;
      currency: string;
    };

/**
 * Stripe: hosted Checkout URL. Razorpay: order details for in-app modal (Edge creates Order).
 */
export async function createStarterCheckoutSession(): Promise<StarterCheckoutResult> {
  const provider = getPaymentCheckoutProvider();
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Sign in required");
  }

  if (provider === "razorpay") {
    const { data, error } = await supabase.functions.invoke(
      "create-razorpay-order",
      {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
    );
    if (error) {
      throw new Error(error.message);
    }
    const payload = data as {
      orderId?: string;
      amount?: number;
      currency?: string;
      keyId?: string;
      error?: string;
    } | null;
    if (payload && typeof payload.error === "string" && payload.error) {
      throw new Error(payload.error);
    }
    const orderId = payload?.orderId;
    const amount = payload?.amount;
    const currency = payload?.currency;
    const keyId = payload?.keyId;
    if (
      !orderId ||
      typeof amount !== "number" ||
      !currency ||
      !keyId ||
      typeof keyId !== "string"
    ) {
      throw new Error("Razorpay order response incomplete");
    }
    return {
      provider: "razorpay",
      keyId,
      orderId,
      amountPaise: amount,
      currency,
    };
  }

  const successUrl = withBasePath("/account?billing=success");
  const cancelUrl = withBasePath("/account?billing=canceled");

  const { data, error } = await supabase.functions.invoke(
    "create-checkout-session",
    {
      body: { successUrl, cancelUrl },
      headers: { Authorization: `Bearer ${session.access_token}` },
    }
  );

  if (error) {
    throw new Error(error.message);
  }
  const payload = data as { url?: string; error?: string } | null;
  if (payload && typeof payload.error === "string" && payload.error) {
    throw new Error(payload.error);
  }
  const url = payload?.url;
  if (!url || typeof url !== "string") {
    throw new Error("Checkout did not return a URL");
  }
  return { provider: "stripe", url };
}
