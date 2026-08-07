import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface ExtractedPdf {
  numPages: number;
  pageTexts: string[];
}

// Extracts selectable text per page. Used by manifest generation (page
// counts) and PDF validation (fact/omission/footer checks).
export async function extractPdf(path: string): Promise<ExtractedPdf> {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  await doc.destroy();
  return { numPages: doc.numPages, pageTexts };
}

// Normalization shared by fact matching and omission scanning so template
// spacing, dash variants and case differences cannot cause false results.
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
