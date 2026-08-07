import { z } from "zod";
import { CitationSchema } from "../rag/types";
import { ProductCategorySchema } from "../schemas";
import { DIMENSION_IDS } from "./dimensions";

// M4-A comparison contracts.
//
// Architecture rule (mirrors M3): comparison facts are code-owned. A model
// never produces availability, displayValue, rawValue, sourceKind,
// documentId, chunkId, page or citationId. The optional narrative added in
// M4-B may only restate what these structures already assert.

export const DimensionIdSchema = z.enum(DIMENSION_IDS);

// Four outcomes that must never collapse into one another:
//   available      — the documents state this fact. The value may itself be
//                    `false` ("this product does not offer optional riders")
//                    or `0`; those are facts and still require a citation.
//   not_applicable — the concept does not exist for this contract type.
//   not_provided   — the demo materials do not state it.
//   conflict       — structured value and document evidence disagree, or the
//                    evidence could not be located unambiguously. Fail closed:
//                    never rendered as a fact.
export const AvailabilitySchema = z.enum(["available", "not_applicable", "not_provided", "conflict"]);
export type Availability = z.infer<typeof AvailabilitySchema>;

export const ValueFormatSchema = z.enum([
  "text",
  "textList",
  "number",
  "percent",
  "currency",
  "years",
  "boolean",
]);
export type ValueFormat = z.infer<typeof ValueFormatSchema>;

