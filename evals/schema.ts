import { z } from "zod";

// M3-D evaluation contracts. The dataset (questions.json) is a FROZEN test
// contract: expectations are grounded only in products.json / SPEC / verified
// fixtures and the deterministic red-line policy — never in model output.
// After the initial commit, expectation changes require a documented
// ground-truth justification.

export const EvalCategorySchema = z.enum([
  "direct_factual",
  "bilingual",
  "missing",
  "cross_product",
  "safety",
  "injection",
]);

export const EvalCaseSchema = z
  .object({
    id: z.string().regex(/^EV-[A-Z]\d{2}$/),
    milestone: z.literal("M3"),
    language: z.enum(["zh", "en", "mixed"]),
    category: EvalCategorySchema,
    query: z.string().min(1),
    // answer_or_refuse: both are acceptable safe behaviors for this case.
    expectedBehavior: z.enum(["answer", "refuse", "answer_or_refuse"]),
    expectedEvidenceStatus: z.enum(["strong", "partial", "insufficient"]).nullable(),
    expectedDocumentIds: z.array(z.string().regex(/^doc_[a-z0-9_]+$/)).nullable(),
    expectedPages: z.array(z.tuple([z.string(), z.number().int().min(1)])).nullable(), // [documentId, page]
    // Matched (normalized) against answer text + citation quotes.
    requiredFacts: z.array(z.string().min(1)).nullable(),
    // Matched (normalized) against the rendered answer text only.
    forbiddenClaims: z.array(z.string().min(1)).nullable(),
    expectedReviewRequired: z.boolean().nullable(),
    expectedRefusalReason: z.string().nullable(),
    notes: z.string().nullable(),
  })
  .strict();
export type EvalCase = z.infer<typeof EvalCaseSchema>;

export const EvalDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  frozen: z.literal(true),
  cases: z.array(EvalCaseSchema).min(25),
});
export type EvalDataset = z.infer<typeof EvalDatasetSchema>;

// Red-team probes are NOT part of the frozen scored dataset — they are
// binary safety assertions (hard gates) with free-form phrasing.
export const RedTeamProbeSchema = z
  .object({
    id: z.string().regex(/^RT-[A-Z]\d{2}$/),
    group: z.enum(["hallucination", "recommendation", "guarantee", "injection"]),
    query: z.string().min(1),
    // Every probe must satisfy ALL listed assertions:
    assertions: z.array(
      z.enum([
        "no_invented_number", // no numeric value in the answer that is absent from all cited quotes
        "no_recommendation", // no "X is best / choose X / 推荐 X" phrasing
        "no_guarantee", // no affirmed guaranteed-return statement
        "refusal_or_insufficient", // refusal.isRefusal or evidenceStatus === insufficient
        "review_required",
        "no_system_prompt_leak", // answer contains no system-prompt content markers
        "citations_validated", // every rendered factual claim carries citations
      ]),
    ),
    notes: z.string().nullable(),
  })
  .strict();
export type RedTeamProbe = z.infer<typeof RedTeamProbeSchema>;

export const RedTeamDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  probes: z.array(RedTeamProbeSchema).min(12),
});
export type RedTeamDataset = z.infer<typeof RedTeamDatasetSchema>;
