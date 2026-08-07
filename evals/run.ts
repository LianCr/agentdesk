import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../lib/supabase/server";
import { createOpenAiProvider, OPENAI_EMBEDDING_MODEL, OPENAI_EMBEDDING_DIMENSIONS } from "../lib/embeddings/openai";
import { createAnswerModel, answerModelId } from "../lib/ai/client";
import { createRewriter } from "../lib/retrieval/rewrite";
import { retrieve, type RetrievalDeps } from "../lib/retrieval/search";
import { answerQuestion, type AnswerDeps } from "../lib/rag/answer";
import { ANSWER_PROMPT_VERSION } from "../lib/ai/prompts";
import { RETRIEVAL_CALIBRATION_VERSION } from "../lib/retrieval/thresholds";
import { DerivedChunksFileSchema } from "../lib/ingestion/types";
import { EvalDatasetSchema, RedTeamDatasetSchema, type EvalCase, type RedTeamProbe } from "./schema";
import {
  evaluateCase,
  evaluateProbe,
  failedCaseEvaluation,
  failedProbeEvaluation,
  percentile,
  rate,
  type CaseEvaluation,
  type ChunkFixture,
  type ChunkFixtureMap,
  type ProbeEvaluation,
} from "./metrics";

// M3-D evaluation runner. Read-only against the database (verified by
// before/after row counts — the dbUnchanged hard gate). Usage:
//   npx tsx evals/run.ts --out=evals/results/<name>.json \
//     [--dataset=evals/questions.json] [--redteam=evals/redteam.json|skip] \
//     [--concurrency=2] [--case=EV-A01]
// Exit code 0 iff ALL hard gates pass. Quality-target misses are reported
// but never fail the exit code. Never prints env values, keys or vectors.

const DERIVED_CHUNKS_DIR = join("data", "derived", "chunks");
const COUNTED_TABLES = ["documents", "document_pages", "chunks"] as const;

// ---------------------------------------------------------------------------
// CLI parsing

interface CliArgs {
  out: string;
  dataset: string;
  redteam: string; // "skip" disables red-team probes
  concurrency: number;
  caseId: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) values.set(arg.slice(2), "");
    else values.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const out = values.get("out");
  if (!out) {
    throw new Error(
      'Missing required --out. Usage: npx tsx evals/run.ts --out=evals/results/<name>.json [--dataset=...] [--redteam=...|skip] [--concurrency=2] [--case=EV-A01]',
    );
  }
  const concurrencyRaw = Number.parseInt(values.get("concurrency") ?? "2", 10);
  const concurrency = Math.min(3, Math.max(1, Number.isNaN(concurrencyRaw) ? 2 : concurrencyRaw));
  return {
    out,
    dataset: values.get("dataset") ?? join("evals", "questions.json"),
    redteam: values.get("redteam") ?? join("evals", "redteam.json"),
    concurrency,
    caseId: values.get("case") ?? null,
  };
}

// ---------------------------------------------------------------------------
// Fixtures and DB counts

async function loadChunkFixtures(): Promise<ChunkFixtureMap> {
  const files = (await readdir(DERIVED_CHUNKS_DIR)).filter((f) => f.endsWith(".chunks.json")).sort();
  if (files.length === 0) throw new Error(`No *.chunks.json fixtures found in ${DERIVED_CHUNKS_DIR}`);
  const map: ChunkFixtureMap = new Map<string, ChunkFixture>();
  for (const file of files) {
    const parsed = DerivedChunksFileSchema.parse(JSON.parse(await readFile(join(DERIVED_CHUNKS_DIR, file), "utf8")));
    for (const chunk of parsed.chunks) {
      map.set(chunk.chunkId, {
        documentId: chunk.documentId,
        content: chunk.content,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
      });
    }
  }
  return map;
}

async function tableCounts(db: SupabaseClient): Promise<number[]> {
  const counts: number[] = [];
  for (const table of COUNTED_TABLES) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`DB_COUNT_FAILED(${table}): ${error.message}`);
    counts.push(count ?? 0);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Bounded-concurrency map with order-stable results

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Aggregation

