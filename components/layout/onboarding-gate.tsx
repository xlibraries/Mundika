"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { withBasePath } from "@/lib/auth/site-url";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { useUserId } from "@/hooks/use-user-id";
import { fetchUserOnboardingStatus } from "@/lib/user-profile/user-profiles";

/**
 * Forces first-time setup until `user_profiles.onboarding_completed_at` is set.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { userId, loading: authLoading } = useUserId();
  const pathname = usePathname();
  const router = useRouter();
  const [profileLoading, setProfileLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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
      setNeedsOnboarding(!done);
      setProfileLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, pathname]);

  useEffect(() => {
    if (checking || !userId || !needsOnboarding) return;
    if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return;

    const qs =
      typeof window !== "undefined" && window.location.search
        ? window.location.search
        : "";
    const next = safeNextPath(`${pathname}${qs}` || "/dashboard", "/dashboard");
    router.replace(
      withBasePath(`/onboarding?next=${encodeURIComponent(next)}`)
    );
  }, [checking, userId, needsOnboarding, pathname, router]);

  if (checking) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-[var(--gs-text-secondary)]">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
