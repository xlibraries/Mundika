"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserId } from "@/hooks/use-user-id";
import { withBasePath } from "@/lib/auth/site-url";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { userId, loading } = useUserId();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !userId) {
      // Not authenticated, redirect to login
      router.replace(withBasePath("/login"));
    }
  }, [userId, loading, router]);

  // Show a loading state or nothing while checking auth
  if (loading || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--gs-bg)]">
        <p className="text-sm text-[var(--gs-text-secondary)]">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