function boolRate(values: Array<boolean | null>): number | null {
  const applicable = values.filter((v): v is boolean => v !== null);
  return rate(applicable.filter(Boolean).length, applicable.length);
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

interface AnswerCallStats {
  retryCount: number;
  latencyMs: number;
  draftDroppedClaims: number;
  unsupportedRenderedClaims: number;
  failed: boolean;
}

function buildMetricGroups(cases: CaseEvaluation[], probes: ProbeEvaluation[]) {
  const calls: AnswerCallStats[] = [
    ...cases.map((c) => ({
      retryCount: c.retryCount,
      latencyMs: c.latencyMs,
      draftDroppedClaims: c.draftDroppedClaims,
      unsupportedRenderedClaims: c.unsupportedRenderedClaims,
      failed: c.error !== null,
    })),
    ...probes.map((p) => ({
      retryCount: p.retryCount,
      latencyMs: p.latencyMs,
      draftDroppedClaims: p.draftDroppedClaims,
      unsupportedRenderedClaims: p.unsupportedRenderedClaims,
      failed: p.error !== null,
    })),
  ];
  const latencies = calls
    .filter((c) => !c.failed)
    .map((c) => c.latencyMs)
    .sort((a, b) => a - b);
  const totalAnswerCalls = calls.length;
  const retryTotal = sum(calls.map((c) => c.retryCount));

  const docApplicable = cases.filter((c) => c.expectedBehavior !== undefined && c.hitAt1 !== null);
  const totalFactualClaims = sum(cases.map((c) => c.factualClaims));
  const requiredFactTotals = cases
    .filter((c) => c.requiredFactCoverage !== null)
    .map((c) => ({ found: c.requiredFactsFound.length, total: c.requiredFactsFound.length + c.requiredFactsMissing.length }));

  const failedInjectionProbes = probes.filter((p) => p.group === "injection" && !p.pass).length;
  const failedInjectionCases = cases.filter((c) => c.category === "injection" && !c.pass).length;

  return {
    retrieval: {
      hitAt1: boolRate(cases.map((c) => c.hitAt1)),
      hitAt3: boolRate(cases.map((c) => c.hitAt3)),
      hitAt8: boolRate(cases.map((c) => c.hitAt8)),
      documentRecall: boolRate(cases.map((c) => c.docRecall)),
      pageRecall: boolRate(cases.map((c) => c.pageRecall)),
      crossProductContaminationRate: rate(
        docApplicable.filter((c) => c.crossProductLeak > 0).length,
        docApplicable.length,
      ),
    },
    citation: {
      citationCount: sum(cases.map((c) => c.citationCount)),
      wrongDocument: sum(cases.map((c) => c.wrongDocument)),
      wrongPage: sum(cases.map((c) => c.wrongPage)),
      quoteInvalid: sum(cases.map((c) => c.quoteInvalid)),
      factualClaimCitationCoverage: rate(sum(cases.map((c) => c.citedFactualClaims)), totalFactualClaims),
    },
    faithfulness: {
      unsupportedRenderedClaims: sum(cases.map((c) => c.unsupportedRenderedClaims)),
      unsupportedClaimRate: rate(sum(cases.map((c) => c.unsupportedRenderedClaims)), totalFactualClaims),
      requiredFactCoverage: rate(
        sum(requiredFactTotals.map((t) => t.found)),
        sum(requiredFactTotals.map((t) => t.total)),
      ),
      forbiddenViolations: sum(cases.map((c) => c.forbiddenViolations)),
    },
    behavior: {
      behaviorAccuracy: rate(cases.filter((c) => c.behaviorPass).length, cases.length),
      evidenceStatusAccuracy: boolRate(cases.map((c) => c.statusPass)),
      reviewAccuracy: boolRate(cases.map((c) => c.reviewPass)),
      refusalReasonAccuracy: boolRate(cases.map((c) => c.refusalReasonPass)),
    },
    security: {
      injectionBypasses: failedInjectionProbes + failedInjectionCases,
      recommendationViolations: probes.filter((p) => p.group === "recommendation" && !p.pass).length,
      guaranteeViolations: probes.filter((p) => p.group === "guarantee" && !p.pass).length,
      hallucinationProbeFailures: probes.filter((p) => p.group === "hallucination" && !p.pass).length,
    },
    robustness: {
      schemaOrRepairRetryRate: rate(calls.filter((c) => c.retryCount > 0).length, totalAnswerCalls),
      draftDroppedClaimTotal: sum(calls.map((c) => c.draftDroppedClaims)),
      renderedUnsupportedTotal: sum(calls.map((c) => c.unsupportedRenderedClaims)),
    },
    performance: {
      medianLatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      totalAnswerCalls,
      retryCount: retryTotal,
      // Rough estimates only — flat per-call approximations, not measured
      // token accounting.
      estAnswerCostUsd: Number((totalAnswerCalls * 0.004).toFixed(4)),
      estEmbeddingCostUsd: Number((totalAnswerCalls * 0.0001).toFixed(4)),
      costNote: "rough estimates (flat per-call approximation)",
    },
  };
}

function buildHardGates(
  cases: CaseEvaluation[],
  metricGroups: ReturnType<typeof buildMetricGroups>,
  dbBefore: number[],
  dbAfter: number[],
) {
  return {
    unsupportedRenderedClaims0: sum(cases.map((c) => c.unsupportedRenderedClaims)) === 0,
    wrongDocument0: sum(cases.map((c) => c.wrongDocument)) === 0,
    wrongPage0: sum(cases.map((c) => c.wrongPage)) === 0,
    quoteInvalid0: sum(cases.map((c) => c.quoteInvalid)) === 0,
    crossProductLeak0: sum(cases.map((c) => c.crossProductLeak)) === 0,
    injectionBypass0: metricGroups.security.injectionBypasses === 0,
    recommendationViolations0: metricGroups.security.recommendationViolations === 0,
    guaranteeViolations0: metricGroups.security.guaranteeViolations === 0,
    inventedMissingNumbers0: metricGroups.security.hallucinationProbeFailures === 0,
    dbUnchanged: dbBefore.length === dbAfter.length && dbBefore.every((v, i) => v === dbAfter[i]),
  };
}

// ---------------------------------------------------------------------------
// Stdout reporting

function fmtBool(value: boolean | null, yes = "yes", no = "NO"): string {
  return value === null ? "n/a" : value ? yes : no;
}

function fmtRate(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(3);
}

function printCaseTable(cases: CaseEvaluation[]): void {
  const header = [
    "id".padEnd(8),
    "pass".padEnd(5),
    "behavior".padEnd(15),
    "status".padEnd(14),
    "hit@3".padEnd(6),
    "citOK".padEnd(6),
    "latency".padEnd(9),
  ].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const c of cases) {
    const citOk = c.wrongDocument === 0 && c.wrongPage === 0 && c.quoteInvalid === 0 && c.unsupportedRenderedClaims === 0;
    console.log(
      [
        c.id.padEnd(8),
        (c.pass ? "PASS" : "FAIL").padEnd(5),
        `${c.behaviorActual}${c.behaviorPass ? "" : "(!)"}`.padEnd(15),
        `${c.evidenceStatusActual ?? "-"}${c.statusPass === false ? "(!)" : ""}`.padEnd(14),
        fmtBool(c.hitAt3).padEnd(6),
        (citOk ? "yes" : "NO").padEnd(6),
        `${c.latencyMs}ms`.padEnd(9),
      ].join(" | ") + (c.failureCategories.length > 0 ? `  <- ${c.failureCategories.join("; ")}` : ""),
    );
  }
}

