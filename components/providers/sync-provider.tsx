"use client";

import { useEffect } from "react";
import { flushSyncQueue, startSyncLoop } from "@/lib/sync/engine";
import { useAppStore } from "@/store/app-store";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const setOnline = useAppStore((s) => s.setOnline);
  const setSyncState = useAppStore((s) => s.setSyncState);
  const setLastSyncAt = useAppStore((s) => s.setLastSyncAt);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOnline(navigator.onLine);

    const stop = startSyncLoop(12_000);

    const run = async () => {
      setSyncState("syncing");
      await flushSyncQueue();
      setLastSyncAt(new Date().toISOString());
      setSyncState("idle");
    };

    void run();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      stop();
    };
  }, [setLastSyncAt, setOnline, setSyncState]);

  return children;
}
