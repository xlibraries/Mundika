"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { UserEntitlementsRow } from "@/lib/types/domain";

export type EntitlementsState =
  | { status: "idle" | "loading" }
  | { status: "ready"; row: UserEntitlementsRow | null }
  | { status: "error"; message: string };

async function loadEntitlements(
  userId: string
): Promise<
  | { ok: true; row: UserEntitlementsRow | null }
  | { ok: false; message: string }
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, row: data as UserEntitlementsRow | null };
}

export function useEntitlements(userId: string | null) {
  const [state, setState] = useState<EntitlementsState>({ status: "idle" });

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({ status: "ready", row: null });
      return;
    }
    setState({ status: "loading" });
    const result = await loadEntitlements(userId);
    if (!result.ok) {
      setState({ status: "error", message: result.message });
      return;
    }
    setState({ status: "ready", row: result.row });
  }, [userId]);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  return { state, refresh };
}
