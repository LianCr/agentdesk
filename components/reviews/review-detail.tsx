"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClientSummary } from "../comparison/client-summary";
import { ComparisonStatusBadge } from "../comparison/status-badge";
import { ComparisonTable } from "../comparison/comparison-table";
import { MissingInfoList } from "../comparison/missing-info-list";
import { ObservationList } from "../comparison/observation-list";
import { ReviewBanner } from "../comparison/review-banner";
import type { ComparisonDraftView } from "../comparison/types";
import { AuditTimeline } from "./audit-timeline";
import { AutomationPanel } from "./automation-panel";
import { ChecklistList } from "./checklist-list";
import { DecisionPanel, TerminalSummary, type DecisionBody } from "./decision-panel";
import { WorkflowBanner } from "./workflow-banner";
import type { ReviewDetailView } from "./types";

// The reviewer's work surface.
//
// Everything below the banner is the STORED SNAPSHOT. This component never
// calls /api/compare and never recomputes anything from today's product data:
// if the underlying documents changed after the review was created, the
// reviewer must still see what was reviewed, or the audit record refers to
// something nobody ever saw.
//
// The comparison is read-only by construction — the comparison components take
// a draft and render it; there is no edit path to omit.

const GENERIC_ERROR = "读取审核项时出现问题，请重试。Something went wrong loading the review.";

/** Adapts the stored snapshot to the shape the M4 comparison components read. */
function asDraftView(review: ReviewDetailView): ComparisonDraftView {
  return {
    comparisonId: review.snapshot.comparisonId,
    productA: review.snapshot.productA,
    productB: review.snapshot.productB,
    clientContext: review.snapshot.clientContext,
    dimensions: review.snapshot.dimensions,
    observations: review.snapshot.observations,
    missingClientInformation: review.snapshot.missingClientInformation,
    comparisonStatus: review.snapshot.comparisonStatus,
    reviewRequired: review.reviewReasons.length > 0,
    reviewReasons: review.reviewReasons,
    disclaimerZh: review.snapshot.disclaimerZh,
    disclaimerEn: review.snapshot.disclaimerEn,
    citationUrls: review.citationUrls,
    // The snapshot excludes the optional narrative on purpose: a reviewer signs
    // off on documented facts, not on model prose.
    narrativeSections: [],
    narrativeStatus: "not_requested",
  };
}

const ARRIVAL_NOTICES: Record<string, string> = {
  created: "审核项已创建。Review item created.",
  existing_pending:
    "已存在对应的待审核项，已为你打开。An existing pending review already covers this comparison; it is shown below.",
};

