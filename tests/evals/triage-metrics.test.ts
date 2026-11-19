import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { TriageCaseFileSchema, scoreTriage, type TriageCase } from "../../evals/triage-metrics";
import { loadTriageCorpus, type TriageCorpus } from "../../lib/support/kb";
import { triageTicket } from "../../lib/support/triage";

// Mutation tests: the triage eval must be able to fail.

let corpus: TriageCorpus;
let cases: TriageCase[];
beforeAll(async () => {
  corpus = await loadTriageCorpus(process.cwd());
  cases = TriageCaseFileSchema.parse(JSON.parse(readFileSync("evals/triage-cases.json", "utf8"))).cases;
});

describe("triage eval", () => {
  it("passes on the real triage", () => {
    expect(scoreTriage(cases, triageTicket, corpus).passed).toBe(true);
  });

  it("catches a router that auto-drafts everything", () => {
    const report = scoreTriage(cases, (i, c) => ({ ...triageTicket(i, c), route: "draft_ready" }), corpus);
    expect(report.passed).toBe(false);
    expect(report.hardGates.human_only_auto_routed).toBeGreaterThan(0);
    expect(report.hardGates.route_mismatch).toBeGreaterThan(0);
  });

  it("catches a paraphrased quote and a draft written despite a red line", () => {
    const report = scoreTriage(
      cases,
      (i, c) => {
        const r = triageTicket(i, c);
        const draft = { text: "x", citations: [{ citationId: "c1", sourceType: "help_article" as const, sourceId: "kb_login", chunkId: "kb_login:s01", title: "t", page: null, quote: "Paraphrased, not verbatim.", url: null }] };
        return { ...r, draft };
      },
      corpus,
    );
    expect(report.hardGates.non_verbatim_quote).toBe(cases.length);
    expect(report.hardGates.redline_drafted).toBeGreaterThan(0);
  });
});
