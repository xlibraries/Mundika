"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { withBasePath } from "@/lib/auth/site-url";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { useUserId } from "@/hooks/use-user-id";
import { fetchUserOnboardingStatus } from "@/lib/user-profile/user-profiles";
import { AppShell } from "@/components/layout/app-shell";

async function signOutToHome() {
  await createClient().auth.signOut();
  window.location.href = withBasePath("/");
}

/**
 * Full-screen setup (no app nav) until onboarding is done; then normal {@link AppShell}.
 */
function OnboardingChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-[var(--gs-bg)] text-[var(--gs-text)]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--gs-border)] bg-[var(--gs-surface)] px-4 py-3 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--gs-grid)] bg-[var(--gs-surface-plain)] text-xs font-bold text-[var(--gs-primary)]">
            M
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gs-primary)]">
              Mundika
            </p>
            <p className="truncate text-sm font-medium text-[var(--gs-text)]">
              Account setup — one step left
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOutToHome()}
          className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-[var(--gs-text-secondary)] transition hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]"
        >
          Sign out
        </button>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

export function AppOnboardingShell({ children }: { children: React.ReactNode }) {
  const { userId, loading: authLoading } = useUserId();
  const pathname = usePathname();
  const router = useRouter();
  const [profileLoading, setProfileLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const checking = authLoading || !userId || profileLoading;

  useEffect(() => {
    if (authLoading || !userId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setProfileLoading(true);
      const supabase = createClient();
      const done = await fetchUserOnboardingStatus(supabase, userId);
      if (cancelled) return;
      setOnboardingComplete(done);
      setProfileLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, pathname]);

  useEffect(() => {
    if (checking || !userId || onboardingComplete) return;
    if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return;

    const qs =
      typeof window !== "undefined" && window.location.search
        ? window.location.search
        : "";
    const next = safeNextPath(`${pathname}${qs}` || "/dashboard", "/dashboard");
    router.replace(
      withBasePath(`/onboarding?next=${encodeURIComponent(next)}`)
    );
  }, [checking, userId, onboardingComplete, pathname, router]);

  if (checking) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[var(--gs-bg)] text-sm text-[var(--gs-text-secondary)]">
        Loading…
      </div>
    );
  }

  if (!onboardingComplete) {
    const onOnboarding =
      pathname === "/onboarding" || pathname.startsWith("/onboarding/");
    if (!onOnboarding) {
      return (
        <div className="flex min-h-svh items-center justify-center bg-[var(--gs-bg)] text-sm text-[var(--gs-text-secondary)]">
          Redirecting to setup…
        </div>
      );
    }
    return <OnboardingChrome>{children}</OnboardingChrome>;
  }

  return <AppShell>{children}</AppShell>;
}
