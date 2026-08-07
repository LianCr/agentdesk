import { quoteMatchesChunk } from "../citations/build";
import { normalizeText } from "../pdf-text";
import type { ChunkRecord } from "../ingestion/types";
import type { ProductDefinition } from "../schemas";
import { DIMENSIONS } from "./dimensions";
import { findFactRule } from "./fact-registry";
import { isNonFactKey } from "./product-facts";
import { DERIVATION_RULE_IDS, type ComparisonCell, type ProductFactSheet } from "./types";

// Deterministic integrity checks over a resolved fact sheet. This is the
// comparison counterpart of assertRenderedAnswer: the contract is the same
// (nothing factual surfaces without traceable evidence), the implementation is
// cell-wise because a table is not prose.

const NUMERIC_RE = /[\d％%$¥]/;
// Product names carrying digits must not make a cell "numeric" on their own.
const PRODUCT_NAME_DIGITS = /(demo\s+)?(termplus\s*20|securerate\s*5|indexflex\s*ul)/gi;

function hasNumericContent(text: string): boolean {
  return NUMERIC_RE.test(text.replace(PRODUCT_NAME_DIGITS, " "));
}

function isNegativeFact(cell: ComparisonCell): boolean {
  return cell.rawValue === false || (Array.isArray(cell.rawValue) && cell.rawValue.includes(false));
}

export function assertFactSheetIntegrity(
  sheet: ProductFactSheet,
  product: ProductDefinition,
  chunks: readonly ChunkRecord[],
): void {
  const errors: string[] = [];
  const chunkById = new Map(chunks.map((c) => [c.chunkId, c]));
  const omissionRegexes = product.omissionPatterns.map((p) => new RegExp(p.pattern, p.flags ?? ""));

  if (sheet.product.documentId !== product.documentId) {
    errors.push(`sheet product ${sheet.product.documentId} != ${product.documentId}`);
  }
  if (sheet.cells.length !== DIMENSIONS.length) {
    errors.push(`expected ${DIMENSIONS.length} cells, got ${sheet.cells.length}`);
  }
  // Dimension order is part of the contract: a comparison must not reorder
  // rows between products or between runs.
  sheet.cells.forEach((cell, index) => {
    if (cell.dimensionId !== DIMENSIONS[index]?.dimensionId) {
      errors.push(`cell ${index} is ${cell.dimensionId}, expected ${DIMENSIONS[index]?.dimensionId}`);
    }
  });

  for (const cell of sheet.cells) {
    const where = `${cell.dimensionId}/${cell.productId}`;

    if (cell.productId !== product.documentId) {
      errors.push(`${where}: cell bound to the wrong product`);
    }

    // A rule must exist for this product's category, and the rule that
    // produced the cell must be the one declared for that category.
    const rule = findFactRule(cell.dimensionId, product.productCategory);
    if (!rule) {
      errors.push(`${where}: no registry rule for category ${product.productCategory}`);
    } else if (rule.kind === "derived" && cell.availability === "available" && cell.sourceKind !== "derived") {
      errors.push(`${where}: derived rule produced a cell marked ${cell.sourceKind}`);
    } else if (rule.kind === "direct" && cell.availability === "available" && cell.sourceKind !== "direct") {
      errors.push(`${where}: direct rule produced a cell marked ${cell.sourceKind}`);
    }

    switch (cell.availability) {
      case "available": {
        if (cell.citations.length === 0) {
          errors.push(`${where}: available fact without a citation`);
        }
        if (cell.displayValue === null) {
          errors.push(`${where}: available fact without a display value`);
        } else if (hasNumericContent(cell.displayValue) && cell.citations.length === 0) {
          errors.push(`${where}: numeric value without a citation`);
        }
        if (isNegativeFact(cell) && cell.citations.length === 0) {
          errors.push(`${where}: negative product fact without a citation`);
        }
        break;
      }
      case "not_applicable":
      case "not_provided": {
        if (cell.citations.length > 0) {
          errors.push(`${where}: ${cell.availability} must not carry citations`);
        }
        if (cell.rawValue !== null) {
          errors.push(`${where}: ${cell.availability} must not carry a raw value`);
        }
        break;
      }
      case "conflict": {
        // Fail closed: a conflict may never look like a verified fact.
        if (cell.displayValue !== null) errors.push(`${where}: conflict must not expose a display value`);
        if (cell.citations.length > 0) errors.push(`${where}: conflict must not carry citations`);
        if (cell.conflictReason === null) errors.push(`${where}: conflict without a reason`);
        break;
      }
    }

    for (const citation of cell.citations) {
      if (citation.documentId !== cell.productId) {
        errors.push(`${where}: citation ${citation.citationId} cites ${citation.documentId}`);
        continue;
      }
      const chunk = chunkById.get(citation.chunkId);
      if (!chunk) {
        errors.push(`${where}: citation ${citation.citationId} references unknown chunk ${citation.chunkId}`);
        continue;
      }
      if (chunk.documentId !== cell.productId) {
        errors.push(`${where}: chunk ${chunk.chunkId} belongs to ${chunk.documentId}`);
      }
      if (citation.pageStart !== chunk.pageStart || citation.pageEnd !== chunk.pageEnd) {
        errors.push(`${where}: citation ${citation.citationId} page does not match its chunk`);
      }
      if (!quoteMatchesChunk(chunk, citation.quote)) {
        errors.push(`${where}: citation ${citation.citationId} quote is not in its chunk`);
      }
      if (
        cell.diagnostics.anchorPages.length > 0 &&
        !cell.diagnostics.anchorPages.some((page) => chunk.pageStart <= page && chunk.pageEnd >= page)
      ) {
        errors.push(`${where}: citation ${citation.citationId} is off every anchor page`);
      }
    }

    // Intentionally omitted content must never be presented as a fact.
    const rendered = `${cell.displayValue ?? ""} ${cell.citations.map((c) => c.quote).join(" ")}`;
    for (const [index, regex] of omissionRegexes.entries()) {
      regex.lastIndex = 0;
      if (regex.test(rendered)) {
        errors.push(`${where}: matches intentional omission "${product.omissionPatterns[index]!.description}"`);
      }
    }

    // Provenance must be internally consistent.
    if (cell.sourceKind === "derived") {
      if (cell.derivation === null) {
        if (cell.availability === "available") errors.push(`${where}: derived cell without a derivation`);
      } else {
        if (!(DERIVATION_RULE_IDS as readonly string[]).includes(cell.derivation.ruleId)) {
          errors.push(`${where}: unknown derivation rule ${cell.derivation.ruleId}`);
        }
        if (cell.derivation.inputFactRefs.length === 0) {
          errors.push(`${where}: derivation without input fact refs`);
        }
        for (const ref of cell.derivation.inputFactRefs) {
          if (isNonFactKey(ref)) errors.push(`${where}: derivation reads non-fact key ${ref}`);
        }
      }
    } else if (cell.derivation !== null) {
      errors.push(`${where}: direct cell carries a derivation`);
    }

    // Implementer-only notes can never reach output.
    if (normalizeText(rendered).includes("nonrenderedspecnotes")) {
      errors.push(`${where}: internal spec note leaked into output`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`COMPARISON_INTEGRITY: ${errors.join(" | ")}`);
  }
}