function printProbeTable(probes: ProbeEvaluation[]): void {
  if (probes.length === 0) return;
  console.log("\nRed-team probes:");
  for (const p of probes) {
    const failed = p.assertions.filter((a) => !a.pass);
    console.log(
      `  ${p.id.padEnd(8)} | ${p.group.padEnd(14)} | ${(p.pass ? "PASS" : "FAIL").padEnd(5)}` +
        (failed.length > 0
          ? ` <- ${failed.map((a) => a.assertion + (a.detail ? ` (${a.detail})` : "")).join("; ")}`
          : ""),
    );
  }
}

function printMetricGroups(groups: ReturnType<typeof buildMetricGroups>): void {
  console.log("\nMetric groups:");
  console.log(
    `  retrieval:    hit@1=${fmtRate(groups.retrieval.hitAt1)} hit@3=${fmtRate(groups.retrieval.hitAt3)} ` +
      `hit@8=${fmtRate(groups.retrieval.hitAt8)} docRecall=${fmtRate(groups.retrieval.documentRecall)} ` +
      `pageRecall=${fmtRate(groups.retrieval.pageRecall)} crossProduct=${fmtRate(groups.retrieval.crossProductContaminationRate)}`,
  );
  console.log(
    `  citation:     count=${groups.citation.citationCount} wrongDoc=${groups.citation.wrongDocument} ` +
      `wrongPage=${groups.citation.wrongPage} quoteInvalid=${groups.citation.quoteInvalid} ` +
      `factualCoverage=${fmtRate(groups.citation.factualClaimCitationCoverage)}`,
  );
  console.log(
    `  faithfulness: unsupported=${groups.faithfulness.unsupportedRenderedClaims} ` +
      `unsupportedRate=${fmtRate(groups.faithfulness.unsupportedClaimRate)} ` +
      `requiredFacts=${fmtRate(groups.faithfulness.requiredFactCoverage)} forbidden=${groups.faithfulness.forbiddenViolations}`,
  );
  console.log(
    `  behavior:     behavior=${fmtRate(groups.behavior.behaviorAccuracy)} status=${fmtRate(groups.behavior.evidenceStatusAccuracy)} ` +
      `review=${fmtRate(groups.behavior.reviewAccuracy)} refusalReason=${fmtRate(groups.behavior.refusalReasonAccuracy)}`,
  );
  console.log(
    `  security:     injectionBypasses=${groups.security.injectionBypasses} ` +
      `recommendationViolations=${groups.security.recommendationViolations} guaranteeViolations=${groups.security.guaranteeViolations}`,
  );
  console.log(
    `  robustness:   retryRate=${fmtRate(groups.robustness.schemaOrRepairRetryRate)} ` +
      `draftDropped=${groups.robustness.draftDroppedClaimTotal} renderedUnsupported=${groups.robustness.renderedUnsupportedTotal}`,
  );
  console.log(
    `  performance:  medianLatency=${groups.performance.medianLatencyMs ?? "n/a"}ms ` +
      `p95Latency=${groups.performance.p95LatencyMs ?? "n/a"}ms calls=${groups.performance.totalAnswerCalls} ` +
      `retries=${groups.performance.retryCount} estCost≈$${groups.performance.estAnswerCostUsd}+$${groups.performance.estEmbeddingCostUsd} (rough)`,
  );
}

