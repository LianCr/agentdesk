import type { SupabaseClient } from "@supabase/supabase-js";

// What GET /api/health checks, and why each check is real rather than a
// hard-coded 200:
//
//   config         which required env vars are present (booleans only — a
//                  value, or even its length, never leaves the server)
//   database       an actual round trip to Postgres through the same client
//                  the API routes use, with its latency
//   knowledgeBase  documents / pages / chunks are still the frozen 3 / 20 / 45
//                  every eval asserts; a different count means the demo is
//                  answering from a knowledge base no eval has checked
//   rateLimiter    the counter table exists (the limiter fails open without it)
//
// OpenAI is never called: a health check that spends credit on every probe
// would be its own abuse vector. "openai configured" is the honest claim.
//
// Status: "down" (HTTP 503) when the database cannot be reached or is not
// configured — nothing but the static pages works then. "degraded" (HTTP 200)
// when the app serves but something is off (counts drifted, limiter table
// missing, no OpenAI key). "ok" otherwise.

export const EXPECTED_KNOWLEDGE_BASE = { documents: 3, document_pages: 20, chunks: 45 } as const;

export type HealthStatus = "ok" | "degraded" | "down";

export type HealthReport = {
  status: HealthStatus;
  checkedAt: string;
  version: string | null;
  config: {
    supabaseUrl: boolean;
    supabaseSecretKey: boolean;
    openaiApiKey: boolean;
    n8nWebhook: boolean;
  };
  database: { reachable: boolean; latencyMs: number | null; errorCode: string | null };
  knowledgeBase: {
    expected: typeof EXPECTED_KNOWLEDGE_BASE;
    actual: Record<keyof typeof EXPECTED_KNOWLEDGE_BASE, number> | null;
    frozen: boolean;
  };
  rateLimiter: { tableReachable: boolean };
};

export type HealthDeps = {
  env: Record<string, string | undefined>;
  /** Null when the client cannot be built (missing env). */
  db: () => SupabaseClient | null;
  now?: () => number;
};

function present(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

async function countRows(db: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`DB_READ_FAILED:${error.code || "unknown"}`);
  // A HEAD request has no body, so PostgREST cannot say "no such table": a
  // missing table comes back as 204 with error null and count null. Treat a
  // missing count as a failure, never as zero — otherwise this check is the
  // kind of false green it exists to catch.
  if (count === null || count === undefined) throw new Error("DB_READ_FAILED:NO_COUNT");
  return count;
}

/** A GET (not HEAD), so a missing table surfaces as PGRST205 instead of 204. */
async function tableExists(db: SupabaseClient, table: string, column: string): Promise<boolean> {
  const { error } = await db.from(table).select(column).limit(1);
  return !error;
}

export async function checkHealth(deps: HealthDeps): Promise<HealthReport> {
  const now = deps.now ?? (() => performance.now());
  const { env } = deps;
  const config = {
    supabaseUrl: present(env.SUPABASE_URL),
    supabaseSecretKey: present(env.SUPABASE_SECRET_KEY),
    openaiApiKey: present(env.OPENAI_API_KEY),
    n8nWebhook: present(env.N8N_WEBHOOK_URL),
  };
  const report: HealthReport = {
    status: "ok",
    checkedAt: new Date().toISOString(),
    version: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    config,
    database: { reachable: false, latencyMs: null, errorCode: null },
    knowledgeBase: { expected: EXPECTED_KNOWLEDGE_BASE, actual: null, frozen: false },
    rateLimiter: { tableReachable: false },
  };

  const db = config.supabaseUrl && config.supabaseSecretKey ? deps.db() : null;
  if (!db) {
    report.database.errorCode = "NOT_CONFIGURED";
    report.status = "down";
    return report;
  }

  try {
    const started = now();
    const actual = {
      documents: await countRows(db, "documents"),
      document_pages: await countRows(db, "document_pages"),
      chunks: await countRows(db, "chunks"),
    };
    report.database = { reachable: true, latencyMs: Math.round(now() - started), errorCode: null };
    report.knowledgeBase.actual = actual;
    report.knowledgeBase.frozen =
      actual.documents === EXPECTED_KNOWLEDGE_BASE.documents &&
      actual.document_pages === EXPECTED_KNOWLEDGE_BASE.document_pages &&
      actual.chunks === EXPECTED_KNOWLEDGE_BASE.chunks;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    report.database.errorCode = message.startsWith("DB_READ_FAILED") ? message : "DB_UNREACHABLE";
    report.status = "down";
    return report;
  }

  try {
    report.rateLimiter.tableReachable = await tableExists(db, "rate_limit_counters", "bucket_key");
  } catch {
    report.rateLimiter.tableReachable = false;
  }

  const healthy =
    report.knowledgeBase.frozen && report.rateLimiter.tableReachable && config.openaiApiKey;
  report.status = healthy ? "ok" : "degraded";
  return report;
}

export function httpStatusFor(status: HealthStatus): number {
  return status === "down" ? 503 : 200;
}
