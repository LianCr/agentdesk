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
