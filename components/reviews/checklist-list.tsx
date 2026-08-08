import type { UiChecklistItem } from "./types";

// Decision support, not a form.
//
// There are deliberately no completion checkboxes: the backend stores no
// completion state, and a checkbox that forgets what you ticked the moment you
// reload is worse than no checkbox — it looks like a record and is not one.

const SOURCE_NOTE: Record<UiChecklistItem["sourceKind"], { zh: string; en: string }> = {
  fixture_checklist: {
    zh: "本演示替换情形要求",
    en: "Required by this demo's replacement scenario",
  },
  missing_client_info: {
    zh: "客户资料缺失",
    en: "Missing client information",
  },
  review_flag: {
    zh: "审核标记引出",
    en: "Raised by a review flag",
  },
};

export function ChecklistList({ items }: { items: UiChecklistItem[] }) {
  if (items.length === 0) {
    return (
      <section data-testid="review-checklist" className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">核对清单 · Review checklist</h2>
        <p data-testid="checklist-empty" className="mt-2 text-sm text-slate-600">
          本比较未绑定客户，因此没有客户相关的核对项。
          <br />
          No client is attached to this comparison, so there are no client-specific items.
        </p>
      </section>
    );
  }

  return (
    <section data-testid="review-checklist" className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">
        核对清单 · Review checklist <span className="font-normal text-slate-500">({items.length})</span>
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        供审核者判断参考，本阶段不记录勾选状态。
        For the reviewer&apos;s judgement; completion is not recorded at this stage.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.key}
            data-testid="checklist-item"
            data-source-kind={item.sourceKind}
            className="rounded border border-slate-200 px-3 py-2"
          >
            <p className="text-sm text-slate-800">
              {item.labelZh} · {item.labelEn}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {SOURCE_NOTE[item.sourceKind].zh} · {SOURCE_NOTE[item.sourceKind].en}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
