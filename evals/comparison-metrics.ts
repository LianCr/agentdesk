import { normalizeText } from "../lib/pdf-text";
import { quoteMatchesChunk } from "../lib/citations/build";
import { isRecommendationConclusion } from "../lib/rag/validate";
import { DIMENSIONS } from "../lib/comparison/dimensions";
import type { ChunkRecord } from "../lib/ingestion/types";
import type { ComparisonCell, ComparisonDraft } from "../lib/comparison/types";
import type { ComparisonCase, ExpectedCell } from "./comparison-schema";

// M4-D evaluation, structured-first.
//
// The primary source of truth is the ComparisonDraft's structured state:
// availability, rawValue, sourceKind, per-cell citations, observation
// factRefs, missing-info fields, review flags, status. Free-text scanning
// appears only as a secondary check on rendered strings, and only for things
// that genuinely live in text (units, forbidden phrasing). That ordering is
// the M3 lesson: when structured state already expresses a property, asserting
// it with a regex invents failures the system never had.

export type FailureCategory =
  | "fact-registry defect"
  | "source-map defect"
  | "citation-ID defect"
  | "availability defect"
  | "cross-category assignment defect"
  | "derived-fact defect"
  | "observation defect"
  | "symmetry defect"
  | "client-context defect"
  | "review-flag defect"
  | "status defect"
  | "boundary defect"
  | "generation failure";

export interface CaseEvaluation {
  id: string;
  category: ComparisonCase["category"];
  productAId: string;
  productBId: string;
  clientCaseId: string | null;
  pass: boolean;
  failures: Array<{ category: FailureCategory; detail: string }>;
  counts: {
    cellsChecked: number;
    cellsCorrect: number;
    availabilityChecked: number;
    availabilityCorrect: number;
    citationsChecked: number;
    citationsCorrect: number;
    observationsChecked: number;
    observationsCorrect: number;
    missingInfoChecked: number;
    missingInfoCorrect: number;
    reviewChecked: number;
    reviewCorrect: number;
  };
  hardCounts: {
    wrongFactualCells: number;
    wrongProductAssignments: number;
    wrongCitationDocument: number;
    wrongCitationPage: number;
    invalidCitationQuote: number;
    ambiguousCitationIds: number;
    availableWithoutSource: number;
    inventedNumericCells: number;
    availabilityCollapse: number;
    wrongDerivedProvenance: number;
    wrongObservationInputs: number;
    recommendationViolations: number;
    guaranteeViolations: number;
  };
  latencyMs: number;
  error: string | null;
}

const emptyHard = (): CaseEvaluation["hardCounts"] => ({
  wrongFactualCells: 0,
  wrongProductAssignments: 0,
  wrongCitationDocument: 0,
  wrongCitationPage: 0,
  invalidCitationQuote: 0,
  ambiguousCitationIds: 0,
  availableWithoutSource: 0,
  inventedNumericCells: 0,
  availabilityCollapse: 0,
  wrongDerivedProvenance: 0,
  wrongObservationInputs: 0,
  recommendationViolations: 0,
  guaranteeViolations: 0,
});

// Semantic numeric comparison: 9.5 and 9.50 are the same value, "9.50%" and
// "9.50 years" are not. Units live in the display string, values in rawValue,
// so each is compared where it actually lives.
export function sameStructuredValue(expected: unknown, actual: unknown): boolean {
  if (typeof expected === "number" && typeof actual === "number") return expected === actual;
  if (typeof expected === "string" && typeof actual === "string") {
    return normalizeText(expected) === normalizeText(actual);
  }
  if (expected === null || actual === null) return expected === actual;
  if (typeof expected === "object" && typeof actual === "object") {
    const e = expected as Record<string, unknown>;
    const a = actual as Record<string, unknown>;
    return Object.keys(e).every((key) => sameStructuredValue(e[key], a[key]));
  }
  return expected === actual;
}

function cellFor(draft: ComparisonDraft, expected: ExpectedCell): ComparisonCell | null {
  const row = draft.dimensions.find((r) => r.dimensionId === expected.dimensionId);
  if (!row) return null;
  return expected.side === "a" ? row.cells[0] : row.cells[1];
}

