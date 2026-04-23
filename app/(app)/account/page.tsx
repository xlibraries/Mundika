"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserId } from "@/hooks/use-user-id";
import { useEntitlements } from "@/hooks/use-entitlements";
import { normalizeIndiaMobileE164 } from "@/lib/auth/phone-e164";
import {
  fetchUserProfilePhone,
  upsertUserProfilePhone,
} from "@/lib/user-profile/user-profiles";
import {
  ensureDefaultShopForUser,
  updateShopProfile,
} from "@/lib/shops/queries";
import type { ShopRow } from "@/lib/shops/types";
import { notifyShopProfileUpdated } from "@/hooks/use-primary-shop-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createClient } from "@/utils/supabase/client";

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

function digitsForIndiaDraftFromShopPhone(raw: string | null): string {
  if (!raw) return "";
  const t = raw.trim();
  if (t.startsWith("+91") && t.length === 13) return t.slice(3);
  return t.replace(/\D/g, "").replace(/^91/, "").slice(0, 10);
}

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

  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileMessageKind, setProfileMessageKind] = useState<
    "success" | "error" | null
  >(null);

  const [shopLoading, setShopLoading] = useState(true);
  const [shop, setShop] = useState<ShopRow | null>(null);
  const [draft, setDraft] = useState<Partial<ShopRow>>({});
  const [shopLoadError, setShopLoadError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setPhoneLoading(true);
    setShopLoading(true);
    setShopLoadError(null);
    setProfileMessage(null);
    setProfileMessageKind(null);
    void (async () => {
      const supabase = createClient();
      try {
        const { shop: row } = await ensureDefaultShopForUser(supabase, userId);
        if (cancelled) return;
        setShop(row);
        setDraft(row);
        const userPhone = await fetchUserProfilePhone(supabase, userId);
        if (cancelled) return;
        if (userPhone?.startsWith("+91") && userPhone.length === 13) {
          setPhoneDraft(userPhone.slice(3));
        } else if (userPhone) {
          setPhoneDraft(userPhone);
        } else {
          setPhoneDraft(digitsForIndiaDraftFromShopPhone(row.phone));
        }
      } catch (e) {
        if (!cancelled) {
          setShopLoadError(e instanceof Error ? e.message : "Could not load shop");
        }
      } finally {
        if (!cancelled) {
          setPhoneLoading(false);
          setShopLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!shop || !userId) return;
    setProfileMessage(null);
    setProfileMessageKind(null);
    const trimmedPhone = phoneDraft.trim();
    const normalizedPhone = trimmedPhone
      ? normalizeIndiaMobileE164(trimmedPhone)
      : null;
    if (trimmedPhone && !normalizedPhone) {
      setProfileMessageKind("error");
      setProfileMessage("Enter a valid India mobile (10 digits, starting 6–9).");
      return;
    }
    setProfileSaveBusy(true);
    const supabase = createClient();
    try {
      await updateShopProfile(supabase, shop.id, {
        name: (draft.name ?? "").trim() || shop.name,
        address_line1: emptyToNull(String(draft.address_line1 ?? "")),
        city: emptyToNull(String(draft.city ?? "")),
        state_region: emptyToNull(String(draft.state_region ?? "")),
        country: "IN",
        phone: normalizedPhone,
      });
      const { error: phoneErr } = await upsertUserProfilePhone(
        supabase,
        userId,
        normalizedPhone
      );
      if (phoneErr) {
        const msg = phoneErr.message.toLowerCase().includes("duplicate")
          ? "That number is already linked to another account."
          : phoneErr.message;
        setProfileMessageKind("error");
        setProfileMessage(msg);
        return;
      }
      const { data, error: reloadErr } = await supabase
        .from("shops")
        .select("*")
        .eq("id", shop.id)
        .single();
      if (reloadErr || !data) throw reloadErr ?? new Error("Reload failed");
      const next = data as ShopRow;
      setShop(next);
      setDraft(next);
      if (normalizedPhone) {
        setPhoneDraft(normalizedPhone.slice(3));
      } else {
        setPhoneDraft("");
      }
      notifyShopProfileUpdated();
      setProfileMessageKind("success");
      setProfileMessage(
        "Dukan profile saved. Mobile is used for Razorpay pre-fill and chit header."
      );
    } catch (err) {
      setProfileMessageKind("error");
      setProfileMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setProfileSaveBusy(false);
    }
  }

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
          Dukan aur billing
        </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-secondary)]">
          Ek hi jagah: dukan ka naam, mobile, pata, aur plan. Operational stock
          local-first; sync baad mein (GitHub #26).
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

      {shopLoading || !shop ? (
        <p className="text-sm text-[var(--gs-text-secondary)]">
          {shopLoadError ?? "Loading dukan profile…"}
        </p>
      ) : (
        <form
          onSubmit={onSaveProfile}
          className="space-y-4 rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-panel)] p-5 shadow-[0_18px_42px_-28px_rgba(58,42,31,0.34)]"
        >
          <div>
            <h2 className="text-sm font-semibold text-[var(--gs-text)]">
              Dukan profile
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--gs-text-secondary)]">
              Dukan ka naam aur pata — bill / chit par. GST nahi. Ten-digit
              mobile: +91 database mein; Razorpay pre-fill aur chit header dono
              ke liye.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Dukan ka naam
            </span>
            <Input
              required
              value={draft.name ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Mobile number (India)
            </span>
            {phoneLoading ? (
              <p className="text-sm text-[var(--gs-text-secondary)]">Loading…</p>
            ) : (
              <div className="flex gap-2">
                <span className="flex w-14 shrink-0 items-center justify-center rounded-md border border-[var(--gs-border)] bg-[var(--gs-surface)] text-xs text-[var(--gs-text-secondary)]">
                  +91
                </span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="9876543210"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  className="flex-1"
                />
              </div>
            )}
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Pata (optional)
            </span>
            <Input
              placeholder="Gali, bazar, landmark…"
              value={draft.address_line1 ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, address_line1: e.target.value }))
              }
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
                Gaon / shehar
              </span>
              <Input
                value={draft.city ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, city: e.target.value }))
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
                Rajya
              </span>
              <Input
                value={draft.state_region ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, state_region: e.target.value }))
                }
              />
            </label>
          </div>

          {profileMessage ? (
            <p
              className={
                profileMessageKind === "success"
                  ? "rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-3 py-2 text-xs text-[var(--gs-text)]"
                  : "rounded-lg border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-xs text-[var(--gs-danger)]"
              }
            >
              {profileMessage}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="secondary"
            disabled={profileSaveBusy || phoneLoading}
            className="w-full sm:w-auto"
          >
            {profileSaveBusy ? "Saving…" : "Save dukan profile"}
          </Button>
        </form>
      )}

      <section className="rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-panel)] p-5 shadow-[0_18px_42px_-28px_rgba(58,42,31,0.34)]">
        <h2 className="text-sm font-semibold text-[var(--gs-text)]">
          Plan and billing
        </h2>
        <p className="mt-1 text-xs text-[var(--gs-text-secondary)]">
          Plan updates after a successful {providerName} payment (Stripe
          subscription or Razorpay order).
        </p>
        {state.status === "loading" || state.status === "idle" ? (
          <p className="mt-3 text-sm text-[var(--gs-text-secondary)]">
            Loading plan…
          </p>
        ) : state.status === "error" ? (
          <p className="mt-3 text-sm text-[var(--gs-danger)]">
            Could not load plan: {state.message}
          </p>
        ) : state.status === "ready" ? (
          <div className="mt-3 space-y-3 text-sm">
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
