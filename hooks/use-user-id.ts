"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setUserId(data.session?.user?.id ?? null);
      } catch {
        setUserId(null);
      } finally {
        setLoading(false);
      }
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: unknown, session: unknown) => {
      const nextUserId =
        typeof session === "object" &&
        session !== null &&
        "user" in session &&
        typeof session.user === "object" &&
        session.user !== null &&
        "id" in session.user &&
        typeof session.user.id === "string"
          ? session.user.id
          : null;

      setUserId(nextUserId);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { userId, loading };
}
