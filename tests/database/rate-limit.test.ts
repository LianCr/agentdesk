import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../../lib/supabase/server";
import { supabaseRateLimitStore } from "../../lib/ops/rate-limit";

// The rate_limit_hit RPC against a real Postgres: the counter must be atomic
// under concurrency (the reason it is an RPC and not read-then-write from
// the app), and argument validation must hold. Keys are test_-prefixed and
// removed afterwards.

let db: SupabaseClient;
const KEY = `test_rl_${randomUUID()}`;

beforeAll(() => {
  db = createServiceClient();
});

afterAll(async () => {
  await db.from("rate_limit_counters").delete().like("bucket_key", "test\\_rl\\_%");
});

describe("rate_limit_hit (database)", () => {
  it("counts sequential hits and flips to blocked after the limit", async () => {
    const store = supabaseRateLimitStore(db);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await store.hit(`${KEY}_seq`, 600, 3));
    expect(results.map((r) => r.count)).toEqual([1, 2, 3, 4]);
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    // reset_at is the end of the current 10-minute window.
    const reset = results[0]!.resetAt.getTime();
    expect(reset % 600_000).toBe(0);
    expect(reset).toBeGreaterThan(Date.now());
  });

  it("is atomic: 20 concurrent hits produce counts 1..20 with no duplicates", async () => {
    const store = supabaseRateLimitStore(db);
    const results = await Promise.all(Array.from({ length: 20 }, () => store.hit(`${KEY}_race`, 600, 10)));
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
  });

  it("rejects a non-positive window or limit", async () => {
    const { error } = await db.rpc("rate_limit_hit", { p_key: `${KEY}_bad`, p_window_seconds: 0, p_limit: 1 });
    expect(error?.message).toMatch(/RATE_LIMIT_ARGS_INVALID/);
  });

  it("stores one row per key and window", async () => {
    const { count } = await db
      .from("rate_limit_counters")
      .select("*", { count: "exact", head: true })
      .eq("bucket_key", `${KEY}_race`);
    expect(count).toBe(1);
  });
});
