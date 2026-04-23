"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserId } from "@/hooks/use-user-id";
import { useEntitlements } from "@/hooks/use-entitlements";
import { Button } from "@/components/ui/button";
import {
  performStarterCheckout,
  RazorpayCheckoutCanceledError,
} from "@/lib/billing/perform-starter-checkout";
import {
  getPaymentCheckoutProvider,
  isStarterCheckoutEnabled,
  paymentProviderLabel,
} from "@/lib/billing/payment-provider";
import { getPublicPlanById } from "@/lib/pricing/plans";

function AccountSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-[var(--gs-surface)]" />
      <div className="h-32 animate-pulse rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-panel)]" />
    </div>
  );
}

function AccountInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, loading: authLoading } = useUserId();
  const { state, refresh } = useEntitlements(userId);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [billingBanner, setBillingBanner] = useState<"success" | "canceled" | null>(
    null
  );

  useEffect(() => {
    if (authLoading || userId) return;
    router.replace("/login?next=%2Faccount");
  }, [authLoading, userId, router]);

  useEffect(() => {
    const billing = searchParams.get("billing");
    if (billing !== "success" && billing !== "canceled") return;
    setBillingBanner(billing === "success" ? "success" : "canceled");
    router.replace("/account");
  }, [searchParams, router]);

  useEffect(() => {
    if (billingBanner !== "success") return;
    const t = window.setTimeout(() => void refresh(), 1600);
    return () => window.clearTimeout(t);
  }, [billingBanner, refresh]);

  async function onSubscribe() {
    setCheckoutError(null);
    setCheckoutBusy(true);
    try {
      const out = await performStarterCheckout();
      if (out === "stripe_redirect") {
        return;
      }
      setBillingBanner("success");
      await refresh();
    } catch (e) {
      if (e instanceof RazorpayCheckoutCanceledError) {
        setCheckoutError("Checkout canceled. No charge was made.");
      } else {
        setCheckoutError(e instanceof Error ? e.message : "Checkout failed");
      }
    } finally {
      setCheckoutBusy(false);
    }
  }

  if (authLoading || !userId) {
    return <AccountSkeleton />;
  }

  const effectivePlan =
    state.status === "ready"
      ? state.row?.plan_id ?? "free"
      : state.status === "error"
        ? "free"
        : "free";

  const planMeta = getPublicPlanById(effectivePlan);
  const checkoutProvider = getPaymentCheckoutProvider();
  const providerName = paymentProviderLabel(checkoutProvider);
  const checkoutOn = isStarterCheckoutEnabled();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
          Account
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--gs-text)]">
          Plan and billing
        </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-secondary)]">
          Plan updates after a successful {providerName} payment (Stripe
          subscription or Razorpay order). Operational shop data stays
          local-first.
        </p>
      </div>

      {billingBanner === "success" ? (
        <p className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-4 py-3 text-sm text-[var(--gs-text)]">
          Checkout completed. Plan status may take a moment to update if it
          still shows Free.
        </p>
      ) : null}
      {billingBanner === "canceled" ? (
        <p className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-4 py-3 text-sm text-[var(--gs-text-secondary)]">
          Checkout canceled. No charge was made.
        </p>
      ) : null}

      <section className="rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-panel)] p-5 shadow-[0_18px_42px_-28px_rgba(58,42,31,0.34)]">
        {state.status === "loading" || state.status === "idle" ? (
          <p className="text-sm text-[var(--gs-text-secondary)]">Loading plan…</p>
        ) : state.status === "error" ? (
          <p className="text-sm text-[var(--gs-danger)]">
            Could not load plan: {state.message}
          </p>
        ) : state.status === "ready" ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[var(--gs-text-secondary)]">Current plan</span>
              <span className="font-medium capitalize text-[var(--gs-text)]">
                {planMeta?.name ?? effectivePlan}
              </span>
            </div>
            {state.row?.subscription_status ? (
              <div className="flex flex-wrap justify-between gap-2 text-[var(--gs-text-secondary)]">
                <span>Subscription status</span>
                <span className="font-mono text-xs text-[var(--gs-text)]">
                  {state.row.subscription_status}
                </span>
              </div>
            ) : null}
            {state.row?.current_period_end ? (
              <div className="flex flex-wrap justify-between gap-2 text-[var(--gs-text-secondary)]">
                <span>Current period ends</span>
                <span className="text-[var(--gs-text)]">
                  {new Date(state.row.current_period_end).toLocaleString()}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {checkoutError ? (
          <p className="mt-4 rounded-lg border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]">
            {checkoutError}
          </p>
        ) : null}

        {checkoutOn &&
        effectivePlan !== "starter" &&
        checkoutProvider === "stripe" ? (
          <div className="mt-5 space-y-2 border-t border-[var(--gs-border)] pt-5">
            <Button
              type="button"
              className="w-full"
              disabled={checkoutBusy}
              onClick={() => void onSubscribe()}
            >
              {checkoutBusy ? "Redirecting to checkout…" : "Subscribe to Starter"}
            </Button>
            <p className="text-center text-[11px] text-[var(--gs-text-secondary)]">
              INR 399/mo — Stripe via Supabase Edge (see AGENTS.md).
            </p>
          </div>
        ) : checkoutOn &&
          effectivePlan !== "starter" &&
          checkoutProvider === "razorpay" ? (
          <div className="mt-5 space-y-2 border-t border-[var(--gs-border)] pt-5">
            <Button
              type="button"
              className="w-full"
              disabled={checkoutBusy}
              onClick={() => void onSubscribe()}
            >
              {checkoutBusy ? "Opening Razorpay…" : "Pay for Starter (Razorpay)"}
            </Button>
            <p className="text-center text-[11px] text-[var(--gs-text-secondary)]">
              Test keys settle fake money only. First real ₹ needs live keys +
              activated Razorpay account.
            </p>
          </div>
        ) : !checkoutOn ? (
          <p className="mt-4 text-xs text-[var(--gs-text-secondary)]">
            Checkout is off. For Stripe set{" "}
            <code className="rounded bg-[var(--gs-surface)] px-1">
              NEXT_PUBLIC_STRIPE_CHECKOUT_ENABLED=true
            </code>
            . For Razorpay set{" "}
            <code className="rounded bg-[var(--gs-surface)] px-1">
              NEXT_PUBLIC_PAYMENT_PROVIDER=razorpay
            </code>{" "}
            and{" "}
            <code className="rounded bg-[var(--gs-surface)] px-1">
              NEXT_PUBLIC_RAZORPAY_CHECKOUT_ENABLED=true
            </code>{" "}
            after Edge deploy (see AGENTS.md).
          </p>
        ) : null}
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountInner />
    </Suspense>
  );
}
