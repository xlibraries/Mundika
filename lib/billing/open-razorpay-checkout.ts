"use client";

export class RazorpayCheckoutCanceledError extends Error {
  constructor() {
    super("Checkout was canceled");
    this.name = "RazorpayCheckoutCanceledError";
  }
}

function loadRazorpayScript(): Promise<void> {
  if (
    document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    )
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay checkout"));
    document.body.appendChild(s);
  });
}

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayEmitter = {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayEmitter;
  }
}

function resolveKeyId(serverKeyId: string): string {
  const pub = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  if (serverKeyId?.trim()) return serverKeyId.trim();
  if (pub) return pub;
  throw new Error("Missing Razorpay key: set NEXT_PUBLIC_RAZORPAY_KEY_ID or rely on create-order response");
}

/**
 * Opens Razorpay Standard Checkout modal for a pre-created Order.
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
 */
export async function openRazorpayOrderCheckout(opts: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  userEmail: string | null;
  /** E.164 (+91…) when saved on Account — Razorpay prefill.contact */
  userPhoneE164?: string | null;
}): Promise<RazorpayHandlerResponse> {
  await loadRazorpayScript();
  const Ctor = window.Razorpay;
  if (!Ctor) {
    throw new Error("Razorpay checkout unavailable");
  }

  const key = resolveKeyId(opts.keyId);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const rzp = new Ctor({
      key,
      amount: opts.amountPaise,
      currency: opts.currency,
      order_id: opts.orderId,
      name: "Mundika",
      description: "Starter — 1 month",
      prefill: {
        email: opts.userEmail ?? undefined,
        contact: opts.userPhoneE164 ?? undefined,
      },
      handler(response: RazorpayHandlerResponse) {
        finish(() => resolve(response));
      },
      modal: {
        ondismiss() {
          finish(() => reject(new RazorpayCheckoutCanceledError()));
        },
      },
    });

    if (typeof rzp.on === "function") {
      rzp.on("payment.failed", (raw: unknown) => {
        const payload = raw as {
          error?: { description?: string; code?: string; reason?: string };
        };
        const msg =
          payload?.error?.description ??
          payload?.error?.code ??
          payload?.error?.reason ??
          "Payment failed";
        finish(() => reject(new Error(msg)));
      });
    }

    rzp.open();
  });
}
