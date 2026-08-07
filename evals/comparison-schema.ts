import { z } from "zod";
import { DIMENSION_IDS } from "../lib/comparison/dimensions";
import { MISSING_INFO_FIELDS, OBSERVATION_TYPES, REVIEW_FLAGS } from "../lib/comparison/types";

// Frozen M4-D comparison evaluation contract.
//
// Expectations are STRUCTURED, not prose: a case states which availability a
// cell must have, which structured value it must carry, which document and
// page must back it, and which observations and flags must appear. Nothing is
// asserted about wording the engine happens to produce today, so a rendering
// change cannot silently rewrite the ground truth — and a fact change cannot
// silently pass.
//
// Every expected value is grounded in products.json, the committed derived
// chunks, the M4-A fact rules or the synthetic-case fixtures. None of it is
// read back from current output.

const DocumentIdSchema = z.string().regex(/^doc_[a-z0-9_]+$/);

export const ExpectedCellSchema = z
  .object({
    dimensionId: z.enum(DIMENSION_IDS),
    // Which column: "a" or "b" as the case declares them.
    side: z.enum(["a", "b"]),
    availability: z.enum(["available", "not_applicable", "not_provided", "conflict"]),
    sourceKind: z.enum(["direct", "derived"]).optional(),
    // Structured value the cell must carry. Scalars compare semantically;
    // objects compare key-by-key against the cell's fact-path map.
    rawValue: z.unknown().optional(),
    // Substrings the rendered value MUST contain (units included, so "9.50%"
    // never satisfies an expectation of "9.50 years").
    displayIncludes: z.array(z.string().min(1)).optional(),
    // Substrings that must NOT appear — used to pin the negative-vs-absent
    // distinction and the derived-fact wording.
    displayExcludes: z.array(z.string().min(1)).optional(),
    // Every citation on this cell must belong to this document, and the set of
    // cited pages must equal this list when given.
    citationDocumentId: DocumentIdSchema.optional(),
    citationPages: z.array(z.number().int().positive()).optional(),
    // At least one citation quote must contain each of these.
    citationQuoteIncludes: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type ExpectedCell = z.infer<typeof ExpectedCellSchema>;

export const ExpectedObservationSchema = z
  .object({
    type: z.enum(OBSERVATION_TYPES),
    severity: z.enum(["informational", "review_note"]).optional(),
    // Which product's facts the observation must be built from.
    factProductIds: z.array(DocumentIdSchema).optional(),
    factDimensionIds: z.array(z.enum(DIMENSION_IDS)).optional(),
    minimumCitations: z.number().int().min(1).optional(),
    textIncludes: z.array(z.string().min(1)).optional(),
    textExcludes: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type ExpectedObservation = z.infer<typeof ExpectedObservationSchema>;

export const ComparisonCaseSchema = z
  .object({
    id: z.string().regex(/^CMP-[A-Z]\d{2}$/),
    milestone: z.literal("M4"),
    category: z.enum([
      "pair_coverage",
      "symmetry",
      "client_context",
      "fact_state",
      "numeric",
      "observation",
      "boundary",
    ]),
    productAId: DocumentIdSchema,
    productBId: DocumentIdSchema,
    clientCaseId: z.string().min(1).nullable(),
    expectedStatus: z.enum(["complete", "partial", "blocked"]),
    // The full ordered dimension list must always be present; a case may state
    // it explicitly to pin ordering.
    expectedDimensionIds: z.array(z.enum(DIMENSION_IDS)).nullable(),
    expectedCells: z.array(ExpectedCellSchema),
    expectedObservations: z.array(ExpectedObservationSchema),
    // Observation types that must NOT be produced for this pair.
    forbiddenObservations: z.array(z.enum(OBSERVATION_TYPES)),
    expectedMissingClientInfo: z.array(z.enum(MISSING_INFO_FIELDS)).nullable(),
    forbiddenMissingClientInfo: z.array(z.enum(MISSING_INFO_FIELDS)),
    expectedReviewReasons: z.array(z.enum(REVIEW_FLAGS)),
    forbiddenReviewReasons: z.array(z.enum(REVIEW_FLAGS)),
    // Statements that must never appear anywhere in the rendered draft.
    forbiddenText: z.array(z.string().min(1)),
    expectedReplacementContext: z.boolean().nullable(),
    // Cases sharing a symmetryGroup must agree under product-order reversal.
    symmetryGroup: z.string().min(1).nullable(),
    notes: z.string().min(1).nullable(),
  })
  .strict();
export type ComparisonCase = z.infer<typeof ComparisonCaseSchema>;

export const ComparisonDatasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    frozen: z.literal(true),
    cases: z.array(ComparisonCaseSchema).min(20),
  })
  .strict();
export type ComparisonDataset = z.infer<typeof ComparisonDatasetSchema>;