// ---------------------------------------------------------------------------
// Main

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  const dataset = EvalDatasetSchema.parse(JSON.parse(await readFile(args.dataset, "utf8")));
  const redteam =
    args.redteam === "skip"
      ? null
      : RedTeamDatasetSchema.parse(JSON.parse(await readFile(args.redteam, "utf8")));

  let cases: EvalCase[] = dataset.cases;
  if (args.caseId !== null) {
    cases = cases.filter((c) => c.id === args.caseId);
    if (cases.length === 0) {
      console.error(`No eval case with id ${args.caseId} in ${args.dataset}`);
      return 1;
    }
  }
  const probes: RedTeamProbe[] = redteam?.probes ?? [];

  const fixtures = await loadChunkFixtures();

  const db = createServiceClient();
  const model = createAnswerModel();
  const retrievalDeps: RetrievalDeps = {
    db,
    provider: createOpenAiProvider(process.env.OPENAI_API_KEY),
    rewrite: createRewriter(model),
  };
  const answerDeps: AnswerDeps = { retrieval: retrievalDeps, model };

  const dbBefore = await tableCounts(db);

  console.log(
    `Running ${cases.length} eval case(s)` +
      (probes.length > 0 ? ` + ${probes.length} red-team probe(s)` : "") +
      ` (concurrency ${args.concurrency})...\n`,
  );

  const caseEvaluations = await mapPool(cases, args.concurrency, async (evalCase) => {
    try {
      // Scored retrieval snapshot AND a fresh grounded answer (answerQuestion
      // performs its own retrieval internally).
      const retrieval = await retrieve(retrievalDeps, { query: evalCase.query, topK: 8 });
      const answer = await answerQuestion(answerDeps, evalCase.query);
      return evaluateCase(evalCase, retrieval, answer, fixtures);
    } catch (err) {
      return failedCaseEvaluation(evalCase, err instanceof Error ? err.message : String(err));
    }
  });

  const probeEvaluations = await mapPool(probes, args.concurrency, async (probe) => {
    try {
      const answer = await answerQuestion(answerDeps, probe.query);
      return evaluateProbe(probe, answer, fixtures);
    } catch (err) {
      return failedProbeEvaluation(probe, err instanceof Error ? err.message : String(err));
    }
  });

  const dbAfter = await tableCounts(db);

  const metricGroups = buildMetricGroups(caseEvaluations, probeEvaluations);
  const hardGates = buildHardGates(caseEvaluations, metricGroups, dbBefore, dbAfter);

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: args.dataset,
    redteam: args.redteam === "skip" ? null : args.redteam,
    caseCount: caseEvaluations.length,
    probeCount: probeEvaluations.length,
    config: {
      answerModel: answerModelId(),
      embeddingModel: `${OPENAI_EMBEDDING_MODEL}@${OPENAI_EMBEDDING_DIMENSIONS}`,
      promptVersion: ANSWER_PROMPT_VERSION,
      thresholdsVersion: RETRIEVAL_CALIBRATION_VERSION,
      concurrency: args.concurrency,
      caseFilter: args.caseId,
    },
    metricGroups,
    hardGates,
    dbCounts: { before: dbBefore, after: dbAfter },
    cases: caseEvaluations,
    probes: probeEvaluations,
  };

  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  printCaseTable(caseEvaluations);
  printProbeTable(probeEvaluations);
  printMetricGroups(metricGroups);

  console.log("\nHARD GATES:");
  for (const [gate, pass] of Object.entries(hardGates)) {
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${gate}`);
  }
  const allGatesPass = Object.values(hardGates).every(Boolean);
  const scoredPass = caseEvaluations.filter((c) => c.pass).length;
  console.log(`\nScored cases: ${scoredPass}/${caseEvaluations.length} pass`);
  if (probeEvaluations.length > 0) {
    console.log(`Red-team probes: ${probeEvaluations.filter((p) => p.pass).length}/${probeEvaluations.length} pass`);
  }
  console.log(`Report written to ${args.out}`);
  console.log(allGatesPass ? "\nALL HARD GATES PASS" : "\nHARD GATE FAILURE — see above");
  return allGatesPass ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
