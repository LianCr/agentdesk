import type { ComparisonDraftView, UiCitation } from "./types";

// Documented differences, not warnings. `informational` and `review_note` are
// the only two severities the engine emits; neither says a product is worse.

const SEVERITY = {
  informational: {
    labelZh: "文档差异",
    labelEn: "Documented difference",
    className: "border-slate-200 bg-white",
  },
  review_note: {
    labelZh: "需审核的文档差异",
    labelEn: "Documented difference · review note",
    className: "border-amber-200 bg-amber-50",
  },
} as const;

export function ObservationList({ draft }: { draft: ComparisonDraftView }) {
  if (draft.observations.length === 0) return null;

  const byId = new Map<string, UiCitation>();
  for (const row of draft.dimensions) {
    for (const cell of row.cells) {
      for (const citation of cell.citations) byId.set(citation.citationId, citation);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-slate-800">
        已记录的差异 <span className="font-normal text-slate-500">· Documented differences</span>
      </h2>
      <ul data-testid="observation-list" className="flex flex-col gap-3">
        {draft.observations.map((observation) => {
          const severity = SEVERITY[observation.severity];
          const citations = observation.citationIds
            .map((id) => byId.get(id))
            .filter((c): c is UiCitation => c !== undefined);
          return (
            <li
              key={observation.observationId}
              data-testid="observation-card"
              data-observation-type={observation.type}
              className={`rounded-lg border p-5 shadow-sm ${severity.className}`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {severity.labelZh} · {severity.labelEn}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">{observation.textZh}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{observation.textEn}</p>
              {citations.length > 0 && (
                <ul data-testid="observation-sources" className="mt-3 flex flex-wrap gap-2">
                  {citations.map((citation) => (
                    <li key={citation.citationId}>
                      <a
                        data-testid="observation-source-link"
                        href={draft.citationUrls[citation.citationId] ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
                        title={citation.quote}
                      >
                        <span className="whitespace-nowrap">{citation.productName}</span>
                <span className="ml-1 whitespace-nowrap">· p. {citation.pageStart} ↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
