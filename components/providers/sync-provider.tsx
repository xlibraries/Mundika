"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  flushSyncQueue,
  startSyncLoop,
  syncWithRemote,
  type SyncRemoteResult,
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

  const onRemoteSync = useCallback(
    (result: SyncRemoteResult) => {
      if (result.ok) {
        setLastSyncAt(new Date().toISOString());
      }
    },
    [setLastSyncAt]
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOnline(navigator.onLine);

    const stop = startSyncLoop(12_000, () => userId, onRemoteSync);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      stop();
    };
  }, [onRemoteSync, setOnline, userId]);

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
      let remoteResult: SyncRemoteResult = { ok: false, reason: "offline" };
      try {
        if (navigator.onLine) {
          remoteResult = await syncWithRemote(userId);
        } else {
          await flushSyncQueue();
          remoteResult = { ok: false, reason: "offline" };
        }
      } finally {
        if (!cancelled) {
          if (remoteResult.ok) {
            setLastSyncAt(new Date().toISOString());
          }
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
