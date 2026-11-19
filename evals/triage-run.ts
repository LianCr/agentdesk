import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadTriageCorpus } from "../lib/support/kb";
import { TRIAGE_RULES_VERSION, triageTicket } from "../lib/support/triage";
import { TRIAGE_HARD_GATES, TriageCaseFileSchema, scoreTriage } from "./triage-metrics";

// M9 support-triage eval. Deterministic: no model, no database, no network.
// It gates CI (job "checks"). The cases are SYNTHETIC and were written with
// the rules, so this proves the safety invariants and pins behaviour against
// regressions — it is not a measure of accuracy on real tickets.
//
//   npm run eval:triage -- --out=evals/results/triage.json

const ROOT = process.cwd();

async function main(): Promise<number> {
  const file = TriageCaseFileSchema.parse(JSON.parse(await readFile(join(ROOT, "evals/triage-cases.json"), "utf8")));
  const corpus = await loadTriageCorpus(ROOT);
  const report = scoreTriage(file.cases, triageTicket, corpus);

  console.log(`Support triage eval — ${report.cases} frozen synthetic tickets, rules v${TRIAGE_RULES_VERSION}`);
  console.log(`Corpus: ${corpus.passages.size} passages (product guides + synthetic help center)\n`);
  for (const r of report.results) {
    const mark = r.failures.length ? "FAIL" : "ok  ";
    console.log(
      `${mark} ${r.caseId} ${r.actual.category.padEnd(16)} ${r.actual.priority} ${r.actual.route.padEnd(11)} match=${r.actual.matchLevel} score=${r.actual.topScore} cov=${r.actual.coverage}${r.failures.length ? `  ← ${r.failures.join(", ")}` : ""}${r.categoryCorrect ? "" : `  (category expected ${r.expected.category})`}`,
    );
  }
  console.log(`\nHard gates (${TRIAGE_HARD_GATES.length}, each must be 0):`);
  for (const g of TRIAGE_HARD_GATES) console.log(`  ${report.hardGates[g] === 0 ? "PASS" : "FAIL"} ${g} = ${report.hardGates[g]}`);
  console.log(`\nCategory accuracy (reported, not gated): ${report.categoryAccuracy}`);
  console.log(report.passed ? "\nRESULT: PASS" : "\nRESULT: FAIL");

  const out = process.argv.find((a) => a.startsWith("--out="))?.slice("--out=".length);
  if (out) {
    await mkdir(dirname(join(ROOT, out)), { recursive: true });
    await writeFile(join(ROOT, out), JSON.stringify({ rulesVersion: TRIAGE_RULES_VERSION, ...report }, null, 2) + "\n");
  }
  return report.passed ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
