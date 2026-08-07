import type { ComparisonDraft } from "./types";

// Public PDF links for a draft's citations. Code-owned: the model never
// produces a URL, and the map is built from the verified manifest rather than
// from anything a caller supplied.

export type ComparisonDraftWithUrls = ComparisonDraft & {
  citationUrls: Record<string, string>; // citationId -> /documents/<file>#page=N
};

export function withCitationUrls(
  draft: ComparisonDraft,
  fileByDocumentId: ReadonlyMap<string, string>,
): ComparisonDraftWithUrls {
  const citationUrls: Record<string, string> = {};
  for (const row of draft.dimensions) {
    for (const cell of row.cells) {
      for (const citation of cell.citations) {
        const file = fileByDocumentId.get(citation.documentId);
        if (file) citationUrls[citation.citationId] = `/documents/${file}#page=${citation.pageStart}`;
      }
    }
  }
  return { ...draft, citationUrls };
}
