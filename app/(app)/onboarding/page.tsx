"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { normalizeIndiaMobileE164 } from "@/lib/auth/phone-e164";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { useUserId } from "@/hooks/use-user-id";
import {
  ensureDefaultShopForUser,
  updateShopProfile,
} from "@/lib/shops/queries";
import { upsertUserProfileOnboardingComplete } from "@/lib/user-profile/user-profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

type SmsPhase = "idle" | "code_sent" | "verified";

function normalizeAuthPhone(p: string | undefined): string | null {
  if (!p?.trim()) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (p.startsWith("+")) return p.trim();
  return null;
}

function OnboardingSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-8">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--gs-surface)]" />
      <div className="h-64 animate-pulse rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-panel)]" />
    </div>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = useMemo(() => safeNextPath(nextParam, "/dashboard"), [nextParam]);

  const { userId, loading: authLoading } = useUserId();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionPhoneE164, setSessionPhoneE164] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const [shopName, setShopName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");

  const [smsPhase, setSmsPhase] = useState<SmsPhase>("idle");
  const [smsOtp, setSmsOtp] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEmail = !!(sessionEmail?.trim());

  useEffect(() => {
    if (authLoading || !userId) return;
    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = session?.user?.email?.trim() || null;
      const phoneNorm = normalizeAuthPhone(session?.user?.phone ?? undefined);
      setSessionEmail(email);
      setSessionPhoneE164(phoneNorm);
      if (phoneNorm?.startsWith("+91") && phoneNorm.length === 13) {
        setPhoneDraft(phoneNorm.slice(3));
      }
      setSessionReady(true);
    })();
  }, [authLoading, userId]);

  useEffect(() => {
    if (authLoading || userId) return;
    router.replace("/login?next=%2Fonboarding");
  }, [authLoading, userId, router]);

  const normalizedMobile = useMemo(
    () => normalizeIndiaMobileE164(phoneDraft),
    [phoneDraft]
  );

  const phoneMatchesSession =
    !!normalizedMobile &&
    !!sessionPhoneE164 &&
    normalizedMobile === sessionPhoneE164;

  async function sendSmsCode() {
    setError(null);
    if (!normalizedMobile) {
      setError("Enter a valid India mobile (10 digits, starting 6–9).");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({
      phone: normalizedMobile,
    });
    setBusy(false);
    if (err) {
      setError(
        err.message.includes("phone") || err.message.includes("SMS")
          ? `${err.message} Enable Phone provider + Twilio in Supabase if you use this path.`
          : err.message
      );
      return;
    }
    setSmsPhase("code_sent");
    setSmsOtp("");
  }

  async function verifySmsCode() {
    setError(null);
    if (!normalizedMobile) {
      setError("Enter a valid India mobile first.");
      return;
    }
    const token = smsOtp.replace(/\s/g, "");
    if (token.length < 6) {
      setError("Enter the SMS verification code.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      phone: normalizedMobile,
      token,
      type: "phone_change",
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSmsPhase("verified");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!userId) return;
    const name = shopName.trim();
    if (name.length < 1) {
      setError("Shop name is required.");
      return;
    }
    if (!normalizedMobile) {
      setError("Enter a valid India mobile (10 digits, starting 6–9).");
      return;
    }

    if (!hasEmail) {
      const smsOk = phoneMatchesSession || smsPhase === "verified";
      if (!smsOk) {
        setError(
          "This account has no email — verify your mobile with SMS: send the code, then enter it here."
        );
        return;
      }
    }

    setBusy(true);
    const supabase = createClient();
    try {
      const { shop } = await ensureDefaultShopForUser(supabase, userId);
      await updateShopProfile(supabase, shop.id, {
        name,
        address_line1: emptyToNull(addressLine1),
        address_line2: emptyToNull(addressLine2),
        city: emptyToNull(city),
        state_region: emptyToNull(stateRegion),
        postal_code: emptyToNull(postalCode),
        country: "IN",
        phone: normalizedMobile.startsWith("+91")
          ? normalizedMobile.slice(3)
          : normalizedMobile,
      });

      const phoneVerifiedAt =
        hasEmail ? null : new Date().toISOString();

      const { error: profErr } = await upsertUserProfileOnboardingComplete(
        supabase,
        userId,
        {
          phone_e164: normalizedMobile,
          phone_verified_at: phoneVerifiedAt,
        }
      );
      if (profErr) {
        const msg = profErr.message.toLowerCase().includes("duplicate")
          ? "That mobile number is already linked to another account."
          : profErr.message;
        throw new Error(msg);
      }

      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !userId || !sessionReady) {
    return <OnboardingSkeleton />;
  }

  const showSmsPanel = !hasEmail && !phoneMatchesSession;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 py-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
          Welcome
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--gs-text)]">
          Set up your shop
        </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-secondary)]">
          One quick step before the dashboard. Mobile is required for everyone;
          SMS verification only applies when your account has no email.
        </p>
      </div>

      <form
        onSubmit={(ev) => void onSubmit(ev)}
        className="space-y-4 rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-panel)] p-5 shadow-[0_18px_42px_-28px_rgba(58,42,31,0.34)]"
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
            Shop name
          </span>
          <Input
            required
            autoComplete="organization"
            placeholder="e.g. Sharma General Store"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Address line 1 (optional)
            </span>
            <Input
              autoComplete="street-address"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Address line 2 (optional)
            </span>
            <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">City</span>
            <Input autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">State</span>
            <Input value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">PIN code</span>
            <Input inputMode="numeric" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
            Account email
          </span>
          <Input
            readOnly
            disabled
            value={sessionEmail ?? "— (phone sign-in — SMS verification below)"}
            className="bg-[var(--gs-surface)] text-[var(--gs-text-secondary)]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
            Mobile (India) — required
          </span>
          <div className="flex gap-2">
            <span className="flex w-14 shrink-0 items-center justify-center rounded-md border border-[var(--gs-border)] bg-[var(--gs-surface)] text-xs text-[var(--gs-text-secondary)]">
              +91
            </span>
            <Input
              type="tel"
              inputMode="numeric"
              required
              autoComplete="tel-national"
              placeholder="9876543210"
              value={phoneDraft}
              onChange={(e) => {
                setPhoneDraft(e.target.value);
                if (smsPhase !== "idle") setSmsPhase("idle");
              }}
              className="flex-1"
            />
          </div>
        </label>

        {showSmsPanel ? (
          <div className="space-y-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] p-4 text-sm">
            <p className="text-[var(--gs-text-secondary)]">
              This account has no email. Verify this number with SMS (Supabase
              Phone + Twilio required).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void sendSmsCode()}
              >
                {busy ? "Sending…" : "Send SMS code"}
              </Button>
            </div>
            {smsPhase === "code_sent" || smsPhase === "verified" ? (
              <div className="space-y-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
                    SMS code
                  </span>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={smsOtp}
                    onChange={(e) => setSmsOtp(e.target.value)}
                    placeholder="6-digit code"
                  />
                </label>
                {smsPhase === "code_sent" ? (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void verifySmsCode()}
                  >
                    {busy ? "Checking…" : "Verify SMS code"}
                  </Button>
                ) : (
                  <p className="text-xs font-medium text-[var(--gs-primary)]">
                    Mobile verified.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : !hasEmail && phoneMatchesSession ? (
          <p className="text-xs text-[var(--gs-text-secondary)]">
            Mobile matches your sign-in number; no extra SMS step.
          </p>
        ) : hasEmail ? (
          <p className="text-xs text-[var(--gs-text-secondary)]">
            With email on file we do not send an SMS OTP for this step; your
            number is saved for checkout and support.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? "Saving…" : "Continue to dashboard"}
        </Button>
      </form>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingInner />
    </Suspense>
  );
}
