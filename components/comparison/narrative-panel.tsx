"use client";

import type { NarrativeStatus, UiNarrativeSection } from "./types";

// Secondary by construction: the table above is the product, this only
// restates what the table already proved. It never outranks the table
// visually and its absence is a calm sentence, not an error.

export function NarrativePanel({
  status,
  sections,
  loading,
  onLoad,
}: {
  status: NarrativeStatus;
  sections: UiNarrativeSection[];
  loading: boolean;
  onLoad: () => void;
}) {
  return (
    <section data-testid="narrative-panel" data-narrative-status={status} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium text-slate-700">
          基于已核验事实的说明 <span className="font-normal text-slate-500">· Documented explanation</span>
        </h2>
        {status !== "available" && (
          <button
            type="button"
            data-testid="load-narrative"
            onClick={onLoad}
            disabled={loading}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
          >
            {loading ? "生成中… Generating…" : "查看文字解读 Plain-language summary"}
          </button>
        )}
      </div>

      {status === "available" && sections.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
          {sections.map((section, index) => (
            <div key={`${section.headingEn}-${index}`} data-testid="narrative-section" className={index > 0 ? "mt-4" : ""}>
              <p className="text-sm font-medium text-slate-700">
                {section.headingZh} · {section.headingEn}
              </p>
              <p className="mt-1 leading-relaxed text-slate-700">{section.text}</p>
            </div>
          ))}
        </div>
      )}

      {(status === "unavailable" || status === "rejected") && (
        <p data-testid="narrative-unavailable" className="text-sm text-slate-500">
          比较表已生成；可选说明暂不可用。
          <br />
          The comparison table is complete. The optional explanation is currently unavailable.
        </p>
      )}
    </section>
  );
}
