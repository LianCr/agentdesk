import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Aggregates repeated frozen-evaluation runs (M3-D.1 protocol): hard gates
// must pass in EVERY run (never averaged); stochastic quality metrics are
// reported as run-1/run-2/run-3 plus min/median/max. Usage:
//   npx tsx evals/summarize-runs.ts evals/results/m3-final-run-1.json ...

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const paths = process.argv.slice(2);
if (paths.length < 2) {
  console.error("Usage: summarize-runs <run1.json> <run2.json> [run3.json ...]");
  process.exit(1);
}

interface RunReport {
  generatedAt: string;
  hardGates: Record<string, boolean>;
  metricGroups: Record<string, Record<string, number | null | string>>;
  cases: Array<{ pass: boolean }>;
  probes: Array<{ pass: boolean }>;
  dbCounts: { before: number[]; after: number[] };
}

const runs: RunReport[] = paths.map((p) => JSON.parse(readFileSync(join(ROOT, p), "utf8")));

const QUALITY_METRICS: Array<[string, string, string]> = [
  ["retrieval", "hitAt1", "retrieval hit@1"],
  ["retrieval", "hitAt3", "retrieval hit@3"],
  ["retrieval", "documentRecall", "expected-document recall"],
  ["retrieval", "pageRecall", "expected-page recall"],
  ["behavior", "evidenceStatusAccuracy", "evidence-status accuracy"],
  ["behavior", "behaviorAccuracy", "behavior/refusal accuracy"],
  ["behavior", "reviewAccuracy", "review-required accuracy"],
  ["faithfulness", "requiredFactCoverage", "required-fact coverage"],
  ["robustness", "schemaOrRepairRetryRate", "quote/schema repair retry rate"],
  ["citation", "factualClaimCitationCoverage", "factual-claim citation coverage"],
];
const LATENCY_METRICS: Array<[string, string, string]> = [
  ["performance", "medianLatencyMs", "median latency (ms)"],
  ["performance", "p95LatencyMs", "p95 latency (ms)"],
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

console.log("## Hard gates (must pass in EVERY run — never averaged)\n");
const gateNames = Object.keys(runs[0]!.hardGates);
let allGatesAllRuns = true;
for (const gate of gateNames) {
  const results = runs.map((r) => r.hardGates[gate] === true);
  if (!results.every(Boolean)) allGatesAllRuns = false;
  console.log(`${gate.padEnd(30)} ${results.map((v) => (v ? "PASS" : "FAIL")).join("  ")}`);
}
console.log(`\nALL HARD GATES, ALL RUNS: ${allGatesAllRuns ? "PASS" : "FAIL"}`);

console.log("\n## Scored cases / probes per run\n");
runs.forEach((r, i) => {
  console.log(
    `run ${i + 1}: cases ${r.cases.filter((c) => c.pass).length}/${r.cases.length}, ` +
      `probes ${r.probes.filter((p) => p.pass).length}/${r.probes.length}, ` +
      `db ${r.dbCounts.before.join("/")} -> ${r.dbCounts.after.join("/")}, at ${r.generatedAt}`,
  );
});

console.log("\n## Quality metric distribution (run1 | run2 | run3 | min | median | max)\n");
const pct = (v: number | null): string => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
for (const [group, key, label] of QUALITY_METRICS) {
  const values = runs.map((r) => r.metricGroups[group]?.[key] as number | null);
  if (values.some((v) => typeof v !== "number")) {
    console.log(`${label.padEnd(34)} ${values.map(pct).join(" | ")}`);
    continue;
  }
  const nums = values as number[];
  console.log(
    `${label.padEnd(34)} ${nums.map(pct).join(" | ")} | min ${pct(Math.min(...nums))} | med ${pct(median(nums))} | max ${pct(Math.max(...nums))}`,
  );
}
for (const [group, key, label] of LATENCY_METRICS) {
  const nums = runs.map((r) => r.metricGroups[group]?.[key] as number);
  console.log(
    `${label.padEnd(34)} ${nums.map((n) => String(Math.round(n))).join(" | ")} | min ${Math.round(Math.min(...nums))} | med ${Math.round(median(nums))} | max ${Math.round(Math.max(...nums))}`,
  );
}
const drops = runs.map((r) => r.metricGroups.robustness?.draftDroppedClaimTotal as number);
console.log(`${"draft-claim drops (defense-in-depth)".padEnd(34)} ${drops.join(" | ")}`);

process.exit(allGatesAllRuns ? 0 : 1);
