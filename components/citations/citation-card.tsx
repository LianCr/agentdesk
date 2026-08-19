import type { Citation } from "../chat/types";

function pageLabel(citation: Citation): string {
  if (citation.pageEnd > citation.pageStart) {
    return `第\u00a0${citation.pageStart}\u2011${citation.pageEnd}\u00a0页 · Pages\u00a0${citation.pageStart}\u2011${citation.pageEnd}`;
  }
  return `第\u00a0${citation.pageStart}\u00a0页 · Page\u00a0${citation.pageStart}`;
}

export function CitationCard({ citation }: { citation: Citation }) {
  return (
    <article
      data-testid="citation-card"
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span
          data-testid="citation-product"
          className="text-sm font-semibold text-[var(--brand)]"
        >
          {citation.productName}
        </span>
        <span data-testid="citation-page" className="text-xs text-slate-500">
          {pageLabel(citation)}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span data-testid="citation-document" className="text-xs text-slate-600">
          {citation.documentName}
        </span>
        <span data-testid="citation-section" className="text-xs text-slate-500">
          {citation.section}
        </span>
      </div>
      <blockquote
        data-testid="citation-quote"
        lang="en"
        className="min-w-0 break-words border-l-2 border-slate-300 pl-3 text-sm italic leading-relaxed text-slate-700"
      >
        {citation.quote}
      </blockquote>
      {citation.sourceUrl !== null && (
        <a
          data-testid="citation-link"
          href={citation.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex w-fit items-center text-sm font-medium text-[var(--brand)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          打开原文第 {citation.pageStart} 页 Open source page ↗
        </a>
      )}
    </article>
  );
}
