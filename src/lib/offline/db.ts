// IndexedDB cache + write queue using Dexie.
import Dexie, { type Table } from "dexie";

export interface CachedRow {
  key: string; // composite: table:id or table:scope:id
  table: string;
  data: unknown;
  updated_at: string;
}

export type QueueOp = "insert" | "update";

export interface QueueItem {
  id?: number;
  table: string;            // e.g. "evolutions"
  op: QueueOp;
  payload: Record<string, unknown>;
  match?: Record<string, unknown>; // for update
  invalidate_keys?: string[][];    // tanstack query keys to invalidate after sync
  created_at: number;
  retries: number;
  last_error?: string;
}

class HCDb extends Dexie {
  rows!: Table<CachedRow, string>;
  queue!: Table<QueueItem, number>;
  constructor() {
    super("hc-offline");
    this.version(1).stores({
      rows: "key,table,updated_at",
      queue: "++id,table,created_at",
    });
  }
}

export const hcdb: HCDb | null = typeof window !== "undefined" ? new HCDb() : null;

export async function cachePut(table: string, id: string, data: unknown) {
  if (!hcdb) return;
  await hcdb.rows.put({
    key: `${table}:${id}`,
    table,
    data,
    updated_at: new Date().toISOString(),
  });
}

export async function cachePutMany(table: string, items: Array<{ id: string; data: unknown }>) {
  if (!hcdb || items.length === 0) return;
  const now = new Date().toISOString();
  await hcdb.rows.bulkPut(items.map((i) => ({
    key: `${table}:${i.id}`,
    table,
    data: i.data,
    updated_at: now,
  })));
}

export async function cacheGetByTable<T = unknown>(table: string): Promise<T[]> {
  if (!hcdb) return [];
  const rows = await hcdb.rows.where("table").equals(table).toArray();
  return rows.map((r) => r.data as T);
}

export async function cacheGet<T = unknown>(table: string, id: string): Promise<T | null> {
  if (!hcdb) return null;
  const row = await hcdb.rows.get(`${table}:${id}`);
  return (row?.data as T) ?? null;
}

export async function enqueue(item: Omit<QueueItem, "id" | "created_at" | "retries">) {
  if (!hcdb) throw new Error("Offline DB no disponible");
  await hcdb.queue.add({
    ...item,
    created_at: Date.now(),
    retries: 0,
  });
}

export async function pendingCount(): Promise<number> {
  if (!hcdb) return 0;
  return hcdb.queue.count();
}
