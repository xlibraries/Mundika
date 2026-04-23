import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPaymentCheckoutProvider,
  isStarterCheckoutEnabled,
  paymentProviderLabel,
} from "./payment-provider";

describe("payment-provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to stripe", () => {
    delete process.env.NEXT_PUBLIC_PAYMENT_PROVIDER;
    expect(getPaymentCheckoutProvider()).toBe("stripe");
  });

  it("accepts razorpay", () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_PROVIDER", "razorpay");
    expect(getPaymentCheckoutProvider()).toBe("razorpay");
    expect(paymentProviderLabel("razorpay")).toBe("Razorpay");
  });

  it("starter checkout flag follows provider", () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_PROVIDER", "stripe");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_CHECKOUT_ENABLED", "");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_CHECKOUT_ENABLED", "");
    expect(isStarterCheckoutEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_STRIPE_CHECKOUT_ENABLED", "true");
    expect(isStarterCheckoutEnabled()).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_PAYMENT_PROVIDER", "razorpay");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_CHECKOUT_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_CHECKOUT_ENABLED", "");
    expect(isStarterCheckoutEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_CHECKOUT_ENABLED", "true");
    expect(isStarterCheckoutEnabled()).toBe(true);
  });
});
