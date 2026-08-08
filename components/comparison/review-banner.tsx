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
    <section
      data-testid="review-banner"
      role="note"
      className="rounded-lg border border-amber-200 bg-amber-50 p-5"
    >
      <p className="text-sm font-semibold text-amber-900">需要经纪人审核 · Agent review required</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {reasons.map((reason) => {
          const flag = REVIEW_FLAG_DEFINITIONS[reason as ReviewFlag] as
            | (typeof REVIEW_FLAG_DEFINITIONS)[ReviewFlag]
            | undefined;
          return (
            <li
              key={reason}
              data-testid="review-reason"
              data-flag={reason}
              className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-amber-900"
            >
              {flag ? `${flag.labelZh} · ${flag.labelEn}` : reason}
              {flag && (
                <span className="ml-1 text-amber-700/70">
                  ({flag.kind === "demo_business_rule" ? "本 Demo 规则 demo policy" : "文档事实 document fact"})
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-amber-800">
        标注为「本 Demo 规则」的条目是本演示项目的业务政策，不是普遍法律义务。
        <br />
        Items marked “demo policy” are this demonstration&apos;s business rules, not universal legal requirements.
      </p>
    </section>
  );
}
