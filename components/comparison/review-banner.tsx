import { REVIEW_FLAG_DEFINITIONS } from "../../lib/reviews/flag-presentation";
import type { ReviewFlag } from "../../lib/comparison/types";

// Why this draft needs a human. The wording comes from the one presentation
// source shared with the review page and the CLI — a reviewer who saw one
// phrasing here and another on the review would be looking at two systems.
//
// This component says nothing about workflow routing or approval level; that
// is the review page's WorkflowBanner. Here a flag is only a reason.

export function ReviewBanner({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <section data-testid="review-banner" role="note" className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-amber-900">
        需要经纪人审核 · Agent review required
        <span className="ml-2 text-xs font-normal text-amber-800">
          原因 {reasons.length} 项 · {reasons.length} {reasons.length === 1 ? "reason" : "reasons"}
        </span>
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {reasons.map((reason) => {
          const flag = REVIEW_FLAG_DEFINITIONS[reason as ReviewFlag] as
            | (typeof REVIEW_FLAG_DEFINITIONS)[ReviewFlag]
            | undefined;
          return (
            <li
              key={reason}
              data-testid="review-reason"
              data-flag={reason}
              className="inline-flex flex-wrap items-baseline gap-x-2 rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800"
            >
              <span data-register="zh" className="whitespace-nowrap font-medium">
                {flag ? flag.labelZh : reason}
              </span>
              {flag && (
                <span data-register="en" className="text-[11px] text-slate-600">
                  {flag.labelEn}
                </span>
              )}
              {flag && (
                <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  {flag.kind === "demo_business_rule" ? "本 Demo 规则 demo policy" : "文档事实 document fact"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] leading-relaxed text-slate-500">
        标注为「本 Demo 规则」的条目是本演示项目的业务政策，不是普遍法律义务。
        <br />
        Items marked “demo policy” are this demonstration&apos;s business rules, not universal legal requirements.
      </p>
    </section>
  );
}
