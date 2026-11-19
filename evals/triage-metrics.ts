import { z } from "zod";
import type { TriageCorpus } from "../lib/support/kb";
import { verifyDraftQuotes } from "../lib/support/triage";
import {
  TicketCategorySchema,
  TicketPrioritySchema,
  TriageResultSchema,
  TriageRouteSchema,
  type TriageResult,
} from "../lib/support/types";
import { canonicalJson } from "../lib/reviews/types";

// Scoring for the frozen triage eval. Pure: takes the triage function as an
// argument so mutation tests can hand it a broken router and prove the gates
// fail (tests/evals/triage-metrics.test.ts).

export const TriageCaseFileSchema = z.object({
  schemaVersion: z.literal(1),
  synthetic: z.literal(true),
  notice: z.string().min(1),
  cases: z
    .array(
      z.object({
        caseId: z.string().regex(/^T\d{2}$/),
        subject: z.string().min(1),
        body: z.string().min(1),
        expected: z.object({
          category: TicketCategorySchema,
          priority: TicketPrioritySchema,
          route: TriageRouteSchema,
        }),
      }),
    )
    .min(1),
});
export type TriageCase = z.infer<typeof TriageCaseFileSchema>["cases"][number];

/** Every gate must be exactly 0. */
export const TRIAGE_HARD_GATES = [
  "schema_invalid",
  "nondeterministic",
  "route_mismatch",
  "priority_mismatch",
  "redline_drafted",
  "human_only_auto_routed",
  "draft_ready_below_high_match",
  "non_verbatim_quote",
] as const;
export type TriageHardGate = (typeof TRIAGE_HARD_GATES)[number];

const AUTO_OK_CATEGORIES = new Set(["how_to", "product_question"]);

export interface TriageCaseResult {
  caseId: string;
  expected: TriageCase["expected"];
  actual: { category: string; priority: string; route: string; matchLevel: string; topScore: number; coverage: number };
  failures: TriageHardGate[];
  categoryCorrect: boolean;
}

export interface TriageEvalReport {
  cases: number;
  hardGates: Record<TriageHardGate, number>;
  categoryAccuracy: number;
  results: TriageCaseResult[];
  passed: boolean;
}

export function scoreTriage(
  cases: TriageCase[],
  triage: (input: { subject: string; body: string }, corpus: TriageCorpus) => TriageResult,
  corpus: TriageCorpus,
): TriageEvalReport {
  const gates = Object.fromEntries(TRIAGE_HARD_GATES.map((g) => [g, 0])) as Record<TriageHardGate, number>;
  const results: TriageCaseResult[] = [];
  for (const c of cases) {
    const failures: TriageHardGate[] = [];
    const r = triage(c, corpus);
    if (!TriageResultSchema.safeParse(r).success) failures.push("schema_invalid");
    if (canonicalJson(triage(c, corpus)) !== canonicalJson(r)) failures.push("nondeterministic");
    if (r.route !== c.expected.route) failures.push("route_mismatch");
    if (r.priority !== c.expected.priority) failures.push("priority_mismatch");
    if (r.redline.hard && r.draft !== null) failures.push("redline_drafted");
    if (r.route === "draft_ready" && (!AUTO_OK_CATEGORIES.has(r.category) || r.priority === "P1" || r.priority === "P2" || r.redline.hard))
      failures.push("human_only_auto_routed");
    if (r.route === "draft_ready" && (r.match.level !== "high" || r.draft === null)) failures.push("draft_ready_below_high_match");
    if (verifyDraftQuotes(r, corpus).length > 0) failures.push("non_verbatim_quote");
    for (const f of failures) gates[f] += 1;
    results.push({
      caseId: c.caseId,
      expected: c.expected,
      actual: {
        category: r.category,
        priority: r.priority,
        route: r.route,
        matchLevel: r.match.level,
        topScore: r.match.topScore,
        coverage: r.match.coverage,
      },
      failures,
      categoryCorrect: r.category === c.expected.category,
    });
  }
  const correct = results.filter((r) => r.categoryCorrect).length;
  return {
    cases: cases.length,
    hardGates: gates,
    categoryAccuracy: cases.length ? Math.round((correct / cases.length) * 1000) / 1000 : 0,
    results,
    passed: Object.values(gates).every((v) => v === 0),
  };
}
