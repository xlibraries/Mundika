"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useUserId } from "@/hooks/use-user-id";
import { ensureDefaultShopForUser } from "@/lib/shops/queries";

export const SHOP_PROFILE_UPDATED_EVENT = "mundika:shop-updated";

export function notifyShopProfileUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHOP_PROFILE_UPDATED_EVENT));
}

/**
 * Resolves the signed-in user's primary shop display name for chrome (rail, mobile header).
 */
export function usePrimaryShopName() {
  const { userId, loading: authLoading } = useUserId();
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onUpdate = () => setRefreshKey((k) => k + 1);
    window.addEventListener(SHOP_PROFILE_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(SHOP_PROFILE_UPDATED_EVENT, onUpdate);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setName(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const supabase = createClient();
        const { shop } = await ensureDefaultShopForUser(supabase, userId);
        const n = (shop.name ?? "").trim();
        if (!cancelled) setName(n.length > 0 ? n : null);
      } catch {
        if (!cancelled) setName(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, refreshKey]);

  return {
    shopName: name,
    loading: authLoading || loading,
  };
}
