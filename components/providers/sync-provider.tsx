"use client";

import { useEffect, useRef } from "react";
import {
  flushSyncQueue,
  startSyncLoop,
  syncWithRemote,
} from "@/lib/sync/engine";
import { clearLocalUserData } from "@/lib/sync/clear-local-user";
import { db } from "@/lib/db";
import { useAppStore } from "@/store/app-store";
import { useUserId } from "@/hooks/use-user-id";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useUserId();
  const prevUserIdRef = useRef<string | null>(null);
  const setOnline = useAppStore((s) => s.setOnline);
  const setSyncState = useAppStore((s) => s.setSyncState);
  const setLastSyncAt = useAppStore((s) => s.setLastSyncAt);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOnline(navigator.onLine);

    const stop = startSyncLoop(12_000, () => userId);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      stop();
    };
  }, [setOnline, userId]);

  useEffect(() => {
    const prev = prevUserIdRef.current;
    let cancelled = false;

    void (async () => {
      if (prev && prev !== userId) {
        await clearLocalUserData(prev);
        await db.sync_queue.clear();
      }

      prevUserIdRef.current = userId ?? null;

      if (!userId || cancelled) return;

      setSyncState("syncing");
      try {
        if (navigator.onLine) {
          await syncWithRemote(userId);
        } else {
          await flushSyncQueue();
        }
      } finally {
        if (!cancelled) {
          setLastSyncAt(new Date().toISOString());
          setSyncState("idle");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setLastSyncAt, setSyncState, userId]);

  return children;
}
