import { normalizeText } from "../pdf-text";
import { buildCitation, citationKey, quoteMatchesChunk } from "../citations/build";
import type { RetrievedChunk } from "../retrieval/types";
import type {
  Citation,
  DraftClaim,
  ModelDraft,
  ValidatedClaim,
  ValidatedFacet,
} from "./types";

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
// amounts, no guarantee/eligibility/suitability wording, and no
// recommendation conclusions.
export function violatesNonFactualGuard(text: string): boolean {
  const stripped = stripProductNames(text);
  if (/[\d％%$¥]/.test(stripped)) return true;
  if (/(guarantee|保证|premium|保费|surrender|退保|cash value|现金价值|suitab|适合|税|tax|legal|法律)/i.test(text)) return true;
  if (isRecommendationConclusion(text)) return true;
  return false;
}

// Deterministic OUTPUT-side red line (CLAUDE.md red line 1/3): no rendered
// claim may state a recommendation conclusion — superlative product verdicts
// or purchase directives — regardless of how the model phrases the draft.
// Query-side red lines cannot catch every imperative phrasing ("tell the
// customer X is safest"), so the boundary is enforced on the draft itself:
// a matching claim is a hard error -> bounded repair retry -> refusal.
// Negated/absence statements ("no document states X is the safest") are
// legitimate refusal content and exempt.
const RECOMMENDATION_CONCLUSION_RE =
  /\b(is|are|would be)\s+(the\s+)?(best|safest|most suitable|ideal)\s*(choice|option|product|policy|one)?\b|最安全|最好的|最合适|最适合|首选|\bshould\s+(buy|choose|pick|select)\b|应该(买|购买|选)|建议(买|购买|选择?)/i;
const OUTPUT_NEGATION_RE =
  /\b(no|not|never|cannot|can'?t|isn'?t|aren'?t|doesn'?t|don'?t|won'?t|wouldn'?t|whether|without|un(?:documented|verified|supported|confirmed|stated)|lacks?|absent|missing)\b|不能|不得|不会|不是|不予|并非|没有|无法|未|拒绝|是否|缺少|缺失/i;

export function isRecommendationConclusion(text: string): boolean {
  if (!RECOMMENDATION_CONCLUSION_RE.test(text)) return false;
  return !OUTPUT_NEGATION_RE.test(text);
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

// "The document states the PRODUCT does not offer X" is a negative product
// fact, not an information-absence claim, even though it mentions 文档/
// document. Product-subject negation takes precedence over the absence test.
const PRODUCT_NEGATION = /(产品|保单|该计划|policy|product|plan|annuity|rider)[^。.]{0,20}(不提供|不含|不积累|不产生|没有|does not|doesn't|do not)|(does not|doesn't) (offer|accumulate|provide|include)/i;

export function isInfoAbsenceClaim(text: string): boolean {
  if (PRODUCT_NEGATION.test(text)) return false;
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
    // nonFactualText/heading that trips the factual guard is NOT a hard
    // error: the renderer silently omits such text (topic-echo phrases like
    // "关于 20 年后现金价值" are common and harmless — nothing unvalidated can
    // render either way). Hard failures stay reserved for schema/handle/
    // reference violations.
  }

  // Evidence handles must exist in THIS request's evidence map, and no claim
  // may state a recommendation conclusion (deterministic output red line —
  // hard error so the bounded repair retry rephrases or the answer refuses).
  for (const claim of draft.claims) {
    for (const handle of claim.evidenceHandles) {
      if (!evidence[handle]) hardErrors.push(`claim ${claim.claimId} uses unknown evidence handle ${handle}`);
    }
    for (const sel of claim.quoteSelections) {
      if (!evidence[sel.handle]) hardErrors.push(`claim ${claim.claimId} quotes unknown handle ${sel.handle}`);
    }
    if (isRecommendationConclusion(claim.text)) {
      hardErrors.push(
        `claim ${claim.claimId} states a recommendation conclusion — restate as documented facts only`,
      );
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
    const validSelections = claim.quoteSelections.filter((sel) =>
      quoteMatchesChunk(evidence[sel.handle]!, sel.quote),
    );

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
      const key = citationKey(chunk.chunkId, sel.quote);
      let citation = citationByKey.get(key);
      if (!citation) {
        citationSeq++;
        citation = buildCitation(chunk, sel.quote, citationSeq);
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
