"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybe = error as {
    code?: string;
    message?: string;
    status?: number;
  };
  const message = (maybe.message ?? "").toLowerCase();
  return (
    maybe.code === "refresh_token_not_found" ||
    maybe.status === 400 ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found")
  );
}

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            await supabase.auth.signOut().catch(() => undefined);
          }
          setUserId(null);
          return;
        }
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
