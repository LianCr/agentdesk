import { normalizeText } from "../pdf-text.js";
import type { RetrievedChunk } from "../retrieval/types.js";
import type {
  Citation,
  DraftClaim,
  ModelDraft,
  ValidatedClaim,
  ValidatedFacet,
} from "./types.js";

// Deterministic validation of a ModelDraft against the evidence handles of
// THIS retrieval. Hard violations invalidate the draft (one bounded repair
// retry, then MODEL_OUTPUT_INVALID). Soft violations make individual claims
// unsupported — an unsupported factual claim can never render.

export interface EvidenceMap {
  // "E1" -> chunk from this request's retrieval result. Fake/test/inactive
  // documents can never appear here (excluded at the SQL layer and asserted).
  [handle: string]: RetrievedChunk;
}

export function buildEvidenceMap(chunks: RetrievedChunk[]): EvidenceMap {
  const map: EvidenceMap = {};
  chunks.forEach((chunk, i) => {
    if (chunk.documentId.startsWith("test_")) {
      throw new Error(`EVIDENCE_FORBIDDEN: test document ${chunk.documentId} can never become a handle`);
    }
    map[`E${i + 1}`] = chunk;
  });
  return map;
}

// Product names that legitimately contain digits — stripped before numeric
// factual-content checks so "Demo TermPlus 20" alone doesn't count as a number.
const PRODUCT_NAME_PATTERNS = [/Demo TermPlus 20/gi, /TermPlus 20/gi, /Demo SecureRate 5/gi, /SecureRate 5\b/gi, /Demo IndexFlex UL/gi];

export function stripProductNames(text: string): string {
  let out = text;
  for (const re of PRODUCT_NAME_PATTERNS) out = out.replace(re, " PRODUCT ");
  return out;
}

