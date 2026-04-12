"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function safeNextPath(raw: string | null): string {
  if (raw?.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

function oauthErrorQuery(searchParams: URLSearchParams): string {
  const q = new URLSearchParams({
    error: searchParams.get("error") ?? "oauth_callback",
    error_description:
      searchParams.get("error_description") ??
      "Google sign-in could not be completed. Check the provider setup and try again.",
  });
  return q.toString();
}

/**
 * PKCE exchange runs inside Supabase client `initialize()` when `detectSessionInUrl`
 * is true — do not call `exchangeCodeForSession` again here (second call clears the
 * verifier and throws "PKCE code verifier not found").
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function complete() {
      // `getSession` awaits `initializePromise`, so URL / PKCE handling has finished.
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        const q = new URLSearchParams({
          error: "oauth_callback",
          error_description: error.message,
        });
        router.replace(`/login?${q.toString()}`);
        return;
      }

      if (session) {
        router.replace(safeNextPath(searchParams.get("next")));
        return;
      }

      const urlError = searchParams.get("error");
      if (urlError) {
        router.replace(`/login?${oauthErrorQuery(searchParams)}`);
        return;
      }

      if (searchParams.get("code")) {
        await new Promise((r) => setTimeout(r, 150));
        if (cancelled) return;
        const retry = await supabase.auth.getSession();
        if (retry.data.session) {
          router.replace(safeNextPath(searchParams.get("next")));
          return;
        }
      }

      const q = new URLSearchParams({
        error: "oauth_callback",
        error_description:
          "Sign-in could not be completed. Start again from the login page.",
      });
      router.replace(`/login?${q.toString()}`);
    }

    void complete().catch(() => {
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