function renderedText(draft: ComparisonDraft): string {
  return [
    ...draft.dimensions.flatMap((r) => r.cells.map((c) => c.displayValue ?? "")),
    ...draft.observations.flatMap((o) => [o.textZh, o.textEn]),
    ...draft.missingClientInformation.flatMap((m) => [m.reasonZh, m.reasonEn]),
    ...draft.narrativeSections.map((s) => s.text),
    draft.disclaimerZh,
    draft.disclaimerEn,
  ].join("\n");
}

export function evaluateComparisonCase(
  evalCase: ComparisonCase,
  draft: ComparisonDraft,
  chunksByDocumentId: Readonly<Record<string, readonly ChunkRecord[]>>,
  latencyMs: number,
): CaseEvaluation {
  const failures: CaseEvaluation["failures"] = [];
  const hard = emptyHard();
  const counts = {
    cellsChecked: 0, cellsCorrect: 0,
    availabilityChecked: 0, availabilityCorrect: 0,
    citationsChecked: 0, citationsCorrect: 0,
    observationsChecked: 0, observationsCorrect: 0,
    missingInfoChecked: 0, missingInfoCorrect: 0,
    reviewChecked: 0, reviewCorrect: 0,
  };
  const fail = (category: FailureCategory, detail: string) => failures.push({ category, detail });

  // --- status -------------------------------------------------------------
  if (draft.comparisonStatus !== evalCase.expectedStatus) {
    fail("status defect", `status ${draft.comparisonStatus}, expected ${evalCase.expectedStatus}`);
  }

  // --- dimension coverage and ordering ------------------------------------
  const actualDimensions = draft.dimensions.map((r) => r.dimensionId);
  const requiredDimensions = evalCase.expectedDimensionIds ?? DIMENSIONS.map((d) => d.dimensionId);
  if (JSON.stringify(actualDimensions) !== JSON.stringify(requiredDimensions)) {
    fail("fact-registry defect", `dimension list/order mismatch: ${actualDimensions.join(",")}`);
  }

  // --- every cell: universal invariants ------------------------------------
  const citationIdentity = new Map<string, string>();
  for (const row of draft.dimensions) {
    row.cells.forEach((cell, index) => {
      const expectedProduct = index === 0 ? draft.productA.documentId : draft.productB.documentId;
      if (cell.productId !== expectedProduct) {
        hard.wrongProductAssignments += 1;
        fail("cross-category assignment defect", `${row.dimensionId} column ${index} bound to ${cell.productId}`);
      }

      if (cell.availability === "available") {
        if (cell.citations.length === 0) {
          hard.availableWithoutSource += 1;
          fail("source-map defect", `${row.dimensionId}/${cell.productId}: available without a source`);
        }
        if (cell.displayValue === null) {
          hard.wrongFactualCells += 1;
          fail("fact-registry defect", `${row.dimensionId}/${cell.productId}: available without a value`);
        }
      }
      if (cell.availability === "conflict" && cell.displayValue !== null) {
        hard.wrongFactualCells += 1;
        fail("availability defect", `${row.dimensionId}/${cell.productId}: conflict exposed a value`);
      }
      if ((cell.availability === "not_applicable" || cell.availability === "not_provided") && cell.citations.length > 0) {
        hard.availabilityCollapse += 1;
        fail("availability defect", `${row.dimensionId}/${cell.productId}: ${cell.availability} carries citations`);
      }
      if (cell.sourceKind === "derived" && cell.availability === "available" && cell.derivation === null) {
        hard.wrongDerivedProvenance += 1;
        fail("derived-fact defect", `${row.dimensionId}/${cell.productId}: derived cell without provenance`);
      }
      if (cell.sourceKind === "direct" && cell.derivation !== null) {
        hard.wrongDerivedProvenance += 1;
        fail("derived-fact defect", `${row.dimensionId}/${cell.productId}: direct cell carries a derivation`);
      }

      for (const citation of cell.citations) {
        counts.citationsChecked += 1;
        let ok = true;
        if (citation.documentId !== cell.productId) {
          hard.wrongCitationDocument += 1;
          ok = false;
          fail("citation-ID defect", `${row.dimensionId}: citation ${citation.citationId} cites ${citation.documentId}`);
        }
        const chunk = (chunksByDocumentId[citation.documentId] ?? []).find((c) => c.chunkId === citation.chunkId);
        if (!chunk) {
          hard.invalidCitationQuote += 1;
          ok = false;
          fail("source-map defect", `${row.dimensionId}: unknown chunk ${citation.chunkId}`);
        } else {
          if (citation.pageStart !== chunk.pageStart || citation.pageEnd !== chunk.pageEnd) {
            hard.wrongCitationPage += 1;
            ok = false;
            fail("source-map defect", `${row.dimensionId}: citation page != chunk page`);
          }
          if (!quoteMatchesChunk(chunk, citation.quote)) {
            hard.invalidCitationQuote += 1;
            ok = false;
            fail("source-map defect", `${row.dimensionId}: quote not in chunk ${citation.chunkId}`);
          }
        }
        // Draft-wide citation-id uniqueness — the M4-C browser-QA bug.
        const identity = `${citation.documentId}::${citation.chunkId}::${normalizeText(citation.quote)}`;
        const seen = citationIdentity.get(citation.citationId);
        if (seen !== undefined && seen !== identity) {
          hard.ambiguousCitationIds += 1;
          ok = false;
          fail("citation-ID defect", `${citation.citationId} refers to two different sources`);
        }
        citationIdentity.set(citation.citationId, identity);
        if (ok) counts.citationsCorrect += 1;
      }
    });
  }

  // --- expected cells ------------------------------------------------------
  for (const expected of evalCase.expectedCells) {
    const cell = cellFor(draft, expected);
    counts.cellsChecked += 1;
    counts.availabilityChecked += 1;
    if (!cell) {
      hard.wrongFactualCells += 1;
      fail("fact-registry defect", `${expected.dimensionId}: no cell on side ${expected.side}`);
      continue;
    }
    let cellOk = true;

    if (cell.availability !== expected.availability) {
      hard.availabilityCollapse += 1;
      cellOk = false;
      fail("availability defect", `${expected.dimensionId}/${expected.side}: ${cell.availability}, expected ${expected.availability}`);
    } else {
      counts.availabilityCorrect += 1;
    }

    if (expected.sourceKind !== undefined && cell.sourceKind !== expected.sourceKind) {
      hard.wrongDerivedProvenance += 1;
      cellOk = false;
      fail("derived-fact defect", `${expected.dimensionId}/${expected.side}: sourceKind ${cell.sourceKind}`);
    }

    if (expected.rawValue !== undefined && !sameStructuredValue(expected.rawValue, cell.rawValue)) {
      hard.wrongFactualCells += 1;
      cellOk = false;
      fail("fact-registry defect", `${expected.dimensionId}/${expected.side}: rawValue ${JSON.stringify(cell.rawValue)?.slice(0, 60)}`);
    }

    const display = cell.displayValue ?? "";
    for (const needle of expected.displayIncludes ?? []) {
      if (!display.includes(needle)) {
        hard.wrongFactualCells += 1;
        cellOk = false;
        fail("fact-registry defect", `${expected.dimensionId}/${expected.side}: display missing "${needle}"`);
      }
    }
    for (const needle of expected.displayExcludes ?? []) {
      if (display.includes(needle)) {
        // A negative fact rendered as an absence, or a derived value claimed as
        // a document sentence, is exactly the collapse this checks for.
        hard.availabilityCollapse += 1;
        cellOk = false;
        fail("availability defect", `${expected.dimensionId}/${expected.side}: display must not contain "${needle}"`);
      }
    }

    if (expected.citationDocumentId !== undefined) {
      for (const citation of cell.citations) {
        if (citation.documentId !== expected.citationDocumentId) {
          hard.wrongCitationDocument += 1;
          cellOk = false;
          fail("citation-ID defect", `${expected.dimensionId}/${expected.side}: cites ${citation.documentId}`);
        }
      }
    }
    if (expected.citationPages !== undefined) {
      const pages = [...new Set(cell.citations.map((c) => c.pageStart))].sort((a, b) => a - b);
      if (JSON.stringify(pages) !== JSON.stringify([...expected.citationPages].sort((a, b) => a - b))) {
        hard.wrongCitationPage += 1;
        cellOk = false;
        fail("source-map defect", `${expected.dimensionId}/${expected.side}: pages ${pages.join(",")}, expected ${expected.citationPages.join(",")}`);
      }
    }
    for (const needle of expected.citationQuoteIncludes ?? []) {
      if (!cell.citations.some((c) => c.quote.includes(needle))) {
        hard.invalidCitationQuote += 1;
        cellOk = false;
        fail("source-map defect", `${expected.dimensionId}/${expected.side}: no citation quote contains "${needle}"`);
      }
    }

    if (cellOk) counts.cellsCorrect += 1;
  }

  // --- observations --------------------------------------------------------
  const knownCitationIds = new Set(
    draft.dimensions.flatMap((r) => r.cells.flatMap((c) => c.citations.map((x) => x.citationId))),
  );
  for (const observation of draft.observations) {
    for (const id of observation.citationIds) {
      if (!knownCitationIds.has(id)) {
        hard.wrongObservationInputs += 1;
        fail("observation defect", `${observation.type} cites unknown ${id}`);
      }
    }
    for (const ref of observation.factRefs) {
      const row = draft.dimensions.find((r) => r.dimensionId === ref.dimensionId);
      const cell = row?.cells.find((c) => c.productId === ref.productId);
      if (!cell) {
        hard.wrongObservationInputs += 1;
        fail("observation defect", `${observation.type} references missing ${ref.dimensionId}/${ref.productId}`);
      } else if (cell.availability !== "available" && cell.availability !== "not_applicable") {
        hard.wrongObservationInputs += 1;
        fail("observation defect", `${observation.type} built on a ${cell.availability} cell`);
      }
    }
  }
  for (const expected of evalCase.expectedObservations) {
    counts.observationsChecked += 1;
    const actual = draft.observations.find((o) => o.type === expected.type);
    if (!actual) {
      fail("observation defect", `missing observation ${expected.type}`);
      continue;
    }
    let ok = true;
    if (expected.severity !== undefined && actual.severity !== expected.severity) {
      ok = false;
      fail("observation defect", `${expected.type}: severity ${actual.severity}`);
    }
    for (const productId of expected.factProductIds ?? []) {
      if (!actual.factRefs.some((r) => r.productId === productId)) {
        ok = false;
        hard.wrongObservationInputs += 1;
        fail("observation defect", `${expected.type}: no fact ref for ${productId}`);
      }
    }
    for (const dimensionId of expected.factDimensionIds ?? []) {
      if (!actual.factRefs.some((r) => r.dimensionId === dimensionId)) {
        ok = false;
        hard.wrongObservationInputs += 1;
        fail("observation defect", `${expected.type}: no fact ref for ${dimensionId}`);
      }
    }
    if (expected.minimumCitations !== undefined && actual.citationIds.length < expected.minimumCitations) {
      ok = false;
      hard.wrongObservationInputs += 1;
      fail("observation defect", `${expected.type}: ${actual.citationIds.length} citations`);
    }
    const text = `${actual.textZh}\n${actual.textEn}`;
    for (const needle of expected.textIncludes ?? []) {
      if (!text.includes(needle)) {
        ok = false;
        fail("observation defect", `${expected.type}: text missing "${needle}"`);
      }
    }
    for (const needle of expected.textExcludes ?? []) {
      if (text.toLowerCase().includes(needle.toLowerCase())) {
        ok = false;
        fail("observation defect", `${expected.type}: text must not contain "${needle}"`);
      }
    }
    if (ok) counts.observationsCorrect += 1;
  }
  for (const type of evalCase.forbiddenObservations) {
    counts.observationsChecked += 1;
    if (draft.observations.some((o) => o.type === type)) {
      fail("observation defect", `unsupported observation produced: ${type}`);
    } else {
      counts.observationsCorrect += 1;
    }
  }

  // --- client context, missing info, review flags --------------------------
  if (evalCase.expectedReplacementContext !== null) {
    const actual = draft.clientContext?.replacementContext ?? false;
    if (actual !== evalCase.expectedReplacementContext) {
      fail("client-context defect", `replacementContext ${actual}`);
    }
  }
  const missingFields = new Set(draft.missingClientInformation.map((m) => m.field));
  if (evalCase.expectedMissingClientInfo !== null) {
    for (const field of evalCase.expectedMissingClientInfo) {
      counts.missingInfoChecked += 1;
      if (missingFields.has(field)) counts.missingInfoCorrect += 1;
      else fail("client-context defect", `missing-info absent: ${field}`);
    }
    if (evalCase.expectedMissingClientInfo.length === 0 && missingFields.size > 0) {
      fail("client-context defect", `expected no client gaps, got ${[...missingFields].join(",")}`);
    }
  }
  for (const field of evalCase.forbiddenMissingClientInfo) {
    counts.missingInfoChecked += 1;
    if (missingFields.has(field)) fail("client-context defect", `unsupported missing-info: ${field}`);
    else counts.missingInfoCorrect += 1;
  }

  const flags = new Set(draft.reviewReasons);
  for (const flag of evalCase.expectedReviewReasons) {
    counts.reviewChecked += 1;
    if (flags.has(flag)) counts.reviewCorrect += 1;
    else fail("review-flag defect", `missing review flag ${flag}`);
  }
  for (const flag of evalCase.forbiddenReviewReasons) {
    counts.reviewChecked += 1;
    if (flags.has(flag)) fail("review-flag defect", `unsupported review flag ${flag}`);
    else counts.reviewCorrect += 1;
  }

  // --- boundaries ----------------------------------------------------------
  // Structured first: the engine exposes no ranking field at all, and the
  // production predicate decides what counts as a recommendation.
  const text = renderedText(draft);
  if ("ranking" in draft || "score" in draft || "winner" in draft) {
    hard.recommendationViolations += 1;
    fail("boundary defect", "draft exposes a ranking-like field");
  }
  for (const line of text.split("\n")) {
    if (isRecommendationConclusion(line)) {
      hard.recommendationViolations += 1;
      fail("boundary defect", `recommendation conclusion rendered: ${line.slice(0, 70)}`);
    }
  }
  for (const needle of evalCase.forbiddenText) {
    if (text.toLowerCase().includes(needle.toLowerCase())) {
      const isGuarantee = /guarantee|保证/i.test(needle);
      if (isGuarantee) hard.guaranteeViolations += 1;
      else hard.recommendationViolations += 1;
      fail("boundary defect", `forbidden text present: ${needle}`);
    }
  }

  return {
    id: evalCase.id,
    category: evalCase.category,
    productAId: evalCase.productAId,
    productBId: evalCase.productBId,
    clientCaseId: evalCase.clientCaseId,
    pass: failures.length === 0,
    failures,
    counts,
    hardCounts: hard,
    latencyMs,
    error: null,
  };
}

export function failedComparisonCase(evalCase: ComparisonCase, message: string): CaseEvaluation {
  return {
    id: evalCase.id,
    category: evalCase.category,
    productAId: evalCase.productAId,
    productBId: evalCase.productBId,
    clientCaseId: evalCase.clientCaseId,
    pass: false,
    failures: [{ category: "generation failure", detail: message }],
    counts: {
      cellsChecked: 0, cellsCorrect: 0, availabilityChecked: 0, availabilityCorrect: 0,
      citationsChecked: 0, citationsCorrect: 0, observationsChecked: 0, observationsCorrect: 0,
      missingInfoChecked: 0, missingInfoCorrect: 0, reviewChecked: 0, reviewCorrect: 0,
    },
    hardCounts: emptyHard(),
    latencyMs: 0,
    error: message,
  };
}

export function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}
