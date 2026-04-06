"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    const origin = window.location.origin;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (err) setError(err.message);
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="space-y-2 text-center sm:text-left">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-amber-600/10 text-lg font-bold text-amber-400 ring-1 ring-amber-500/25 sm:mx-0">
            M
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Sign in
          </h1>
          <p className="text-sm leading-relaxed text-zinc-500">
            Local-first: data saves on your device, then syncs when you are
            online.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-md">
          <form onSubmit={signInEmail} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-500">Email</span>
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
              <span className="text-xs font-medium text-zinc-500">
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
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={busy}
              className="w-full"
              size="lg"
            >
              {busy ? "Signing in…" : "Continue"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-zinc-600">
              <span className="bg-zinc-900/60 px-2">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            className="w-full"
            onClick={() => void signInGoogle()}
          >
            Continue with Google
          </Button>
        </div>

        <p className="text-center text-[11px] text-zinc-600">
          By continuing you agree to your org&apos;s data staying encrypted in
          transit to Supabase.
        </p>
      </div>
    </div>
  );
}
