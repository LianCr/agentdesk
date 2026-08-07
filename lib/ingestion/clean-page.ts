import { normalizeText } from "../pdf-text";
import type { ExtractedLine, StructuredPage } from "./extract-pages";

// Deterministic page cleaning. The ONLY removal is the exact per-page
// DEMONSTRATION footer (constructed via the same footerText() helper the
// templates use); everything else — disclosures, negative facts, the cover
// banner — is preserved verbatim. Removed lines are recorded in excludedText
// so coverage accounting can prove no body text was lost.

export interface CleanedPage {
  page: number;
  lines: ExtractedLine[]; // footer removed, per-line whitespace normalized
  rawText: string; // all lines pre-removal, joined with \n
  cleanText: string; // remaining lines joined with \n
  excludedText: string[];
}

export function cleanPage(structured: StructuredPage, expectedFooter: string): CleanedPage {
  const normalizedFooter = normalizeText(expectedFooter);
  const kept: ExtractedLine[] = [];
  const excluded: string[] = [];

  for (const line of structured.lines) {
    if (normalizeText(line.text) === normalizedFooter) {
      excluded.push(line.text);
    } else {
      kept.push(line);
    }
  }

  if (excluded.length !== 1) {
    throw new Error(
      `page ${structured.page}: expected exactly 1 footer line, matched ${excluded.length} ` +
        `(expected footer: "${expectedFooter}")`,
    );
  }

  const cleanText = kept.map((l) => l.text).join("\n");
  if (cleanText.length < 80) {
    throw new Error(
      `page ${structured.page}: clean text too short (${cleanText.length} chars) — ` +
        `empty or near-empty pages indicate an upstream failure`,
    );
  }

  return {
    page: structured.page,
    lines: kept,
    rawText: structured.lines.map((l) => l.text).join("\n"),
    cleanText,
    excludedText: excluded,
  };
}
