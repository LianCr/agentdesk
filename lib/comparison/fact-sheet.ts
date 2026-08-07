import type { Citation } from "../rag/types";
import type { ChunkRecord } from "../ingestion/types";
import type { ProductDefinition } from "../schemas";
import {
  DIMENSIONS,
  NOT_APPLICABLE_DISPLAY,
  NOT_PROVIDED_DISPLAY,
  type DimensionId,
} from "./dimensions";
import { runDerivation } from "./derivations";
import { findFactRule, type FactPart, type FactRule } from "./fact-registry";
import { isNonFactKey, parseProductFacts, readFactPath } from "./product-facts";
import { CitationCollector, findEvidenceChunk } from "./source-map";
import {
  FACT_REGISTRY_VERSION,
  type ComparisonCell,
  type ProductFactSheet,
  type ProductRef,
} from "./types";

// Resolves ONE product into a cell per dimension. There is deliberately no
// A-vs-B assembler here — pairing two products is M4-B. Everything below is
// deterministic: same product definition + same chunks ⇒ byte-identical sheet.

const LABEL_SEPARATOR = " · ";

function labelled(part: { labelZh?: string; labelEn?: string }, text: string): string {
  if (part.labelZh && part.labelEn) return `${part.labelZh} ${part.labelEn}: ${text}`;
  if (part.labelZh) return `${part.labelZh}: ${text}`;
  if (part.labelEn) return `${part.labelEn}: ${text}`;
  return text;
}

interface ResolvedPart {
  displayText: string;
  rawValue: unknown;
  citation: Citation;
  candidateCount: number;
  page: number;
}

type PartOutcome = { ok: true; part: ResolvedPart } | { ok: false; reason: string; page: number | null; candidateCount: number };

function resolvePart(
  product: ProductDefinition,
  facts: Record<string, unknown>,
  chunks: readonly ChunkRecord[],
  part: FactPart,
  collector: CitationCollector,
): PartOutcome {
  for (const path of [part.valuePath, part.displayPath, part.quotePath ?? part.displayPath]) {
    if (isNonFactKey(path)) {
      return { ok: false, reason: `NON_FACT_KEY: ${path}`, page: null, candidateCount: 0 };
    }
  }

  const rawValue = readFactPath(facts, part.valuePath);
  if (rawValue === undefined) {
    return { ok: false, reason: `VALUE_PATH_MISSING: ${part.valuePath}`, page: null, candidateCount: 0 };
  }
  const displayText = readFactPath(facts, part.displayPath);
  if (typeof displayText !== "string" || displayText.length === 0) {
    return { ok: false, reason: `DISPLAY_PATH_INVALID: ${part.displayPath}`, page: null, candidateCount: 0 };
  }
  const quote = readFactPath(facts, part.quotePath ?? part.displayPath);
  if (typeof quote !== "string" || quote.length === 0) {
    return {
      ok: false,
      reason: `QUOTE_PATH_INVALID: ${part.quotePath ?? part.displayPath}`,
      page: null,
      candidateCount: 0,
    };
  }

  const outcome = findEvidenceChunk(product, facts, chunks, {
    quote,
    anchor: part.anchor,
    expectedSectionIncludes: part.expectedSectionIncludes,
    expectedChunkType: part.expectedChunkType,
  });
  if (!outcome.ok) {
    return { ok: false, reason: outcome.reason, page: outcome.page, candidateCount: outcome.candidateCount };
  }

  return {
    ok: true,
    part: {
      displayText: labelled(part, displayText),
      rawValue,
      citation: collector.add(outcome.chunk, quote),
      candidateCount: outcome.candidateCount,
      page: outcome.page,
    },
  };
}

function expandListParts(facts: Record<string, unknown>, rule: FactRule): FactPart[] {
  if (rule.kind !== "direct" || !rule.list) return [];
  const items = readFactPath(facts, rule.list.arrayPath);
  if (!Array.isArray(items)) return [];
  return items.map((_, index) => {
    const base = `${rule.list!.arrayPath}[${index}]`;
    const valuePath = rule.list!.itemValuePath ? `${base}.${rule.list!.itemValuePath}` : base;
    const displayPath = rule.list!.itemDisplayPath ? `${base}.${rule.list!.itemDisplayPath}` : base;
    return {
      valuePath,
      displayPath,
      anchor: rule.list!.anchor,
      expectedSectionIncludes: rule.list!.expectedSectionIncludes,
    };
  });
}

function conflictCell(
  dimensionId: DimensionId,
  productId: string,
  rule: FactRule,
  reason: string,
  pages: number[],
  candidateCount: number,
): ComparisonCell {
  return {
    dimensionId,
    productId,
    availability: "conflict",
    format: rule.kind === "direct" || rule.kind === "derived" ? rule.format : "text",
    sourceKind: rule.kind === "derived" ? "derived" : "direct",
    displayValue: null, // a conflicted value must never surface as a verified fact
    rawValue: null,
    derivation: null,
    citations: [],
    conflictReason: reason,
    diagnostics: { candidateChunkCount: candidateCount, anchorPages: pages, evidenceQuoteCount: 0 },
  };
}

