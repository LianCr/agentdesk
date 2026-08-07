import type { ChunkRecord, DocumentCoverage, PageRecord } from "./types.js";

// Independent verification of the line-partition invariant: every clean line
// of every page must appear in exactly one chunk of that page. This is a
// second opinion on chunk-document's internal bookkeeping — it works purely
// from the emitted records, so a bug in the chunker's index tracking cannot
// hide a lost disclosure or a dropped sentence.

export function computeCoverage(
  documentId: string,
  pageRecords: PageRecord[],
  chunkRecords: ChunkRecord[],
): DocumentCoverage {
  let unaccountedLines = 0;
  let cleanLineTotal = 0;

  for (const page of pageRecords) {
    const pageLines = page.cleanText.split("\n");
    cleanLineTotal += pageLines.length;
    const counts = new Map<string, number>();
    for (const line of pageLines) counts.set(line, (counts.get(line) ?? 0) + 1);

    for (const chunk of chunkRecords.filter((c) => c.pageStart === page.page)) {
      for (const line of chunk.content.split("\n")) {
        const n = counts.get(line);
        if (n === undefined || n === 0) unaccountedLines++; // extra line not from this page
        else counts.set(line, n - 1);
      }
    }
    for (const remaining of counts.values()) unaccountedLines += remaining; // lost lines
  }

  const chunksByType = { text: 0, table: 0, disclosure: 0 };
  for (const c of chunkRecords) chunksByType[c.chunkType]++;

  const rawChars = pageRecords.reduce((s, p) => s + p.rawText.length, 0);
  const excludedFooterChars = pageRecords.reduce(
    (s, p) => s + p.excludedText.reduce((t, e) => t + e.length, 0),
    0,
  );
  const cleanChars = pageRecords.reduce((s, p) => s + p.cleanText.length, 0);
  const chunkChars = chunkRecords.reduce((s, c) => s + c.content.length, 0);

  return {
    documentId,
    pages: pageRecords.length,
    chunks: chunkRecords.length,
    chunksByType,
    rawChars,
    excludedFooterChars,
    cleanChars,
    chunkChars,
    unaccountedLines,
    coveragePercent:
      cleanLineTotal === 0 ? 0 : ((cleanLineTotal - unaccountedLines) / cleanLineTotal) * 100,
  };
}

export function assertFullCoverage(coverage: DocumentCoverage): void {
  if (coverage.unaccountedLines !== 0 || coverage.coveragePercent !== 100) {
    throw new Error(
      `${coverage.documentId}: coverage failure — ${coverage.unaccountedLines} unaccounted lines ` +
        `(${coverage.coveragePercent.toFixed(2)}%)`,
    );
  }
}
