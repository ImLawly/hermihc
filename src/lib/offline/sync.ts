// Sync engine: drains the write queue when online.
import { supabase } from "@/integrations/supabase/client";
import { hcdb, pendingCount } from "./db";
import type { QueryClient } from "@tanstack/react-query";

type Listener = (count: number) => void;
const listeners = new Set<Listener>();
let syncing = false;

export function subscribePending(fn: Listener) {
  listeners.add(fn);
  pendingCount().then(fn);
  return () => listeners.delete(fn);
}

async function emit() {
  const c = await pendingCount();
  listeners.forEach((l) => l(c));
}

export async function drain(qc?: QueryClient) {
  if (!hcdb || syncing || !navigator.onLine) return;
  syncing = true;
  try {
    // Drain in insertion order
    while (true) {
      const item = await hcdb.queue.orderBy("created_at").first();
      if (!item) break;

      try {
        // dynamic-typed by design; we're hitting arbitrary tables.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = (supabase as any).from(item.table);
        if (item.op === "insert") {
          const { error } = await q.insert(item.payload);
          if (error) throw error;
        } else if (item.op === "update") {
          q = q.update(item.payload);
          for (const [k, v] of Object.entries(item.match ?? {})) {
            q = q.eq(k, v);
          }
          const { error } = await q;
          if (error) throw error;
        }
        await hcdb.queue.delete(item.id!);
        if (qc && item.invalidate_keys) {
          item.invalidate_keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
        }
        await emit();
      } catch (err) {
        // Mark error, backoff and exit to retry later
        await hcdb.queue.update(item.id!, {
          retries: (item.retries ?? 0) + 1,
          last_error: err instanceof Error ? err.message : String(err),
        });
        // Avoid infinite tight loop — stop and try again later
        break;
      }
    }
  } finally {
    syncing = false;
    await emit();
  }
}

let started = false;
export function startSyncEngine(qc: QueryClient) {
  if (started || typeof window === "undefined") return;
  started = true;
  // Initial attempt + periodic
  drain(qc);
  setInterval(() => drain(qc), 30_000);
  window.addEventListener("online", () => drain(qc));
}
