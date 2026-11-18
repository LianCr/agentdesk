import "server-only";
import { NextResponse } from "next/server";
import { checkHealth, httpStatusFor } from "../../../lib/ops/health";
import { withRequestLog } from "../../../lib/ops/request-log";
import { createServiceClient } from "../../../lib/supabase/server";

// Liveness + readiness in one public, read-only JSON document. See
// lib/ops/health.ts for what each check proves. Never rate limited (it costs
// four HEAD-count queries, no model call) and never cached.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export const GET = withRequestLog("/api/health", async (_request, _ctx: unknown, log) => {
  const report = await checkHealth({
    env: process.env,
    db: () => {
      try {
        return createServiceClient();
      } catch {
        return null;
      }
    },
  });
  log.annotate({
    health: report.status,
    dbLatencyMs: report.database.latencyMs,
    kbFrozen: report.knowledgeBase.frozen,
  });
  return NextResponse.json(report, {
    status: httpStatusFor(report.status),
    headers: { "cache-control": "no-store" },
  });
});
