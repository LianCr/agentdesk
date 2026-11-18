import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkHealth, EXPECTED_KNOWLEDGE_BASE, httpStatusFor } from "../../lib/ops/health";

// A fake client that answers the one query shape health uses:
// from(table).select("*", { count: "exact", head: true }).

// Behaves like PostgREST for the two query shapes health uses, including the
// trap found against the real database: a HEAD count on a table that does not
// exist returns 204 with error null and count null, while a GET returns
// PGRST205.

type TableResult = { count?: number; error?: { code: string } };

function fakeDb(tables: Record<string, TableResult>, calls: string[] = []): SupabaseClient {
  return {
    from(table: string) {
      calls.push(table);
      const r = tables[table];
      return {
        select: (_cols: string, opts?: { head?: boolean }) => {
          if (opts?.head) {
            return Promise.resolve(
              r ? { count: r.count ?? null, error: r.error ?? null } : { count: null, error: null },
            );
          }
          return {
            limit: async () =>
              r && !r.error ? { data: [], error: null } : { data: null, error: r?.error ?? { code: "PGRST205" } },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const FULL_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  OPENAI_API_KEY: "sk-x",
};
const FROZEN = {
  documents: { count: 3 },
  document_pages: { count: 20 },
  chunks: { count: 45 },
  rate_limit_counters: { count: 0 },
};

describe("checkHealth", () => {
  it("ok when config, database, frozen knowledge base and limiter table are all present", async () => {
    const report = await checkHealth({ env: FULL_ENV, db: () => fakeDb(FROZEN) });
    expect(report.status).toBe("ok");
    expect(report.knowledgeBase.actual).toEqual(EXPECTED_KNOWLEDGE_BASE);
    expect(report.knowledgeBase.frozen).toBe(true);
    expect(report.database.reachable).toBe(true);
    expect(report.rateLimiter.tableReachable).toBe(true);
    expect(httpStatusFor(report.status)).toBe(200);
  });

  it("reports config as booleans only — no secret value appears anywhere in the report", async () => {
    const report = await checkHealth({ env: FULL_ENV, db: () => fakeDb(FROZEN) });
    expect(report.config).toEqual({ supabaseUrl: true, supabaseSecretKey: true, openaiApiKey: true, n8nWebhook: false });
    const text = JSON.stringify(report);
    for (const value of Object.values(FULL_ENV)) expect(text).not.toContain(value);
  });

  it("degraded (still 200) when the knowledge base drifted from 3/20/45", async () => {
    const report = await checkHealth({ env: FULL_ENV, db: () => fakeDb({ ...FROZEN, chunks: { count: 47 } }) });
    expect(report.status).toBe("degraded");
    expect(report.knowledgeBase.frozen).toBe(false);
    expect(httpStatusFor(report.status)).toBe(200);
  });

  it("degraded when the rate-limit migration has not been pushed", async () => {
    const { rate_limit_counters: _omit, ...withoutLimiter } = FROZEN;
    const report = await checkHealth({ env: FULL_ENV, db: () => fakeDb(withoutLimiter) });
    expect(report.status).toBe("degraded");
    expect(report.rateLimiter.tableReachable).toBe(false);
  });

  it("degraded when OPENAI_API_KEY is missing (comparison and reviews still work)", async () => {
    const { OPENAI_API_KEY: _omit, ...env } = FULL_ENV;
    const report = await checkHealth({ env, db: () => fakeDb(FROZEN) });
    expect(report.status).toBe("degraded");
    expect(report.config.openaiApiKey).toBe(false);
  });

  it("down (503) when the database is unreachable — e.g. a paused Supabase project", async () => {
    const report = await checkHealth({
      env: FULL_ENV,
      db: () => fakeDb({ documents: { error: { code: "PGRST000" } } }),
    });
    expect(report.status).toBe("down");
    expect(report.database.reachable).toBe(false);
    expect(report.database.errorCode).toBe("DB_READ_FAILED:PGRST000");
    expect(httpStatusFor(report.status)).toBe(503);
  });

  it("down without touching the network when Supabase env is missing", async () => {
    let built = false;
    const report = await checkHealth({
      env: { OPENAI_API_KEY: "sk-x" },
      db: () => {
        built = true;
        return fakeDb(FROZEN);
      },
    });
    expect(report.status).toBe("down");
    expect(report.database.errorCode).toBe("NOT_CONFIGURED");
    expect(built).toBe(false);
  });

  it("only reads counts — it queries the three knowledge tables and the limiter table, nothing else", async () => {
    const calls: string[] = [];
    await checkHealth({ env: FULL_ENV, db: () => fakeDb(FROZEN, calls) });
    expect(calls).toEqual(["documents", "document_pages", "chunks", "rate_limit_counters"]);
  });

  it("a HEAD count with no count and no error (missing table) is a failure, not zero", async () => {
    const { chunks: _omit, ...withoutChunks } = FROZEN;
    const report = await checkHealth({ env: FULL_ENV, db: () => fakeDb(withoutChunks) });
    expect(report.status).toBe("down");
    expect(report.database.errorCode).toBe("DB_READ_FAILED:NO_COUNT");
  });

  it("reports the deployed commit when Vercel provides it", async () => {
    const report = await checkHealth({
      env: { ...FULL_ENV, VERCEL_GIT_COMMIT_SHA: "6f503d8abcdef" },
      db: () => fakeDb(FROZEN),
    });
    expect(report.version).toBe("6f503d8");
  });
});
