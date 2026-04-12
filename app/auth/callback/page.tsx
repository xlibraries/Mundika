"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function safeNextPath(raw: string | null): string {
  if (raw?.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const code = searchParams.get("code");
      const next = safeNextPath(searchParams.get("next"));

      if (!code) {
        const login = new URL("/login", window.location.origin);
        login.searchParams.set("error", "oauth_callback");
        login.searchParams.set(
          "error_description",
          "Google sign-in could not be completed. Check the provider setup and try again."
        );
        router.replace(login.pathname + login.search);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;
      if (!error) {
        router.replace(next);
        return;
      }
      const login = new URL("/login", window.location.origin);
      login.searchParams.set("error", "oauth_callback");
      login.searchParams.set("error_description", error.message);
      router.replace(login.pathname + login.search);
    }
    void run().catch(() => {
      if (!cancelled) setMessage("Sign-in failed. Redirecting…");
    });
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-[var(--gs-text-secondary)]">
      {message}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--gs-text-secondary)]">
          Loading…
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
