"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { withBasePath } from "@/lib/auth/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then((res: { data: { session: unknown } }) => {
      if (res.data.session) setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: unknown, session: unknown) => {
        if (session) setReady(true);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.replace(withBasePath("/login"));
      router.refresh();
    }, 1500);
  }

  if (!ready) {
    return (
      <p className="text-sm text-[var(--gs-text-secondary)]">
        Checking your reset link… If this hangs, open the link from your email
        again or request a new reset from sign-in.
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-sm text-[var(--gs-text)]">
        Password updated. Redirecting to sign in…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
          New password
        </span>
        <Input
          type="password"
          required
          autoComplete="new-password"
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
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {error ? (
        <p className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy} className="w-full" size="lg">
        {busy ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] space-y-6 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] p-6">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gs-primary)]">
            MUNDIKA
          </p>
          <h1 className="text-xl font-medium text-[var(--gs-text)]">Set a new password</h1>
          <p className="text-xs text-[var(--gs-text-secondary)]">
            Use the link from your email; this page saves your password to your account.
          </p>
        </div>
        <ResetPasswordForm />
        <p className="text-center text-xs">
          <Link href="/login" className="text-[var(--gs-primary)] underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
