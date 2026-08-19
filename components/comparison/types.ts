// Client-side mirrors of the server contracts (same convention as
// components/chat/types.ts: the browser never imports zod schemas or any
// server module).

export type Availability = "available" | "not_applicable" | "not_provided" | "conflict";
export type SourceKind = "direct" | "derived";
export type ComparisonStatus = "complete" | "partial" | "blocked";
export type NarrativeStatus = "not_requested" | "available" | "unavailable" | "rejected";

export interface UiCitation {
  citationId: string;
  documentId: string;
  documentName: string;
  productName: string;
  pageStart: number;
  pageEnd: number;
  section: string;
  quote: string;
}

export interface UiCell {
  dimensionId: string;
  productId: string;
  availability: Availability;
  sourceKind: SourceKind;
  displayValue: string | null;
  citations: UiCitation[];
  conflictReason: string | null;
}

export interface UiRow {
  dimensionId: string;
  labelZh: string;
  labelEn: string;
  core: boolean;
  cells: [UiCell, UiCell];
}

export interface UiObservation {
  observationId: string;
  type: string;
  textZh: string;
  textEn: string;
  citationIds: string[];
  severity: "informational" | "review_note";
}

export interface UiMissingInfo {
  field: string;
  reasonZh: string;
  reasonEn: string;
  requiredFor: string;
  // Which comparison dimensions this gap affects. The server has always
  // produced it (lib/comparison/missing-info.ts) and it is stored in review
  // snapshots; it is optional here because rows frozen before this field was
  // read by the browser can never be backfilled — read it as `?? []`.
  relevantTo?: string[];
}

export interface UiClientContext {
  caseId: string;
  displayName: string;
  language: "zh" | "en";
  age: number | "unknown";
  dependents: number | "unknown";
  primaryGoal: string;
  budgetMonthly: number | "unknown";
  coverageHorizon: string | "unknown";
  existingCoverageNote: string | "unknown";
  riskTolerance: string | "unknown";
  replacementContext: boolean;
}

/** Browser mirror of lib/comparison/client-roster.ts. */
export interface UiClientRosterField {
  key: string;
  labelZh: string;
  labelEn: string;
  valueZh: string;
  valueEn: string;
  verbatimEnglish?: boolean;
}

export interface UiClientRosterEntry {
  caseId: string;
  displayName: string;
  language: "zh" | "en";
  primaryGoal: string;
  replacementContext: boolean;
  stated: UiClientRosterField[];
  notStated: Array<Pick<UiClientRosterField, "key" | "labelZh" | "labelEn">>;
  clientQuestions: string[];
}

export interface UiProductRef {
  documentId: string;
  documentName: string;
  productName: string;
  productCategory: string;
}

export interface UiNarrativeSection {
  headingZh: string;
  headingEn: string;
  text: string;
}

export interface ComparisonDraftView {
  comparisonId: string;
  productA: UiProductRef;
  productB: UiProductRef;
  clientContext: UiClientContext | null;
  dimensions: UiRow[];
  observations: UiObservation[];
  missingClientInformation: UiMissingInfo[];
  narrativeSections: UiNarrativeSection[];
  narrativeStatus: NarrativeStatus;
  comparisonStatus: ComparisonStatus;
  reviewRequired: boolean;
  reviewReasons: string[];
  disclaimerZh: string;
  disclaimerEn: string;
  citationUrls: Record<string, string>;
}

export type Phase = "idle" | "loading" | "done" | "error";
