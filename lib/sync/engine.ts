import { db } from "@/lib/db";
import { createClient } from "@/utils/supabase/client";
import type { SyncQueueRow } from "@/lib/types/domain";
import { pullRemoteToLocal } from "@/lib/sync/pull";

const TABLES = new Set([
  "parties",
  "items",
  "inventory",
  "bills",
  "bill_items",
  "ledger_entries",
  "purchases",
  "purchase_items",
  "stock_transfers",
]);

let flushing = false;

async function pushRow(row: SyncQueueRow): Promise<boolean> {
  const supabase = createClient();
  const table = row.table_name;
  if (!TABLES.has(table)) return true;

  if (row.op === "delete") {
    const { error } = await supabase.from(table).delete().eq("id", row.row_id);
    if (error) throw error;
    return true;
  }

  const { error } = await supabase.from(table).upsert(row.payload, {
    onConflict: "id",
  });
  if (error) throw error;
  return true;
}

export async function flushSyncQueue(): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: 0, failed: 0 };
  }

  flushing = true;
  let ok = 0;
  let failed = 0;

  try {
    const batch = await db.sync_queue.orderBy("created_at").limit(50).toArray();

    for (const row of batch) {
      try {
        await pushRow(row);
        await db.sync_queue.delete(row.id);
        ok += 1;
      } catch {
        await db.sync_queue.update(row.id, {
          attempts: row.attempts + 1,
        });
        failed += 1;
        // Never drop queued mutations after N failures: transient RLS/network
        // issues must not permanently lose local edits. Rows retry until push succeeds.
      }
    }
  } finally {
    flushing = false;
  }

  return { ok, failed };
}

/**
 * Push local queue to Supabase, then pull server state into IndexedDB (offline cache).
 * Skips pull while the outbound queue still has rows so local-only edits are not dropped.
 */
export type SyncRemoteResult =
  | { ok: true }
  | {
      ok: false;
      reason: "offline" | "queue_backlog" | "pull_failed";
      message?: string;
    };

export async function syncWithRemote(
  userId: string
): Promise<SyncRemoteResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, reason: "offline" };
  }

  for (let i = 0; i < 60; i++) {
    const before = await db.sync_queue.count();
    if (before === 0) break;
    await flushSyncQueue();
    const after = await db.sync_queue.count();
    if (after >= before) break;
  }

  if ((await db.sync_queue.count()) > 0) {
    return { ok: false, reason: "queue_backlog" };
  }

  try {
    await pullRemoteToLocal(userId);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: "pull_failed", message };
  }
}

export function startSyncLoop(
  intervalMs = 15_000,
  getUserId?: () => string | null,
  onRemoteSync?: (result: SyncRemoteResult) => void
) {
  if (typeof window === "undefined") return () => {};

  const tick = () => {
    const uid = getUserId?.();
    if (uid && navigator.onLine) {
      void syncWithRemote(uid)
        .then((r) => {
          onRemoteSync?.(r);
        })
        .catch((e) => {
          onRemoteSync?.({
            ok: false,
            reason: "pull_failed",
            message: e instanceof Error ? e.message : String(e),
          });
        });
    } else {
      void flushSyncQueue();
    }
  };

  const id = window.setInterval(tick, intervalMs);
  window.addEventListener("online", tick);

  return () => {
    window.clearInterval(id);
    window.removeEventListener("online", tick);
  };
}
