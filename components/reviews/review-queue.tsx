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
  revision_requested: "bg-slate-100 text-slate-700 border-slate-300",
};

// Two registers, not one line.
//
// The rest of the product writes bilingual labels as `中文 · English` on a single
// line, which reads well in prose and falls apart in a scanning table: it doubles
// every column's natural width, so headers wrapped unevenly and a 13-character
// client name broke in half at 1280px.
//
// Here Chinese is the scanning layer and English the reference layer beneath it,
// smaller and quieter — the same discipline as bilingual transit signage, and the
// same split the product itself runs on: the broker reads Chinese, the documents
// are English. Every cell gets the same two-line rhythm, so the raggedness turns
// into a grid.

// data-register marks which layer a line belongs to. The scanning layer ("zh",
// which also carries proper nouns and dates — the atoms a reader matches on)
// must never wrap; the reference layer ("en") may. Test 53 enforces exactly that.

/** Column heading: Chinese to scan, English to confirm. */
function Heading({ zh, en, align = "left" }: { zh: string; en: string; align?: "left" | "right" }) {
  return (
    <th scope="col" className={`px-4 py-3 align-bottom ${align === "right" ? "text-right" : "text-left"}`}>
      <span data-register="zh" className="block whitespace-nowrap text-xs font-medium normal-case tracking-normal text-slate-600">
        {zh}
      </span>
      <span data-register="en" className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
        {en}
      </span>
    </th>
  );
}

/** A value that exists in both languages. */
function Bilingual({ zh, en }: { zh: string; en: string }) {
  return (
    <>
      <span data-register="zh" className="block whitespace-nowrap text-sm leading-snug text-slate-800">{zh}</span>
      <span data-register="en" className="mt-0.5 block text-[11px] leading-snug text-slate-500">{en}</span>
    </>
  );
}

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
            {/* 40rem, down from 52rem: stacking the two languages halved the
                natural width of every column. */}
            <table data-testid="queue-table" className="w-full min-w-[40rem] text-left text-sm">
              {/* Explicit distribution. Left to auto-layout, the table squeezed
                  the atomic values — a client name, a product name, a date —
                  until they broke mid-token, while the two label columns took
                  the room. Labels are the ones that can afford to wrap. */}
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[21%]" />
                <col className="w-[15%]" />
                <col className="w-[17%]" />
                <col className="w-[6%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="border-b border-slate-200 bg-slate-50/70">
                <tr>
                  <Heading zh="审核项" en="Review" />
                  <Heading zh="客户" en="Client" />
                  <Heading zh="产品对" en="Products" />
                  <Heading zh="状态" en="State" />
                  <Heading zh="所需审核" en="Required" />
                  <Heading zh="理由" en="Reasons" align="right" />
                  <Heading zh="创建" en="Created" align="right" />
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr
                    key={review.reviewId}
                    data-testid="queue-row"
                    data-review-id={review.reviewId}
                    data-review-state={review.reviewState}
                    className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/review/${review.reviewId}`}
                        data-testid="queue-row-link"
                        // inline-block + padding: as bare inline text this was
                        // an 8-character tap target on a phone.
                        className="inline-block py-0.5 font-mono text-xs text-[var(--brand)] underline underline-offset-2"
                      >
                        {review.reviewId.replace(/^rev_/, "").slice(0, 8)}
                      </Link>
                      <span data-register="zh" className="mt-0.5 block whitespace-nowrap text-[11px] leading-snug text-slate-500">
                        {WORKFLOW_DECISION_LABELS[review.workflowDecision].zh}
                      </span>
                      <span data-register="en" className="block text-[11px] leading-snug text-slate-400">
                        {WORKFLOW_DECISION_LABELS[review.workflowDecision].en}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {review.clientDisplayName ? (
                        // A proper noun has one register; inventing a Chinese
                        // name for a demo client would be inventing a fact.
                        <span data-register="zh" className="block whitespace-nowrap text-sm leading-snug text-slate-800">
                          {review.clientDisplayName}
                        </span>
                      ) : (
                        <Bilingual zh="不绑定客户" en="No client" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {/* Stacked rather than "A × B": inline, the pair wrapped
                          mid-product-name and read as one long string. */}
                      <span data-register="zh" className="block whitespace-nowrap text-sm leading-snug text-slate-800">
                        {review.productAName}
                      </span>
                      <span data-register="zh" className="block whitespace-nowrap text-sm leading-snug text-slate-800">
                        <span aria-hidden="true" className="mr-1 text-slate-400">
                          ×
                        </span>
                        {review.productBName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {/* Chinese only, on purpose: 待审核 / 已批准 / 已拒绝 /
                          要求修改 are all three or four characters, so the chips
                          line up down the column instead of stretching it to the
                          widest English label. English rides underneath.
                          inline-block + nowrap keeps the pill one shape — as a
                          bare inline span it tore into two half-pills whenever
                          the label wrapped. */}
                      <span
                        data-testid="queue-state-badge"
                        className={`inline-block min-w-[4.5rem] whitespace-nowrap rounded-full border px-2.5 py-0.5 text-center text-xs font-medium ${STATE_TONE[review.reviewState]}`}
                      >
                        {REVIEW_STATE_LABELS[review.reviewState].zh}
                      </span>
                      <span data-register="en" className="mt-1 block text-[11px] leading-snug text-slate-500">
                        {REVIEW_STATE_LABELS[review.reviewState].en}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Bilingual
                        zh={APPROVAL_LEVEL_LABELS[review.requiredApprovalLevel].zh}
                        en={APPROVAL_LEVEL_LABELS[review.requiredApprovalLevel].en}
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                      {review.reviewReasonCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <time data-register="zh" dateTime={review.createdAt} className="block whitespace-nowrap text-xs tabular-nums text-slate-600">
                        {review.createdAt.slice(0, 10)}
                      </time>
                      <span className="block text-[11px] tabular-nums text-slate-400">
                        {review.createdAt.slice(11, 16)}
                      </span>
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
