import { z } from "zod";

// Schemas for the M1 data contract. SPEC.md §3 defines the minimum shape;
// fields beyond it (omissionPatterns, PageDefinition/ExpectedFactLocation
// internals) are additive and exist so validation stays data-driven instead
// of hard-coding product facts in scripts.

export const ProductCategorySchema = z.enum([
  "term_life",
  "indexed_universal_life",
  "fixed_annuity",
]);
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const PageDefinitionSchema = z.object({
  page: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().optional(),
});
export type PageDefinition = z.infer<typeof PageDefinitionSchema>;

// A fact that validation must find on a specific page of the generated PDF.
// mustInclude strings are matched against normalized extracted page text.
export const ExpectedFactLocationSchema = z.object({
  factId: z.string().min(1),
  page: z.number().int().positive(),
  mustInclude: z.array(z.string().min(1)).min(1),
  note: z.string().optional(),
});
export type ExpectedFactLocation = z.infer<typeof ExpectedFactLocationSchema>;

// Machine-checkable counterpart of an intentional omission: a regex that must
// match nowhere in the document text. Patterns are contextual on purpose —
// bare numbers like "61" would false-positive on amounts such as "$162".
export const OmissionPatternSchema = z.object({
  description: z.string().min(1),
  pattern: z.string().min(1),
  flags: z.string().regex(/^[gimsuy]*$/).optional(),
});
export type OmissionPattern = z.infer<typeof OmissionPatternSchema>;

export const CarrierSchema = z.object({
  id: z.string().min(1),
  legalName: z.string().min(1),
  displayName: z.string().min(1),
  isFictional: z.literal(true),
});
export type Carrier = z.infer<typeof CarrierSchema>;

export const ProductDefinitionSchema = z.object({
  documentId: z.string().min(1),
  fileName: z.string().regex(/^[a-z0-9-]+\.pdf$/),
  documentName: z.string().min(1),
  documentType: z.literal("product_brochure"),
  carrier: CarrierSchema,
  productName: z.string().min(1),
  productCategory: ProductCategorySchema,
  jurisdiction: z.literal("California"),
  language: z.literal("en"),
  effectiveDate: IsoDateSchema,
  pages: z.number().int().positive(),
  isCurrent: z.literal(true),
  isFictional: z.literal(true),
  facts: z.record(z.string(), z.unknown()),
  pageOutline: z.array(PageDefinitionSchema).min(1),
  intentionalOmissions: z.array(z.string().min(1)),
  omissionPatterns: z.array(OmissionPatternSchema),
  expectedFactLocations: z.array(ExpectedFactLocationSchema).min(1),
});
export type ProductDefinition = z.infer<typeof ProductDefinitionSchema>;

export const ProductCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().optional(),
  products: z.array(ProductDefinitionSchema).min(1),
});
export type ProductCatalog = z.infer<typeof ProductCatalogSchema>;

// ---------------------------------------------------------------------------
// Manifest (SPEC §8) — generated from products.json, never hand-maintained.

export const ManifestEntrySchema = z.object({
  schemaVersion: z.literal(1),
  documentId: z.string().min(1),
  file: z.string().min(1),
  documentName: z.string().min(1),
  documentType: z.literal("product_brochure"),
  carrierId: z.string().min(1),
  carrier: z.string().min(1),
  productName: z.string().min(1),
  productCategory: ProductCategorySchema,
  jurisdiction: z.literal("California"),
  language: z.literal("en"),
  effectiveDate: IsoDateSchema,
  pages: z.number().int().positive(),
  isCurrent: z.literal(true),
  isFictional: z.literal(true),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const ManifestSchema = z.array(ManifestEntrySchema).min(1);

// ---------------------------------------------------------------------------
// Public regulatory documents (SPEC §9) — separate from fictional brochures.

export const PublicDocumentEntrySchema = z.object({
  schemaVersion: z.literal(1),
  documentId: z.string().min(1),
  documentName: z.string().min(1),
  documentType: z.literal("regulatory_guide"),
  isFictional: z.literal(false),
  publisher: z.string().min(1),
  sourceUrl: z.string().url(),
  jurisdiction: z.string().min(1),
  language: z.literal("en"),
  localFile: z.string().min(1),
  committed: z.literal(false),
  notes: z.string().optional(),
});
export type PublicDocumentEntry = z.infer<typeof PublicDocumentEntrySchema>;

export const PublicDocumentManifestSchema = z
  .array(PublicDocumentEntrySchema)
  .min(1);

// ---------------------------------------------------------------------------
// Synthetic cases (SPEC §10).

export const RiskTierSchema = z.enum(["low", "medium", "high"]);
export type RiskTier = z.infer<typeof RiskTierSchema>;

export const WorkflowDecisionSchema = z.enum([
  "allow_internal_draft",
  "allow_checklist_only",
  "block_client_draft",
]);
export type WorkflowDecision = z.infer<typeof WorkflowDecisionSchema>;

// The APPROVAL LEVEL a case requires — how much human authority is needed,
// not how far the review has got. CLAUDE.md §4.3 calls the global five-value
// enum "ReviewStatus"; that name reads like workflow progress, so the M5 type
// is RequiredApprovalLevel (lib/reviews/types.ts) and this is its narrowed
// fixture subset: SPEC §10 cases always require review, so the two "no
// approval needed" and "blocked" values never appear in a case fixture.
//
// The JSON field keeps its historical name `expected.reviewStatus`: the
// fixtures are frozen ground truth and renaming data to match a type would be
// exactly backwards.
export const CaseRequiredApprovalLevelSchema = z.enum([
  "standard_approval",
  "enhanced_review",
  "licensed_agent_required",
]);
export type CaseRequiredApprovalLevel = z.infer<typeof CaseRequiredApprovalLevelSchema>;

export const SyntheticCaseSchema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  riskTier: RiskTierSchema,
  client: z.record(z.string(), z.unknown()),
  goal: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  expected: z.object({
    productCategories: z.array(ProductCategorySchema).min(1),
    missingInformation: z.array(z.string().min(1)),
    requiredRiskFlags: z.array(z.string().min(1)),
    workflowDecision: WorkflowDecisionSchema,
    reviewStatus: CaseRequiredApprovalLevelSchema,
    externalUseRequiresApproval: z.literal(true),
    allowedOutput: z.enum(["comparison_draft", "replacement_review_checklist"]),
    requiredChecklistItems: z.array(z.string().min(1)).optional(),
    nextAction: z.string().min(1),
  }),
});
export type SyntheticCase = z.infer<typeof SyntheticCaseSchema>;
