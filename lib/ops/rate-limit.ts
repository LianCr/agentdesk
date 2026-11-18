import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Fixed-window rate limits for the endpoints that spend OpenAI credit.
//
// Why the counter lives in Postgres: Vercel runs each request in a serverless
// function instance that can be cold, recycled or one of many in parallel, so
// an in-process counter would reset at random and never be shared. The demo
// already has one shared, durable store — the Supabase database — so the
// counter is one row per (key, window), incremented atomically by the
// `rate_limit_hit` RPC (insert ... on conflict do update ... returning).
//
// Privacy: the key is an HMAC of the route and client IP, never the raw IP.
//
// Failure policy: if the counter store is unreachable (or the migration has
// not been pushed yet) the request is ALLOWED and a warning is logged. The
// limiter protects a budget; it must not become a second way for the demo to
// go down. The OpenAI dashboard spend cap stays the hard backstop.

export type RateLimitRule = {
  /** Stable name, part of the key. */
  name: string;
  windowSeconds: number;
  limit: number;
  /** "ip" limits each client; "global" is one shared budget for everyone. */
  scope: "ip" | "global";
};

export type HitResult = { allowed: boolean; count: number; resetAt: Date };

export interface RateLimitStore {
  hit(key: string, windowSeconds: number, limit: number): Promise<HitResult>;
}

export type RateLimitDecision =
  | { allowed: true; degraded: boolean }
  | { allowed: false; rule: string; retryAfterSeconds: number };

const MINUTE = 60;
const DAY = 24 * 60 * MINUTE;

// One shared daily ceiling across the three model-spending routes, plus a
// per-client burst limit on each. Numbers are sized for a portfolio demo: a
// reviewer clicking around never meets them; a script looping on the
// endpoint does within seconds.
const GLOBAL_MODEL_BUDGET: RateLimitRule = {
  name: "model-calls-daily",
  windowSeconds: DAY,
  limit: 300,
  scope: "global",
};

export const RATE_LIMITS: Record<"answer" | "narrative" | "transcribe", RateLimitRule[]> = {
  answer: [
    { name: "answer-ip", windowSeconds: 10 * MINUTE, limit: 10, scope: "ip" },
    GLOBAL_MODEL_BUDGET,
  ],
  narrative: [
    { name: "narrative-ip", windowSeconds: 10 * MINUTE, limit: 10, scope: "ip" },
    GLOBAL_MODEL_BUDGET,
  ],
  transcribe: [
    { name: "transcribe-ip", windowSeconds: 10 * MINUTE, limit: 20, scope: "ip" },
    GLOBAL_MODEL_BUDGET,
  ],
};

/** First hop of x-forwarded-for (set by Vercel's edge), else x-real-ip. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * HMAC rather than a bare hash: the IPv4 space is small enough to reverse a
 * plain sha256 by brute force. The secret is server-only and never logged.
 */
export function bucketKey(rule: RateLimitRule, ip: string, secret: string): string {
  if (rule.scope === "global") return `global:${rule.name}`;
  const digest = createHmac("sha256", secret).update(`${rule.name}|${ip}`).digest("hex");
  return `ip:${rule.name}:${digest.slice(0, 32)}`;
}

/**
 * Check the rules in order; the request passes only if all pass. Evaluation
 * stops at the first rule that blocks, so a client hammering the per-IP limit
 * does not also drain the shared daily budget for everyone else.
 */
export async function checkRateLimit(
  store: RateLimitStore,
  rules: RateLimitRule[],
  ip: string,
  secret: string,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  try {
    for (const rule of rules) {
      const result = await store.hit(bucketKey(rule, ip, secret), rule.windowSeconds, rule.limit);
      if (!result.allowed) {
        const seconds = Math.ceil((result.resetAt.getTime() - now.getTime()) / 1000);
        return { allowed: false, rule: rule.name, retryAfterSeconds: Math.max(1, seconds) };
      }
    }
  } catch {
    return { allowed: true, degraded: true };
  }
  return { allowed: true, degraded: false };
}

export const RATE_LIMIT_MESSAGE =
  "请求太频繁，请稍后再试。Too many requests from this connection — please wait a few minutes and try again.";

export function rateLimitedBody(extra: Record<string, unknown> = {}) {
  return { error: "RATE_LIMITED", message: RATE_LIMIT_MESSAGE, ...extra };
}

/** Postgres-backed store (see supabase/migrations/*_rate_limits.sql). */
export function supabaseRateLimitStore(db: SupabaseClient): RateLimitStore {
  return {
    async hit(key, windowSeconds, limit) {
      const { data, error } = await db.rpc("rate_limit_hit", {
        p_key: key,
        p_window_seconds: windowSeconds,
        p_limit: limit,
      });
      if (error) throw new Error(`RATE_LIMIT_STORE_FAILED: ${error.code || "unknown"}`);
      const row = (Array.isArray(data) ? data[0] : data) as
        | { allowed: boolean; hit_count: number; reset_at: string }
        | undefined;
      if (!row) throw new Error("RATE_LIMIT_STORE_FAILED: empty");
      return { allowed: row.allowed, count: row.hit_count, resetAt: new Date(row.reset_at) };
    },
  };
}

/** In-memory store with the same fixed-window semantics, for tests. */
export function memoryRateLimitStore(clock: () => Date = () => new Date()): RateLimitStore {
  const counts = new Map<string, number>();
  return {
    async hit(key, windowSeconds, limit) {
      const nowSeconds = Math.floor(clock().getTime() / 1000);
      const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
      const k = `${key}@${windowStart}`;
      const count = (counts.get(k) ?? 0) + 1;
      counts.set(k, count);
      return {
        allowed: count <= limit,
        count,
        resetAt: new Date((windowStart + windowSeconds) * 1000),
      };
    },
  };
}
