// Hand-written client-side types mirroring the /api/answer response contract.
// Keep in sync with the server-side zod schemas; the client only reads these shapes.

export type EvidenceStatus = "strong" | "partial" | "insufficient";

export interface Claim {
  claimId: string;
  text: string;
  factual: boolean;
  citationIds: string[];
}

export interface Citation {
  citationId: string;
  documentId: string;
  documentName: string;
  productName: string;
  chunkId: string;
  pageStart: number;
  pageEnd: number;
  section: string;
  quote: string;
  claimIds: string[];
  sourceUrl: string | null;
}

export interface RequestedFacet {
  facetId: string;
  description: string;
  required: boolean;
  supported: boolean;
  claimIds: string[];
}

export interface Refusal {
  isRefusal: boolean;
  reasonCode: string | null;
  message: string | null;
  knownFacts: string[];
  missingInformation: string[];
  suggestedNextStep: string | null;
}

export interface AnswerMeta {
  retrievalId: string;
  answerModel: string;
  promptVersion: number;
  thresholdsVersion: number;
  latencyMs: number;
  retryCount: number;
  citationCoverage: number;
  unsupportedClaimCount: number;
}

export interface GroundedAnswer {
  answer: string;
  language: "zh" | "en";
  claims: Claim[];
  citations: Citation[];
  requestedFacets: RequestedFacet[];
  missingInformation: string[];
  materialMissingInformation: string[];
  refusal: Refusal;
  evidenceStatus: EvidenceStatus;
  reviewRequired: boolean;
  reviewReasons: string[];
  meta: AnswerMeta;
}

export interface ApiError {
  error: string;
  message: string;
}

export type Phase = "idle" | "loading" | "done" | "error";