// Provenance. A `direct` fact is stated in products.json AND matched to
// document text. A `derived` fact is computed by a named deterministic rule
// from other validated facts — there are no free-form calculations, only the
// rules enumerated in DERIVATION_RULE_IDS.
export const SourceKindSchema = z.enum(["direct", "derived"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const DERIVATION_RULE_IDS = ["LAST_NONZERO_SURRENDER_CHARGE_YEAR"] as const;
export const DerivationRuleIdSchema = z.enum(DERIVATION_RULE_IDS);
export type DerivationRuleId = z.infer<typeof DerivationRuleIdSchema>;

export const DerivationSchema = z.object({
  ruleId: DerivationRuleIdSchema,
  // products.json fact paths this rule consumed. Every path must resolve on
  // the product the cell belongs to — checked by integrity validation.
  inputFactRefs: z.array(z.string().min(1)).min(1),
  // The reconciled structured counterpart, when one exists (e.g. the annuity
  // also carries surrenderPeriodYears). A mismatch is a conflict, never a
  // silent preference for either side.
  reconciledWithPath: z.string().min(1).nullable(),
});
export type Derivation = z.infer<typeof DerivationSchema>;

export const CellDiagnosticsSchema = z.object({
  // Largest number of chunks on an anchor page that contained the same
  // evidence quote. >1 is legitimate (a phrase can repeat) but is recorded so
  // source drift is visible rather than silent.
  candidateChunkCount: z.number().int().min(0),
  // Every page a part of this cell anchored to. A cell may legitimately draw
  // on several pages (indexed-account mechanics on one, withdrawals on
  // another), so integrity checks compare each citation against this set.
  anchorPages: z.array(z.number().int().min(1)),
  evidenceQuoteCount: z.number().int().min(0),
});
export type CellDiagnostics = z.infer<typeof CellDiagnosticsSchema>;

export const ProductRefSchema = z.object({
  documentId: z.string().regex(/^doc_[a-z0-9_]+$/),
  documentName: z.string().min(1),
  productName: z.string().min(1),
  productCategory: ProductCategorySchema,
});
export type ProductRef = z.infer<typeof ProductRefSchema>;

export const ComparisonCellSchema = z.object({
  dimensionId: DimensionIdSchema,
  productId: z.string().min(1), // = documentId of the product this cell describes
  availability: AvailabilitySchema,
  format: ValueFormatSchema,
  sourceKind: SourceKindSchema,
  // Deterministic human-readable rendering. Fixed copy for not_applicable /
  // not_provided; null when the cell is in conflict, so a conflicted value can
  // never be shown as if verified.
  displayValue: z.string().nullable(),
  // Structured value from products.json (or a derivation output). Numeric
  // comparison and M4-B observation rules read this, never the display text.
  rawValue: z.unknown(),
  derivation: DerivationSchema.nullable(),
  citations: z.array(CitationSchema),
  conflictReason: z.string().nullable(),
  diagnostics: CellDiagnosticsSchema,
});
export type ComparisonCell = z.infer<typeof ComparisonCellSchema>;

// Forward-compatible row shape for M4-B. M4-A resolves one product at a time
// and deliberately implements no A-vs-B assembler.
export const ComparisonRowSchema = z.object({
  dimensionId: DimensionIdSchema,
  labelZh: z.string().min(1),
  labelEn: z.string().min(1),
  core: z.boolean(),
  cells: z.tuple([ComparisonCellSchema, ComparisonCellSchema]), // [productA, productB]
});
export type ComparisonRow = z.infer<typeof ComparisonRowSchema>;

// Everything M4-A produces for a single product: one cell per dimension, in
// DIMENSIONS order.
export const ProductFactSheetSchema = z.object({
  schemaVersion: z.literal(1),
  product: ProductRefSchema,
  cells: z.array(ComparisonCellSchema).min(1),
  factRegistryVersion: z.number().int().positive(),
});
export type ProductFactSheet = z.infer<typeof ProductFactSheetSchema>;

export const FACT_REGISTRY_VERSION = 1;

// ---------------------------------------------------------------------------
// M4-B: client context, observations, review flags, draft

export const UNKNOWN = "unknown" as const;
const unknownOr = <T extends z.ZodTypeAny>(schema: T) => z.union([schema, z.literal(UNKNOWN)]);

// Normalized view of a synthetic case. Fields the fixtures do not state stay
// `unknown` — M4 never invents tobacco status, health, income or intent.
export const ClientContextSchema = z.object({
  caseId: z.string().min(1),
  displayName: z.string().min(1),
  language: z.enum(["zh", "en"]),
  age: unknownOr(z.number().int().positive()),
  dependents: unknownOr(z.number().int().min(0)),
  primaryGoal: z.string().min(1),
  budgetMonthly: unknownOr(z.number().positive()),
  coverageHorizon: unknownOr(z.string().min(1)),
  existingCoverageNote: unknownOr(z.string().min(1)),
  riskTolerance: unknownOr(z.string().min(1)),
  tobaccoUse: unknownOr(z.string().min(1)),
  desiredCoverageAmount: unknownOr(z.number().positive()),
  // Derived only from explicit replacement/surrender wording — never from the
  // mere existence of some coverage.
  replacementContext: z.boolean(),
  clientQuestions: z.array(z.string().min(1)),
});
export type ClientContext = z.infer<typeof ClientContextSchema>;

export const MISSING_INFO_FIELDS = [
  "desiredCoverageAmount",
  "tobaccoUse",
  "underwritingClass",
  "employerGroupCoverage",
  "existingIndividualCoverage",
  "plannedPremiumDuration",
  "cashValueTimeHorizon",
  "withdrawalExpectations",
  "personalizedIllustration",
  "currentSurrenderCharge",
  "currentMarketValueAdjustment",
  "existingGuaranteedRateEndDate",
  "currentAccountValue",
  "benefitsThatMayBeLost",
] as const;
export const MissingInfoFieldSchema = z.enum(MISSING_INFO_FIELDS);
export type MissingInfoField = z.infer<typeof MissingInfoFieldSchema>;

export const MissingClientInfoSchema = z.object({
  field: MissingInfoFieldSchema,
  reasonZh: z.string().min(1),
  reasonEn: z.string().min(1),
  relevantTo: z.array(DimensionIdSchema),
  requiredFor: z.enum(["coverage_need", "cost_comparison", "illustration", "replacement_review"]),
});
export type MissingClientInfo = z.infer<typeof MissingClientInfoSchema>;

export const OBSERVATION_TYPES = [
  "RATE_GUARANTEE_SHORTER_THAN_SURRENDER",
  "CASH_VALUE_FEATURE_DIFFERS",
  "COVERAGE_STRUCTURE_DIFFERS",
  "NON_GUARANTEED_ELEMENTS_PRESENT",
  "ILLUSTRATION_REQUIRED_DIFFERS",
] as const;
export const ObservationTypeSchema = z.enum(OBSERVATION_TYPES);
export type ObservationType = z.infer<typeof ObservationTypeSchema>;

// Severity says how much human attention the note deserves — never which
// product is better. There is deliberately no good/bad/winner/score value.
export const ObservationSeveritySchema = z.enum(["informational", "review_note"]);

export const FactRefSchema = z.object({
  dimensionId: DimensionIdSchema,
  productId: z.string().min(1),
});

export const ComparisonObservationSchema = z.object({
  observationId: z.string().regex(/^obs_\d{3}$/),
  type: ObservationTypeSchema,
  textZh: z.string().min(1), // rendered from a code-owned template
  textEn: z.string().min(1),
  factRefs: z.array(FactRefSchema).min(1),
  citationIds: z.array(z.string()).min(1),
  severity: ObservationSeveritySchema,
});
export type ComparisonObservation = z.infer<typeof ComparisonObservationSchema>;

export const REVIEW_FLAGS = [
  "CLIENT_FACING_DRAFT",
  "NON_GUARANTEED_ELEMENTS",
  "ILLUSTRATION_REQUIRED",
  "ANNUITY_CONTEXT",
  "AGE_65_PLUS",
  "REPLACEMENT_CONTEXT",
  "SURRENDER_CHARGE_EXPOSURE",
  "MARKET_VALUE_ADJUSTMENT_EXPOSURE",
  "SPECIFIC_VALUE_REQUEST",
] as const;
export const ReviewFlagSchema = z.enum(REVIEW_FLAGS);
export type ReviewFlag = z.infer<typeof ReviewFlagSchema>;

export const ComparisonStatusSchema = z.enum(["complete", "partial", "blocked"]);
export type ComparisonStatus = z.infer<typeof ComparisonStatusSchema>;

export const NarrativeSectionSchema = z.object({
  headingZh: z.string().min(1),
  headingEn: z.string().min(1),
  text: z.string().min(1),
  dimensionIds: z.array(DimensionIdSchema),
  observationIds: z.array(z.string()),
});
export type NarrativeSection = z.infer<typeof NarrativeSectionSchema>;

export const NarrativeStatusSchema = z.enum(["not_requested", "available", "unavailable", "rejected"]);
export type NarrativeStatus = z.infer<typeof NarrativeStatusSchema>;

export const ComparisonDraftSchema = z.object({
  schemaVersion: z.literal(1),
  comparisonId: z.string().min(1),
  productA: ProductRefSchema,
  productB: ProductRefSchema,
  clientContext: ClientContextSchema.nullable(),
  dimensions: z.array(ComparisonRowSchema).min(1),
  observations: z.array(ComparisonObservationSchema),
  missingClientInformation: z.array(MissingClientInfoSchema),
  narrativeSections: z.array(NarrativeSectionSchema),
  narrativeStatus: NarrativeStatusSchema,
  narrativeRejectionReason: z.string().nullable(),
  comparisonStatus: ComparisonStatusSchema,
  reviewRequired: z.boolean(),
  reviewReasons: z.array(ReviewFlagSchema),
  disclaimerZh: z.string().min(1),
  disclaimerEn: z.string().min(1),
  meta: z.object({
    comparisonEngineVersion: z.number().int().positive(),
    factRegistryVersion: z.number().int().positive(),
    narrativeModel: z.string().nullable(),
    latencyMs: z.number().int().min(0),
  }),
});
export type ComparisonDraft = z.infer<typeof ComparisonDraftSchema>;

export const COMPARISON_ENGINE_VERSION = 1;