function resolveCell(
  product: ProductDefinition,
  facts: Record<string, unknown>,
  chunks: readonly ChunkRecord[],
  dimensionId: DimensionId,
  collector: CitationCollector,
): ComparisonCell {
  const rule = findFactRule(dimensionId, product.productCategory);
  if (!rule) {
    return conflictCell(dimensionId, product.documentId, {
      kind: "direct", dimensionId, productCategory: product.productCategory, format: "text",
    } as FactRule, `NO_RULE: ${dimensionId}/${product.productCategory}`, [], 0);
  }

  if (rule.kind === "not_applicable" || rule.kind === "not_provided") {
    // Category rules and absence statements never fabricate a citation.
    return {
      dimensionId,
      productId: product.documentId,
      availability: rule.kind,
      format: "text",
      sourceKind: "direct",
      displayValue: rule.kind === "not_applicable" ? NOT_APPLICABLE_DISPLAY : NOT_PROVIDED_DISPLAY,
      rawValue: null,
      derivation: null,
      citations: [],
      conflictReason: null,
      diagnostics: { candidateChunkCount: 0, anchorPages: [], evidenceQuoteCount: 0 },
    };
  }

  const parts: FactPart[] =
    rule.kind === "direct"
      ? [...(rule.parts ?? []), ...expandListParts(facts, rule)]
      : [...rule.evidence, ...(rule.parts ?? [])];
  if (parts.length === 0) {
    return conflictCell(dimensionId, product.documentId, rule, "RULE_HAS_NO_PARTS", [], 0);
  }

  const resolved: ResolvedPart[] = [];
  for (const part of parts) {
    const outcome = resolvePart(product, facts, chunks, part, collector);
    if (!outcome.ok) {
      return conflictCell(
        dimensionId, product.documentId, rule, outcome.reason,
        outcome.page === null ? [] : [outcome.page], outcome.candidateCount,
      );
    }
    resolved.push(outcome.part);
  }

  const citations = resolved.map((r) => r.citation);
  const candidateChunkCount = Math.max(...resolved.map((r) => r.candidateCount));
  const anchorPages = [...new Set(resolved.map((r) => r.page))].sort((a, b) => a - b);

  if (rule.kind === "derived") {
    const inputs = rule.inputPaths.map((path) => readFactPath(facts, path));
    let derived;
    try {
      derived = runDerivation(rule.ruleId, inputs);
    } catch (err) {
      return conflictCell(
        dimensionId, product.documentId, rule,
        err instanceof Error ? err.message : "DERIVATION_FAILED", anchorPages, candidateChunkCount,
      );
    }
    // Reconcile against the structured counterpart when one exists. A
    // mismatch is a conflict — neither the table nor the scalar silently wins.
    if (rule.reconcileWithPath !== undefined) {
      const structured = readFactPath(facts, rule.reconcileWithPath);
      if (structured !== undefined && structured !== derived.rawValue) {
        return conflictCell(
          dimensionId, product.documentId, rule,
          `DERIVATION_RECONCILE_MISMATCH: ${rule.reconcileWithPath}=${String(structured)} vs derived=${derived.rawValue}`,
          anchorPages, candidateChunkCount,
        );
      }
    }
    const context = resolved.slice(rule.evidence.length).map((r) => r.displayText);
    return {
      dimensionId,
      productId: product.documentId,
      availability: "available",
      format: rule.format,
      sourceKind: "derived",
      displayValue: [`${derived.displayZh} ${derived.displayEn}`, ...context].join(LABEL_SEPARATOR),
      rawValue: derived.rawValue,
      derivation: {
        ruleId: rule.ruleId,
        inputFactRefs: [...rule.inputPaths],
        reconciledWithPath: rule.reconcileWithPath ?? null,
      },
      citations,
      conflictReason: null,
      diagnostics: { candidateChunkCount, anchorPages, evidenceQuoteCount: citations.length },
    };
  }

  // Multi-part cells key their structured values by fact path, never by
  // position: an observation rule must ask for `initialRate.guaranteeYears`,
  // not "the first number in the array". Positional access is how a floor
  // rate gets read as a guarantee period.
  const rawValue =
    resolved.length === 1
      ? resolved[0]!.rawValue
      : Object.fromEntries(parts.map((part, index) => [part.valuePath, resolved[index]!.rawValue]));
  return {
    dimensionId,
    productId: product.documentId,
    availability: "available",
    format: rule.format,
    sourceKind: "direct",
    displayValue: resolved.map((r) => r.displayText).join(LABEL_SEPARATOR),
    rawValue,
    derivation: null,
    citations,
    conflictReason: null,
    diagnostics: { candidateChunkCount, anchorPages, evidenceQuoteCount: citations.length },
  };
}

export function productRef(product: ProductDefinition): ProductRef {
  return {
    documentId: product.documentId,
    documentName: product.documentName,
    productName: product.productName,
    productCategory: product.productCategory,
  };
}

export function buildProductFactSheet(
  product: ProductDefinition,
  chunks: readonly ChunkRecord[],
): ProductFactSheet {
  const facts = parseProductFacts(product);
  const collector = new CitationCollector();
  const cells = DIMENSIONS.map((d) =>
    resolveCell(product, facts, chunks, d.dimensionId, collector),
  );
  return {
    schemaVersion: 1,
    product: productRef(product),
    cells,
    factRegistryVersion: FACT_REGISTRY_VERSION,
  };
}