// A claim whose text contains numbers/percentages/amounts/durations, or a
// negative product fact, is factual regardless of the model's label.
export function mustBeFactual(text: string): boolean {
  const stripped = stripProductNames(text);
  if (/[\d％%$¥]/.test(stripped)) return true;
  if (/(does not|do not|doesn't|not offer|not provide|no optional|不提供|不含|没有|不会|不产生|不积累)/i.test(text)) return true;
  return false;
}

// nonFactualText may carry structure/conversation only — no numbers, no
// amounts, no guarantee/eligibility/suitability wording.
export function violatesNonFactualGuard(text: string): boolean {
  const stripped = stripProductNames(text);
  if (/[\d％%$¥]/.test(stripped)) return true;
  if (/(guarantee|保证|premium|保费|surrender|退保|cash value|现金价值|suitab|适合|税|tax|legal|法律)/i.test(text)) return true;
  return false;
}

export interface ValidationResult {
  ok: boolean;
  hardErrors: string[]; // draft-invalid -> repair retry
  validatedClaims: ValidatedClaim[]; // renderable claims (factual ones carry citations)
  citations: Citation[];
  unsupportedClaims: DraftClaim[]; // factual claims that failed citation validation — never rendered
  citationCoverage: number;
  facets: ValidatedFacet[]; // requested-fact coverage, `supported` recomputed by code
}

// A claim that states information is ABSENT from the documents cannot
// support a facet that requests that information ("the guide does not show
// the age-61 premium" answers nothing about the premium). Genuine negative
// PRODUCT facts ("does not offer optional riders") mention the product, not
// the documents, and are unaffected.
const INFO_ABSENCE = /(证据|文档|资料|材料|文件|evidence|document|guide)[^。.]{0,25}(没有|未(提供|给出|列出|显示|包含)|not\s|no\s|do(es)? not)|not (provided|shown|available|included|listed) in/i;

export function isInfoAbsenceClaim(text: string): boolean {
  return INFO_ABSENCE.test(text);
}

export function validateDraft(draft: ModelDraft, evidence: EvidenceMap): ValidationResult {
  const hardErrors: string[] = [];

  // Claim ids unique; section references resolve.
  const ids = draft.claims.map((c) => c.claimId);
  if (new Set(ids).size !== ids.length) hardErrors.push("duplicate claimId in draft");
  const idSet = new Set(ids);
  for (const section of draft.sections) {
    for (const ref of section.claimIds) {
      if (!idSet.has(ref)) hardErrors.push(`section references unknown claim ${ref}`);
    }
    if (section.nonFactualText && violatesNonFactualGuard(section.nonFactualText)) {
      hardErrors.push(`nonFactualText contains factual content: "${section.nonFactualText.slice(0, 60)}"`);
    }
    if (section.heading && violatesNonFactualGuard(section.heading)) {
      hardErrors.push(`section heading contains factual content: "${section.heading}"`);
    }
  }

  // Evidence handles must exist in THIS request's evidence map.
  for (const claim of draft.claims) {
    for (const handle of claim.evidenceHandles) {
      if (!evidence[handle]) hardErrors.push(`claim ${claim.claimId} uses unknown evidence handle ${handle}`);
    }
    for (const sel of claim.quoteSelections) {
      if (!evidence[sel.handle]) hardErrors.push(`claim ${claim.claimId} quotes unknown handle ${sel.handle}`);
    }
  }

  // Facet references must resolve; at least one facet must be required.
  for (const facet of draft.requestedFacets) {
    for (const ref of facet.supportedByClaimIds) {
      if (!idSet.has(ref)) hardErrors.push(`facet ${facet.facetId} references unknown claim ${ref}`);
    }
  }
  if (!draft.requestedFacets.some((f) => f.required)) {
    hardErrors.push("no required requested facet — decompose the user's core request");
  }

  if (hardErrors.length > 0) {
    return { ok: false, hardErrors, validatedClaims: [], citations: [], unsupportedClaims: [], citationCoverage: 0, facets: [] };
  }

  // Per-claim citation validation. Citation metadata is injected from the
  // retrieval chunk — the model contributed only the handle and the quote.
  const citations: Citation[] = [];
  const validatedClaims: ValidatedClaim[] = [];
  const unsupportedClaims: DraftClaim[] = [];
  let citationSeq = 0;
  const citationByKey = new Map<string, Citation>(); // chunkId+quote dedup

  const PRODUCT_KEYS = ["termplus", "indexflex", "securerate"];

  for (const claim of draft.claims) {
    const factual = claim.factual || mustBeFactual(claim.text);

    // Collect valid quote selections first; commit citations only if the
    // claim survives every check (including product consistency).
    const validSelections = claim.quoteSelections.filter((sel) => {
      const chunk = evidence[sel.handle]!;
      return normalizeText(chunk.content).includes(normalizeText(sel.quote));
    });

    // A claim naming exactly one product must cite that product only.
    const mentioned = PRODUCT_KEYS.filter((k) => claim.text.toLowerCase().includes(k));
    const consistentSelections =
      mentioned.length === 1
        ? validSelections.filter((sel) =>
            evidence[sel.handle]!.productName.toLowerCase().includes(mentioned[0]!),
          )
        : validSelections;

    if (factual && consistentSelections.length === 0) {
      unsupportedClaims.push(claim); // cannot render
      continue;
    }

    const claimCitationIds: string[] = [];
    for (const sel of consistentSelections) {
      const chunk = evidence[sel.handle]!;
      const key = `${chunk.chunkId}::${normalizeText(sel.quote)}`;
      let citation = citationByKey.get(key);
      if (!citation) {
        citationSeq++;
        citation = {
          citationId: `cit_${String(citationSeq).padStart(3, "0")}`,
          documentId: chunk.documentId,
          documentName: chunk.documentName,
          productName: chunk.productName,
          chunkId: chunk.chunkId,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          section: chunk.section,
          quote: sel.quote,
          claimIds: [],
        };
        citationByKey.set(key, citation);
        citations.push(citation);
      }
      if (!citation.claimIds.includes(claim.claimId)) citation.claimIds.push(claim.claimId);
      claimCitationIds.push(citation.citationId);
    }

    validatedClaims.push({
      claimId: claim.claimId,
      text: claim.text,
      factual,
      citationIds: [...new Set(claimCitationIds)],
    });
  }

  // Drop citations that ended up supporting nothing (all their claims failed).
  const liveCitations = citations.filter((c) => c.claimIds.length > 0);

  const factualConsidered = draft.claims.filter((c) => c.factual || mustBeFactual(c.text)).length;
  const factualCited = validatedClaims.filter((c) => c.factual && c.citationIds.length > 0).length;

  // Facet support recomputed from validated claims only: the model cannot
  // mark a facet supported without a surviving cited factual claim, and
  // information-absence claims never count as support.
  const supportingClaimIds = new Set(
    validatedClaims
      .filter((c) => c.factual && c.citationIds.length > 0 && !isInfoAbsenceClaim(c.text))
      .map((c) => c.claimId),
  );
  const facets: ValidatedFacet[] = draft.requestedFacets.map((facet) => {
    const claimIds = facet.supportedByClaimIds.filter((id) => supportingClaimIds.has(id));
    return {
      facetId: facet.facetId,
      description: facet.description,
      required: facet.required,
      supported: claimIds.length > 0,
      claimIds,
    };
  });

  return {
    ok: true,
    hardErrors: [],
    validatedClaims,
    citations: liveCitations,
    unsupportedClaims,
    citationCoverage: factualConsidered === 0 ? 1 : factualCited / factualConsidered,
    facets,
  };
}
