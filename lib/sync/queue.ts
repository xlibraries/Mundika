import { db } from "@/lib/db";
import type { SyncOp } from "@/lib/types/domain";

export async function enqueueSync(
  table_name: string,
  op: SyncOp,
  row_id: string,
  payload: Record<string, unknown>
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.sync_queue.add({
    id,
    table_name,
    op,
    row_id,
    payload,
    created_at: now,
    attempts: 0,
  });
}
