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
        if (row.attempts > 8) {
          await db.sync_queue.delete(row.id);
        }
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
export async function syncWithRemote(userId: string): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  for (let i = 0; i < 60; i++) {
    const before = await db.sync_queue.count();
    if (before === 0) break;
    await flushSyncQueue();
    const after = await db.sync_queue.count();
    if (after >= before) break;
  }

  if ((await db.sync_queue.count()) > 0) return;

  await pullRemoteToLocal(userId);
}

export function startSyncLoop(
  intervalMs = 15_000,
  getUserId?: () => string | null
) {
  if (typeof window === "undefined") return () => {};

  const tick = () => {
    const uid = getUserId?.();
    if (uid && navigator.onLine) {
      void syncWithRemote(uid).catch(() => {});
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