export function ReviewDetail({ reviewId }: { reviewId: string }) {
  const arrival = useSearchParams().get("from") ?? "";
  const [review, setReview] = useState<ReviewDetailView | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [conflictMessage, setConflictMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`);
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(typeof data?.message === "string" ? data.message : GENERIC_ERROR);
        return;
      }
      setReview(data as ReviewDetailView);
      setErrorMessage("");
    } catch {
      setErrorMessage(GENERIC_ERROR);
    }
  }, [reviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (body: DecisionBody) => {
      setConflictMessage("");
      try {
        const response = await fetch(`/api/reviews/${reviewId}/decision`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        if (response.status === 409) {
          // Someone else decided first. Their decision stands; show the current
          // truth rather than the state this tab was holding.
          setConflictMessage(
            typeof data?.message === "string"
              ? data.message
              : "该审核项已被其他人处理。This review was already decided by someone else.",
          );
          if (data?.reviewItem) setReview(data.reviewItem as ReviewDetailView);
          else await load();
          return;
        }
        if (!response.ok) {
          setErrorMessage(typeof data?.message === "string" ? data.message : GENERIC_ERROR);
          return;
        }
        setReview(data as ReviewDetailView);
      } catch {
        setErrorMessage(GENERIC_ERROR);
      }
    },
    [load, reviewId],
  );

  if (errorMessage && !review) {
    return (
      <p data-testid="review-error" role="alert" className="text-sm text-red-800">
        {errorMessage}
      </p>
    );
  }
  if (!review) {
    return <p className="text-sm text-slate-600">载入中… Loading…</p>;
  }

  const draft = asDraftView(review);
  const pending = review.reviewState === "pending_review";

  return (
    <div data-testid="review-detail" data-review-id={review.reviewId} className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/review" className="inline-block w-fit py-2 text-xs text-[var(--brand)] underline underline-offset-2">
          ← 返回审核队列 · Back to review queue
        </Link>
        <h1 className="text-3xl font-semibold text-[var(--brand)]">审核项 · Review item</h1>
        {/* The queue already shows the short form; a full rev_<uuid> under the
            title was the lone holdout. The complete id stays in data-review-id
            and the API. */}
        <p className="font-mono text-xs text-slate-500">
          {review.reviewId.replace(/^rev_/, "").slice(0, 8)}
        </p>
      </header>

      {ARRIVAL_NOTICES[arrival] && (
        <p
          data-testid="arrival-notice"
          data-arrival={arrival}
          className="rounded border border-slate-300 bg-white p-3 text-sm text-slate-700"
        >
          {ARRIVAL_NOTICES[arrival]}
        </p>
      )}

      <WorkflowBanner
        comparisonStatus={review.snapshot.comparisonStatus}
        workflowDecision={review.workflowDecision}
        requiredApprovalLevel={review.requiredApprovalLevel}
        reviewState={review.reviewState}
      />

      <ReviewBanner reasons={review.reviewReasons} />

      {review.snapshot.clientContext && <ClientSummary client={review.snapshot.clientContext} />}

      <section data-testid="snapshot-region" className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <ComparisonStatusBadge status={review.snapshot.comparisonStatus} />
          <p data-testid="snapshot-note" className="text-xs text-slate-500">
            以下为创建审核项时冻结存档的比较内容，之后的资料变动不会影响它。
            The comparison below was locked when this review was created; later document changes do not touch it.
          </p>
        </div>
        {/* Fully expanded here on purpose: a reviewer signs off on the whole
            snapshot and gets no collapsed default. */}
        <ComparisonTable draft={draft} defaultExpanded />
        <ObservationList draft={draft} />
        <MissingInfoList
          items={review.snapshot.missingClientInformation}
          hasClient={review.snapshot.clientContext !== null}
        />
      </section>

      <ChecklistList
        items={review.checklist}
        missingInformation={review.snapshot.missingClientInformation}
        dimensions={review.snapshot.dimensions}
        citationUrls={review.citationUrls}
      />

      {conflictMessage && (
        <p data-testid="decision-conflict" role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {conflictMessage} 请刷新查看最新状态。Refresh to see the latest status.
        </p>
      )}
      {errorMessage && (
        <p data-testid="decision-error" role="alert" className="text-sm text-red-800">
          {errorMessage}
        </p>
      )}

      {pending ? <DecisionPanel disabled={false} onDecide={decide} /> : <TerminalSummary review={review} />}

      {/* Always visible, so a reviewer can see what automation exists and what
          unlocks it. It only ever offers a button once a human has decided. */}
      <AutomationPanel key={review.reviewState} reviewId={review.reviewId} />

      <AuditTimeline events={review.events} />

      {/* The sha256 stays in the API and the audit trail; on screen the
          executive-legible fact is the guarantee itself, carried in title= for
          anyone who hovers. */}
      <p
        data-testid="snapshot-hash"
        title={`sha256 ${review.snapshotSha256}`}
        className="text-[11px] leading-relaxed text-slate-600"
      >
        本审核内容已存档锁定，审批不会改变被审内容。
        <span className="block text-slate-500">
          This review is frozen on an archived copy; deciding it never changes what was reviewed.
        </span>
      </p>
    </div>
  );
}
