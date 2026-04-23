"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getSiteUrl, withBasePath } from "@/lib/auth/site-url";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { getPublicPlanById } from "@/lib/pricing/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserId } from "@/hooks/use-user-id";

const RATE_LIMIT_COOLDOWN_MS = 30_000;

function isRateLimitedAuthError(err: { message?: string; status?: number; code?: string }) {
  const message = (err.message ?? "").toLowerCase();
  return (
    err.status === 429 ||
    err.code === "over_request_rate_limit" ||
    message.includes("rate limit")
  );
}

type EmailMode = "signin" | "signup";
type SignupPhase = "request_otp" | "set_password";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlan = getPublicPlanById(searchParams.get("plan"));
  const defaultNext =
    selectedPlan?.id === "starter" ? "/subscribe?plan=starter" : "/dashboard";
  const next = safeNextPath(searchParams.get("next"), defaultNext);
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  const initialError = useMemo(() => {
    if (!oauthError) return null;
    if (oauthErrorDescription) return oauthErrorDescription;
    return oauthError === "oauth_callback"
      ? "Google sign-in could not be completed. Please try again."
      : oauthError;
  }, [oauthError, oauthErrorDescription]);

  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [signupPhase, setSignupPhase] = useState<SignupPhase>("request_otp");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!blockedUntil) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [blockedUntil]);

  const { userId, loading } = useUserId();
  useEffect(() => {
    if (!loading && userId) {
      router.replace(next);
    }
  }, [userId, loading, router, next]);

  const isRateLimited = blockedUntil !== null && blockedUntil > now;
  const secondsLeft = isRateLimited
    ? Math.max(1, Math.ceil((blockedUntil - now) / 1000))
    : 0;
  const disabled = busy || isRateLimited;

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    if (isRateLimited) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      if (isRateLimitedAuthError(err)) {
        setNow(Date.now());
        setBlockedUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS);
        setError("Too many sign-in attempts. Please wait 30 seconds and try again.");
        return;
      }
      setError(err.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function sendSignupOtp() {
    if (isRateLimited) return;
    setError(null);
    setInfo(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: withBasePath(
          `/auth/callback?next=${encodeURIComponent(next)}`
        ),
      },
    });
    setBusy(false);
    if (err) {
      if (isRateLimitedAuthError(err)) {
        setNow(Date.now());
        setBlockedUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS);
        setError("Too many attempts. Please wait 30 seconds and try again.");
        return;
      }
      setError(err.message);
      return;
    }
    setSignupPhase("set_password");
    setInfo(
      "We sent a verification code to your email. Enter it below, then choose a password."
    );
  }

  async function completeSignupWithOtp(e: React.FormEvent) {
    e.preventDefault();
    if (isRateLimited) return;
    setError(null);
    setInfo(null);
    const trimmedEmail = email.trim();
    const code = otp.replace(/\s/g, "");
    if (code.length < 6 || code.length > 12) {
      setError("Enter the verification code from your email.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: code,
      type: "email",
    });
    if (err) {
      setBusy(false);
      if (isRateLimitedAuthError(err)) {
        setNow(Date.now());
        setBlockedUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS);
        setError("Too many attempts. Please wait 30 seconds and try again.");
        return;
      }
      setError(err.message);
      return;
    }
    const { error: pwErr } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (pwErr) {
      setError(pwErr.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function sendPasswordReset() {
    setError(null);
    setInfo(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email above first.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: withBasePath("/auth/reset-password"),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo(
      "If an account exists for that email, a reset link was sent. Check your inbox."
    );
  }

  async function signInGoogle() {
    if (isRateLimited) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const callbackQs = new URLSearchParams({ next });
    if (selectedPlan) callbackQs.set("plan", selectedPlan.id);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getSiteUrl()}auth/callback?${callbackQs.toString()}`,
      },
    });
    setBusy(false);
    if (err) {
      if (isRateLimitedAuthError(err)) {
        setNow(Date.now());
        setBlockedUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS);
        setError("Too many sign-in attempts. Please wait 30 seconds and try again.");
        return;
      }
      setError(err.message);
    }
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="space-y-2 text-center sm:text-left">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] text-lg font-bold text-[var(--gs-primary)] shadow-sm sm:mx-0">
            M
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gs-primary)]">
            MUNDIKA
          </p>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--gs-text)]">
            Sign in
          </h1>
          <p className="text-sm leading-relaxed text-[var(--gs-text-secondary)]">
            Google or email. New accounts verify the inbox with an email code,
            then you set a password. Google still provisions on first sign-in.
          </p>
          {selectedPlan ? (
            <p className="rounded-md border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-3 py-2 text-xs leading-relaxed text-[var(--gs-text-secondary)]">
              Plan from pricing:{" "}
              <span className="font-medium text-[var(--gs-text)]">{selectedPlan.name}</span>
              {" — "}
              {selectedPlan.priceLabel}
              {selectedPlan.cadenceLabel ? ` · ${selectedPlan.cadenceLabel}` : null}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] p-6 shadow-[0_1px_2px_rgba(58,42,31,0.08),0_4px_12px_-4px_rgba(58,42,31,0.12)]">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            className="w-full"
            onClick={() => void signInGoogle()}
          >
            {busy
              ? "Opening Google…"
              : isRateLimited
                ? `Try again in ${secondsLeft}s`
                : "Continue with Google"}
          </Button>
          <p className="mt-2 text-center text-xs text-[var(--gs-text-secondary)]">
            First-time Google users are created after you approve access.
          </p>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--gs-border)]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-[var(--gs-text-secondary)]">
              <span className="bg-[var(--gs-surface-plain)] px-2">Email</span>
            </div>
          </div>

          <div className="mb-4 flex rounded-lg border border-[var(--gs-border)] p-0.5">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                emailMode === "signin"
                  ? "bg-[var(--gs-surface)] text-[var(--gs-text)] shadow-sm"
                  : "text-[var(--gs-text-secondary)] hover:text-[var(--gs-text)]"
              }`}
              onClick={() => {
                setEmailMode("signin");
                setError(null);
                setInfo(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                emailMode === "signup"
                  ? "bg-[var(--gs-surface)] text-[var(--gs-text)] shadow-sm"
                  : "text-[var(--gs-text-secondary)] hover:text-[var(--gs-text)]"
              }`}
              onClick={() => {
                setEmailMode("signup");
                setSignupPhase("request_otp");
                setOtp("");
                setPassword("");
                setPasswordConfirm("");
                setError(null);
                setInfo(null);
              }}
            >
              Create account
            </button>
          </div>

          {emailMode === "signin" ? (
            <form onSubmit={signInEmail} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--gs-text-secondary)]">Email</span>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
                  Password
                </span>
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--gs-primary)] underline-offset-2 hover:underline"
                  disabled={disabled}
                  onClick={() => void sendPasswordReset()}
                >
                  Forgot password?
                </button>
              </div>
              {error ? (
                <p className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]">
                  {error}
                </p>
              ) : null}
              {info ? (
                <p className="rounded border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2 text-sm text-[var(--gs-text)]">
                  {info}
                </p>
              ) : null}
              <Button type="submit" disabled={disabled} className="w-full" size="lg">
                {busy
                  ? "Signing in…"
                  : isRateLimited
                    ? `Try again in ${secondsLeft}s`
                    : "Continue with email"}
              </Button>
            </form>
          ) : signupPhase === "request_otp" ? (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--gs-text-secondary)]">Email</span>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <p className="text-xs leading-relaxed text-[var(--gs-text-secondary)]">
                We email a short verification code. In Supabase, edit the auth
                email template so it includes the token placeholder (see
                .env.local.example comments).
              </p>
              {error ? (
                <p className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]">
                  {error}
                </p>
              ) : null}
              {info ? (
                <p className="rounded border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2 text-sm text-[var(--gs-text)]">
                  {info}
                </p>
              ) : null}
              <Button
                type="button"
                disabled={disabled}
                className="w-full"
                size="lg"
                onClick={() => void sendSignupOtp()}
              >
                {busy
                  ? "Sending code…"
                  : isRateLimited
                    ? `Try again in ${secondsLeft}s`
                    : "Send verification code"}
              </Button>
            </div>
          ) : (
            <form onSubmit={completeSignupWithOtp} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2 text-sm">
                <span className="truncate text-[var(--gs-text)]">{email.trim()}</span>
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-[var(--gs-primary)] underline-offset-2 hover:underline"
                  disabled={disabled}
                  onClick={() => {
                    setSignupPhase("request_otp");
                    setOtp("");
                    setError(null);
                    setInfo(null);
                  }}
                >
                  Change email
                </button>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
                  Email verification code
                </span>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
                  Password
                </span>
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
                  Confirm password
                </span>
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />
              </label>
              {error ? (
                <p className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]">
                  {error}
                </p>
              ) : null}
              {info ? (
                <p className="rounded border border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-2 text-sm text-[var(--gs-text)]">
                  {info}
                </p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                className="w-full"
                onClick={() => void sendSignupOtp()}
              >
                Resend code
              </Button>
              <Button type="submit" disabled={disabled} className="w-full" size="lg">
                {busy
                  ? "Creating account…"
                  : isRateLimited
                    ? `Try again in ${secondsLeft}s`
                    : "Create account"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-[var(--gs-text-secondary)]">
          Encrypted in transit to Supabase when you sync.
        </p>
      </div>
    </div>
  );
}
