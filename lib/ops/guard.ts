import { NextResponse } from "next/server";
import { createServiceClient } from "../supabase/server";
import type { RequestContext } from "./request-log";
import {
  checkRateLimit,
  clientIp,
  rateLimitedBody,
  supabaseRateLimitStore,
  type RateLimitRule,
  type RateLimitStore,
} from "./rate-limit";

// The one call a route makes before spending model credit.

let storeOverride: RateLimitStore | null = null;
let defaultStore: RateLimitStore | null = null;

/** Test hook: route handlers use this store instead of Postgres. */
export function setRateLimitStore(store: RateLimitStore | null): void {
  storeOverride = store;
}

function store(): RateLimitStore {
  if (storeOverride) return storeOverride;
  defaultStore ??= supabaseRateLimitStore(createServiceClient());
  return defaultStore;
}

/**
 * Returns a 429 response when the caller is over a limit, otherwise null.
 * `extraBody` lets a route keep its own response shape on 429 (the narrative
 * route always answers with a renderable `narrativeStatus`).
 */
export async function enforceRateLimit(
  request: Request,
  rules: RateLimitRule[],
  log: RequestContext,
  extraBody: Record<string, unknown> = {},
): Promise<NextResponse | null> {
  let decision;
  try {
    decision = await checkRateLimit(
      store(),
      rules,
      clientIp(request.headers),
      process.env.SUPABASE_SECRET_KEY ?? "agentdesk-rate-limit",
    );
  } catch {
    // createServiceClient throws when env is missing; fail open like a store outage.
    decision = { allowed: true as const, degraded: true };
  }

  if (decision.allowed) {
    if (decision.degraded) log.annotate({ rateLimit: "unavailable" });
    return null;
  }
  log.annotate({ rateLimit: "blocked", rateLimitRule: decision.rule });
  return NextResponse.json(rateLimitedBody(extraBody), {
    status: 429,
    headers: { "retry-after": String(decision.retryAfterSeconds) },
  });
}
