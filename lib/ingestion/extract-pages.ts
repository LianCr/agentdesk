import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Structured per-page line extraction. Text items are grouped into lines by
// their rounded y coordinate, ordered x-ascending within a line and
// y-descending across lines — the reading order for this single-column
// corpus. Line height (max item height) drives deterministic classification:
// >=14pt page heading, ~11.5pt subsection, <=9.5pt fine print / footer.

export interface ExtractedLine {
  text: string;
  height: number;
  y: number;
}

export interface StructuredPage {
  page: number; // 1-based physical PDF page
  lines: ExtractedLine[];
}

export async function extractStructuredPages(pdfPath: string): Promise<StructuredPage[]> {
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await getDocument({ data }).promise;
  const pages: StructuredPage[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map<number, { height: number; parts: Array<{ x: number; str: string }> }>();
    for (const item of content.items) {
      if (!("str" in item) || item.str.trim() === "") continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const line = byY.get(y) ?? { height: 0, parts: [] };
      line.height = Math.max(line.height, item.height);
      line.parts.push({ x, str: item.str });
      byY.set(y, line);
    }
    const lines = [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, line]) => ({
        y,
        height: line.height,
        text: line.parts
          .sort((a, b) => a.x - b.x)
          .map((part) => part.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      }))
      .filter((line) => line.text !== "");
    pages.push({ page: p, lines });
  }
  await doc.destroy();
  return pages;
}
