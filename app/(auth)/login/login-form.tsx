"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getSiteUrl } from "@/lib/auth/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  const initialError = useMemo(() => {
    if (!oauthError) return null;
    if (oauthErrorDescription) return oauthErrorDescription;
    return oauthError === "oauth_callback"
      ? "Google sign-in could not be completed. Please try again."
      : oauthError;
  }, [oauthError, oauthErrorDescription]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function signInGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getSiteUrl()}auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (err) setError(err.message);
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="space-y-2 text-center sm:text-left">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded border border-[#c5dccf] bg-[#faf9f5] text-lg font-bold text-[#4d7a5c] shadow-sm sm:mx-0">
            M
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-[#2a382f]">
            Sign in or create your account
          </h1>
          <p className="text-sm leading-relaxed text-[#5c6e62]">
            Google works as one-tap sign-up too. Your first Google login creates
            the account automatically.
          </p>
        </div>

        <div className="rounded-lg border border-[#c5dccf] bg-[#faf9f5] p-6 shadow-[0_1px_2px_rgba(42,56,47,0.08),0_4px_12px_-4px_rgba(42,56,47,0.12)]">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            className="w-full"
            onClick={() => void signInGoogle()}
          >
            {busy ? "Opening Google…" : "Continue with Google"}
          </Button>
          <p className="mt-2 text-center text-xs text-[#5c6e62]">
            New users are created automatically after Google approves access.
          </p>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#c5dccf]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-[#5c6e62]">
              <span className="bg-[#faf9f5] px-2">or use email</span>
            </div>
          </div>

          <form onSubmit={signInEmail} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#5c6e62]">Email</span>
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
              <span className="text-xs font-medium text-[#5c6e62]">
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
            {error ? (
              <p className="rounded border border-[#f0c4c0] bg-[#fcecea] px-3 py-2 text-sm text-[#c44d42]">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={busy}
              className="w-full"
              size="lg"
            >
              {busy ? "Signing in…" : "Continue with email"}
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[#5c6e62]">
          Encrypted in transit to Supabase when you sync.
        </p>
      </div>
    </div>
  );
}
