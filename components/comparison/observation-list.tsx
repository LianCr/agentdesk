import { CitationPopover } from "./citation-popover";
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
              {/* Same quiet affordance as the table cells: one trigger, and the
                  quotes with their page deep-links live in the popover instead
                  of a row of bordered chips competing with the observation. */}
              <CitationPopover citations={citations} urls={draft.citationUrls} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
