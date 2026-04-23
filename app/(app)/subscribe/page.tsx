"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUserId } from "@/hooks/use-user-id";
import { useEntitlements } from "@/hooks/use-entitlements";
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

function SubscribeSkeleton() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--gs-surface)]" />
      <div className="h-24 animate-pulse rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-panel)]" />
    </div>
  );
}

function SubscribeInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan")?.toLowerCase() ?? "";
  const plan = getPublicPlanById(planParam);

  const { userId, loading: authLoading } = useUserId();
  const { state, refresh } = useEntitlements(userId);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const returnPath =
    pathname +
    (searchParams.toString() ? `?${searchParams.toString()}` : "");

  useEffect(() => {
    if (authLoading) return;
    if (userId) return;
    if (!plan || plan.id !== "starter") return;
    const q = new URLSearchParams();
    q.set("plan", "starter");
    q.set("next", returnPath.startsWith("/") ? returnPath : `/${returnPath}`);
    router.replace(`/login?${q.toString()}`);
  }, [authLoading, userId, plan, router, returnPath]);

  useEffect(() => {
    if (authLoading || !userId) return;
    if (!plan || plan.id !== "starter") {
      setMessage(null);
      setError(
        "Starter checkout uses this link from pricing. Other plans use the home page."
      );
      return;
    }
    if (!isStarterCheckoutEnabled()) {
      setMessage(null);
      setError(
        `Checkout is turned off. Enable ${paymentProviderLabel()} in env (see AGENTS.md), then use Account → subscribe.`
      );
      return;
    }
    if (state.status === "loading" || state.status === "idle") {
      setMessage("Checking your plan…");
      return;
    }
    if (state.status === "error") {
      setMessage(null);
      setError(state.message);
      return;
    }
    if (state.row?.plan_id === "starter") {
      setMessage("You already have Starter.");
      setError(null);
      return;
    }
    if (autoStarted.current) return;
    autoStarted.current = true;
    setMessage(
      getPaymentCheckoutProvider() === "stripe"
        ? "Redirecting to secure checkout…"
        : "Opening Razorpay…"
    );
    setError(null);
    void performStarterCheckout()
      .then(async (out) => {
        if (out === "stripe_redirect") return;
        await refresh();
        router.replace("/account?billing=success");
      })
      .catch((e) => {
        autoStarted.current = false;
        if (e instanceof RazorpayCheckoutCanceledError) {
          setMessage(null);
          setError("Checkout canceled. No charge was made.");
          return;
        }
        setMessage(null);
        setError(e instanceof Error ? e.message : "Checkout failed");
      });
  }, [
    authLoading,
    userId,
    plan,
    state.status,
    state.row?.plan_id,
    state.message,
    router,
    refresh,
  ]);

  if (authLoading) {
    return <SubscribeSkeleton />;
  }

  if (!userId) {
    if (plan?.id === "starter") {
      return (
        <div className="mx-auto max-w-md px-4 py-8 text-sm text-[var(--gs-text-secondary)]">
          Taking you to sign in, then payment…
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-8">
        <h1 className="text-xl font-semibold text-[var(--gs-text)]">Subscribe</h1>
        <p className="text-sm text-[var(--gs-text-secondary)]">
          Sign in first, then pick a plan from the home page.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-[var(--gs-primary)] underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
        <Link
          href="/#pricing"
          className="ml-4 inline-block text-sm text-[var(--gs-text-secondary)] underline-offset-2 hover:underline"
        >
          Pricing
        </Link>
      </div>
    );
  }

  if (!plan || plan.id !== "starter") {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-8">
        <h1 className="text-xl font-semibold text-[var(--gs-text)]">Subscribe</h1>
        <p className="text-sm text-[var(--gs-text-secondary)]">
          Starter checkout starts from the pricing section on the home page.
        </p>
        <Link
          href="/#pricing"
          className="inline-block text-sm font-medium text-[var(--gs-primary)] underline-offset-2 hover:underline"
        >
          Back to pricing
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <h1 className="text-xl font-semibold text-[var(--gs-text)]">
        Starter — {plan.priceLabel}
      </h1>
      {state.status === "ready" && state.row?.plan_id === "starter" ? (
        <p className="text-sm text-[var(--gs-text-secondary)]">
          Your account already has Starter. Continue in the app.
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[var(--gs-text)]">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/account"
          className="font-medium text-[var(--gs-primary)] underline-offset-2 hover:underline"
        >
          Account & billing
        </Link>
        <Link
          href="/dashboard"
          className="text-[var(--gs-text-secondary)] underline-offset-2 hover:underline"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<SubscribeSkeleton />}>
      <SubscribeInner />
    </Suspense>
  );
}
