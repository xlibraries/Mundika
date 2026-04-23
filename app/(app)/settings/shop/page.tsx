"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "@/lib/auth/site-url";

/** Shop profile merged into `/account` (static export–safe redirect). */
export default function ShopSettingsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(withBasePath("/account"));
  }, [router]);
  return (
    <p className="py-6 text-sm text-[var(--gs-text-secondary)]">
      Account page par le ja rahe hain…
    </p>
  );
}
