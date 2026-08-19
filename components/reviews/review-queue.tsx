"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  APPROVAL_LEVEL_LABELS,
  REVIEW_STATE_LABELS,
  WORKFLOW_DECISION_LABELS,
  type ReviewState,
  type ReviewSummaryView,
} from "./types";

// Deliberately a plain list: no search, no pagination, no assignment, no teams.
// The demo has a handful of reviews and adding queue management would be
// building a product nobody asked for around a table of five rows.
//
// Rows come from the summary endpoint. The stored snapshots stay on the server
// until someone opens one.

const FILTERS: Array<{ value: "all" | ReviewState; zh: string; en: string }> = [
  { value: "all", zh: "全部", en: "All" },
  { value: "pending_review", zh: "待审核", en: "Pending" },
  { value: "approved", zh: "已批准", en: "Approved" },
  { value: "rejected", zh: "已拒绝", en: "Rejected" },
  { value: "revision_requested", zh: "要求修改", en: "Revision requested" },
];

const STATE_TONE: Record<ReviewState, string> = {
  pending_review: "bg-amber-50 text-amber-900 border-amber-200",
  approved: "bg-emerald-50 text-emerald-900 border-emerald-200",
  rejected: "bg-red-50 text-red-900 border-red-200",
  revision_requested: "bg-slate-100 text-slate-800 border-slate-300",
};

export function ReviewQueue() {
  // Pending first: it is the only filter where the list is a to-do list.
  const [filter, setFilter] = useState<"all" | ReviewState>("pending_review");
  const [reviews, setReviews] = useState<ReviewSummaryView[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (state: "all" | ReviewState) => {
    setReviews(null);
    setFailed(false);
    try {
      const response = await fetch(`/api/reviews?state=${state}`);
      const data = await response.json();
      if (!response.ok || !Array.isArray(data?.reviews)) {
        setFailed(true);
        return;
      }
      setReviews(data.reviews as ReviewSummaryView[]);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Review Queue</p>
        <h1 data-testid="review-queue-title" className="text-3xl font-semibold text-[var(--brand)]">
          审核队列
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          比较草稿送交人工审核后出现在这里。本演示没有登录，审核者标识为固定占位值，不构成任何身份保证。
          <br />
          Comparison drafts sent for human review appear here. This demo has no authentication; the
          reviewer label is a fixed placeholder and is not an identity guarantee.
        </p>
      </header>

      <div data-testid="queue-filters" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={`queue-filter-${option.value}`}
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              filter === option.value
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-[var(--brand)]"
            }`}
          >
            {option.zh} · {option.en}
          </button>
        ))}
      </div>

      <div data-testid="queue-region" aria-live="polite">
        {reviews === null && !failed && <p className="text-sm text-slate-600">载入中… Loading…</p>}
        {failed && (
          <p data-testid="queue-error" role="alert" className="text-sm text-red-800">
            读取审核队列时出现问题，请重试。Something went wrong loading the queue.
          </p>
        )}
        {reviews !== null && reviews.length === 0 && (
          <p data-testid="queue-empty" className="text-sm text-slate-600">
            该筛选条件下没有审核项。No reviews match this filter.
          </p>
        )}
        {reviews !== null && reviews.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table data-testid="queue-table" className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">审核项 Review</th>
                  <th className="px-4 py-3 font-medium">客户 Client</th>
                  <th className="px-4 py-3 font-medium">产品对 Products</th>
                  <th className="px-4 py-3 font-medium">状态 State</th>
                  <th className="px-4 py-3 font-medium">所需审核 Required</th>
                  <th className="px-4 py-3 font-medium">理由 Reasons</th>
                  <th className="px-4 py-3 font-medium">创建 Created</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr
                    key={review.reviewId}
                    data-testid="queue-row"
                    data-review-id={review.reviewId}
                    data-review-state={review.reviewState}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/review/${review.reviewId}`}
                        data-testid="queue-row-link"
                        // inline-block + padding: as bare inline text this was
                        // an 8-character tap target on a phone.
                        className="inline-block py-2 font-mono text-xs text-[var(--brand)] underline underline-offset-2"
                      >
                        {review.reviewId.replace(/^rev_/, "").slice(0, 8)}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {WORKFLOW_DECISION_LABELS[review.workflowDecision].en}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {review.clientDisplayName ?? "不绑定客户 · No client"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {review.productAName} × {review.productBName}
                    </td>
                    <td className="px-4 py-3">
                      {/* inline-block + nowrap: as a bare inline span the pill
                          broke into two half-pills whenever the label wrapped,
                          because borders and rounding apply per line box. The
                          table already scrolls horizontally, so it has room. */}
                      <span
                        data-testid="queue-state-badge"
                        className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${STATE_TONE[review.reviewState]}`}
                      >
                        {REVIEW_STATE_LABELS[review.reviewState].zh} ·{" "}
                        {REVIEW_STATE_LABELS[review.reviewState].en}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {APPROVAL_LEVEL_LABELS[review.requiredApprovalLevel].en}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{review.reviewReasonCount}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <time dateTime={review.createdAt}>{review.createdAt.slice(0, 16).replace("T", " ")}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
