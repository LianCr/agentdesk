import { MISSING_FIELD_LABELS, REQUIRED_FOR_LABELS } from "../../lib/comparison/field-labels";
import type { UiMissingInfo } from "./types";

// What the agent still needs to ask. This is a checklist, not a verdict:
// nothing here says the client is unsuitable, and there is no risk score.

const label = (map: Record<string, { zh: string; en: string }>, key: string) =>
  map[key] ? `${map[key].zh} ${map[key].en}` : key;

export function MissingInfoList({ items, hasClient }: { items: UiMissingInfo[]; hasClient: boolean }) {
  if (!hasClient) {
    return (
      <section
        data-testid="missing-info"
        data-mode="no-client"
        className="rounded-lg border border-slate-200 bg-white p-5"
      >
        <h2 className="text-base font-semibold text-slate-800">
          仍需确认的信息 <span className="font-normal text-slate-500">· Information still needed</span>
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          本次为纯产品比较，未绑定演示客户，因此没有客户信息缺口。
          <br />
          No demo client is attached to this product-only comparison, so no client information is listed.
        </p>
      </section>
    );
  }
  if (items.length === 0) return null;

  return (
    <section id="missing" data-testid="missing-info" className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-slate-800">
        仍需确认的信息 ({items.length}){" "}
        <span className="font-normal text-slate-500">· Information still needed</span>
      </h2>
      {/* One line per gap. The plain-speech labels already carry the point; the
          reason expands on demand. Native <details> keeps this a server
          component and keyboard-accessible for free. This block can reach 13
          items on the replacement case -- as cards it was the densest thing on
          the page. */}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {items.map((item) => (
          <li key={item.field}>
            <details data-testid="missing-info-item" data-field={item.field} className="group">
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm marker:content-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-90">
                  ▸
                </span>
                <span className="font-medium text-slate-800">{label(MISSING_FIELD_LABELS, item.field)}</span>
                <span className="text-xs text-slate-500">
                  影响 Affects: {label(REQUIRED_FOR_LABELS, item.requiredFor)}
                </span>
              </summary>
              <div className="px-4 pb-3 pl-9">
                <p className="text-xs leading-relaxed text-slate-600">{item.reasonZh}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.reasonEn}</p>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
