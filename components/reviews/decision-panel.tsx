"use client";

import { useState } from "react";
import { REVIEW_STATE_LABELS, type ReviewDetailView } from "./types";

// The human step.
//
// Approve wording is code-owned and says precisely what it means: someone
// signed off on an internal workflow step. It is not a suitability finding, a
// carrier approval, a compliance sign-off, a quote, or advice to buy. A model
// never produces any of this text.

export type DecisionBody =
  | { type: "approve"; note?: string }
  | { type: "reject"; reason: string }
  | { type: "request_revision"; instructions: string };

const APPROVED_SCOPE_ZH =
  "这仅表示审核者认可本演示工作流中的这一内部步骤，不构成产品适合性判断、保险公司核准、合规或法律批准、报价有效性，也不构成购买建议。";
const APPROVED_SCOPE_EN =
  "This only records that a reviewer signed off on an internal step of this demo workflow. It does not determine product suitability, carrier approval, legal or compliance approval, quote validity, or a recommendation to purchase.";

export function TerminalSummary({ review }: { review: ReviewDetailView }) {
  const label = REVIEW_STATE_LABELS[review.reviewState];
  const note = review.revisionInstructions ?? review.decisionNote;
  return (
    <section
      data-testid="decision-outcome"
      data-review-state={review.reviewState}
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 className="caption">审核结果 · Decision</h2>
      <p data-testid="decision-outcome-state" className="mt-2 text-base font-semibold text-slate-900">
        {review.reviewState === "approved"
          ? "本演示工作流内已批准 · Approved in this demo workflow"
          : `${label.zh} · ${label.en}`}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        <span className="whitespace-nowrap">{review.reviewer ?? "—"}</span> ·{" "}
        <time dateTime={review.updatedAt} className="whitespace-nowrap tabular-nums">
          {review.updatedAt.slice(0, 10)} {review.updatedAt.slice(11, 16)}
        </time>
      </p>
      {note && (
        <p data-testid="decision-outcome-note" className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-700">
          {note}
        </p>
      )}
      {review.reviewState === "approved" && (
        <p data-testid="approval-scope" className="mt-3 text-xs leading-relaxed text-slate-600">
          {APPROVED_SCOPE_ZH}
          <br />
          {APPROVED_SCOPE_EN}
        </p>
      )}
    </section>
  );
}

export function DecisionPanel({
  disabled,
  onDecide,
}: {
  disabled: boolean;
  onDecide: (body: DecisionBody) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const busy = submitting || disabled;

  // One in-flight decision at a time. A second click while the first request is
  // open would be a second decision on a state that is already changing; the
  // database would refuse it, but the reviewer should not have to find out
  // through an error message.
  async function submit(body: DecisionBody) {
    if (busy) return;
    setSubmitting(true);
    try {
      await onDecide(body);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section data-testid="decision-panel" className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="caption">审核决定 · Reviewer decision</h2>
      <p className="mt-1 text-xs text-slate-500">
        {APPROVED_SCOPE_ZH}
        <br />
        {APPROVED_SCOPE_EN}
      </p>

      <div className="mt-4 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="decision-note">
            批准备注（可选）· Approval note (optional)
          </label>
          <textarea
            id="decision-note"
            data-testid="approve-note"
            value={note}
            rows={2}
            onChange={(event) => setNote(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
          <button
            type="button"
            data-testid="approve-button"
            disabled={busy}
            onClick={() => void submit({ type: "approve", note: note.trim() || undefined })}
            className="self-start rounded bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--action-hover)] disabled:opacity-60"
          >
            批准 · Approve
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-5">
          <label className="text-sm font-medium text-slate-700" htmlFor="decision-reason">
            拒绝原因（必填）· Rejection reason (required)
          </label>
          <textarea
            id="decision-reason"
            data-testid="reject-reason"
            value={reason}
            rows={2}
            onChange={(event) => setReason(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
          <button
            type="button"
            data-testid="reject-button"
            disabled={busy || reason.trim().length === 0}
            onClick={() => void submit({ type: "reject", reason: reason.trim() })}
            className="self-start rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
          >
            拒绝 · Reject
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-5">
          <label className="text-sm font-medium text-slate-700" htmlFor="decision-instructions">
            修改说明（必填）· Revision instructions (required)
          </label>
          <textarea
            id="decision-instructions"
            data-testid="revision-instructions"
            value={instructions}
            rows={2}
            onChange={(event) => setInstructions(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
          <button
            type="button"
            data-testid="revision-button"
            disabled={busy || instructions.trim().length === 0}
            onClick={() => void submit({ type: "request_revision", instructions: instructions.trim() })}
            className="self-start rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            要求修改 · Request revision
          </button>
          <p className="text-xs text-slate-500">
            本阶段不会自动重新生成草稿；说明会被记录下来供后续处理。
            The draft is not regenerated automatically at this stage; the instructions are recorded.
          </p>
        </div>
      </div>
    </section>
  );
}
