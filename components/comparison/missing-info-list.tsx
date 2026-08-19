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
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-800">
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
    <section data-testid="missing-info" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-slate-800">
        仍需确认的信息 <span className="font-normal text-slate-500">· Information still needed</span>
      </h2>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.field}
            data-testid="missing-info-item"
            data-field={item.field}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-800">{label(MISSING_FIELD_LABELS, item.field)}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.reasonZh}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.reasonEn}</p>
            <p className="mt-2 text-xs text-slate-500">
              <span data-register="zh" className="block whitespace-nowrap font-medium">
                影响 Affects
              </span>
              {label(REQUIRED_FOR_LABELS, item.requiredFor)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
