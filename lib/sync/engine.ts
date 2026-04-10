import { db } from "@/lib/db";
import { createClient } from "@/utils/supabase/client";
import type { SyncQueueRow } from "@/lib/types/domain";

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

export function startSyncLoop(intervalMs = 15_000) {
  if (typeof window === "undefined") return () => {};

  const tick = () => {
    void flushSyncQueue();
  };

  const id = window.setInterval(tick, intervalMs);
  window.addEventListener("online", tick);

  return () => {
    window.clearInterval(id);
    window.removeEventListener("online", tick);
  };
}
