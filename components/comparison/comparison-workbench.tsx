"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ClientRosterPanel } from "./client-roster-panel";
import { ClientSummary } from "./client-summary";
import { ComparisonStatusBadge } from "./status-badge";
import { ComparisonTable } from "./comparison-table";
import { MissingInfoList } from "./missing-info-list";
import { NarrativePanel } from "./narrative-panel";
import { ObservationList } from "./observation-list";
import { ReviewBanner } from "./review-banner";
import type {
  ComparisonDraftView,
  NarrativeStatus,
  Phase,
  UiClientRosterEntry,
  UiNarrativeSection,
} from "./types";

// The comparison work surface. It owns selection state and rendering order and
// nothing else: every fact, observation, flag and status comes from the
// deterministic engine behind /api/compare. The optional explanation is a
// second, clearly subordinate request that cannot alter any of it.

export interface ProductOption {
  documentId: string;
  productName: string;
  productCategory: string;
}
/** The roster carries each demo client's background, not just their name. */
export type ClientOption = UiClientRosterEntry;

const GENERIC_ERROR = "生成比较草稿时出现问题，请重试。Something went wrong building the comparison. Please try again.";
const REVIEW_ERROR = "送交审核时出现问题，请重试。Something went wrong sending this comparison for review.";
const NO_CLIENT = "";

type SendState = "idle" | "sending" | "created" | "existing_pending" | "error";

// The one action a draft leads to. Decided here, from the engine's own
// status and flags -- the model never sees this table. "Primary" only changes
// how the button looks: sending to review is always available, it is simply
// not the obvious move for a complete, unflagged internal draft.
function nextActionFor(draft: ComparisonDraftView): {
  kind: "blocked" | "review_required" | "internal_draft" | "partial_internal";
  zh: string;
  en: string;
  primary: boolean;
  tone: string;
} {
  if (draft.comparisonStatus === "blocked") {
    return {
      kind: "blocked",
      zh: "有事实无法核验，不得用于对外文案。送交持牌经纪人审核。",
      en: "Some facts could not be verified; not for client-facing use. Send to a licensed agent for review.",
      primary: true,
      tone: "border-red-200 bg-red-50",
    };
  }
  if (draft.reviewRequired) {
    return {
      kind: "review_required",
      zh: "内部可以看；给客户之前，先送交经纪人审核。",
      en: "Fine to read internally; send it to an agent for review before it reaches a client.",
      primary: true,
      tone: "border-amber-200 bg-amber-50",
    };
  }
  if (draft.comparisonStatus === "partial") {
    return {
      kind: "partial_internal",
      zh: "部分资料未提供，其余事实均有出处；可作内部草稿使用。",
      en: "Some items are not in the documents; the rest are cited. Usable as an internal draft.",
      primary: false,
      tone: "border-slate-200 bg-white",
    };
  }
  return {
    kind: "internal_draft",
    zh: "每一格都有出处，可作内部草稿使用。",
    en: "Every cell is cited; usable as an internal draft.",
    primary: false,
    tone: "border-slate-200 bg-white",
  };
}

export function ComparisonWorkbench({
  products,
  clients,
  defaults,
}: {
  products: ProductOption[];
  clients: ClientOption[];
  defaults: { productAId: string; productBId: string; clientCaseId: string };
}) {
  const [productAId, setProductAId] = useState(defaults.productAId);
  const [productBId, setProductBId] = useState(defaults.productBId);
  const [clientCaseId, setClientCaseId] = useState(defaults.clientCaseId);
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<ComparisonDraftView | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [narrativeStatus, setNarrativeStatus] = useState<NarrativeStatus>("not_requested");
  const [narrativeSections, setNarrativeSections] = useState<UiNarrativeSection[]>([]);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendMessage, setSendMessage] = useState("");
  const router = useRouter();
  const nextAction = draft ? nextActionFor(draft) : null;

  const sameProduct = productAId === productBId;

  const generate = useCallback(async () => {
    if (sameProduct) return;
    setPhase("loading");
    setDraft(null);
    setNarrativeStatus("not_requested");
    setNarrativeSections([]);
    setSendState("idle");
    setSendMessage("");
    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productAId,
          productBId,
          clientCaseId: clientCaseId === NO_CLIENT ? null : clientCaseId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(typeof data?.message === "string" ? data.message : GENERIC_ERROR);
        setPhase("error");
        return;
      }
      setDraft(data as ComparisonDraftView);
      setPhase("done");
    } catch {
      setErrorMessage(GENERIC_ERROR);
      setPhase("error");
    }
  }, [clientCaseId, productAId, productBId, sameProduct]);

  const loadNarrative = useCallback(async () => {
    if (!draft) return;
    setNarrativeLoading(true);
    try {
      const response = await fetch("/api/compare/narrative", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productAId,
          productBId,
          clientCaseId: clientCaseId === NO_CLIENT ? null : clientCaseId,
        }),
      });
      const data = await response.json();
      setNarrativeSections(Array.isArray(data?.narrativeSections) ? data.narrativeSections : []);
      setNarrativeStatus(typeof data?.narrativeStatus === "string" ? data.narrativeStatus : "unavailable");
    } catch {
      // The table is already on screen; an optional explanation failing must
      // never disturb it.
      setNarrativeSections([]);
      setNarrativeStatus("unavailable");
    } finally {
      setNarrativeLoading(false);
    }
  }, [clientCaseId, draft, productAId, productBId]);


  // Generating a comparison must not write to the database — a reviewer's queue
  // filling up because someone was exploring products would make the queue
  // meaningless. A review exists only when a person asks for one.
  const sendToReview = useCallback(async () => {
    setSendState("sending");
    setSendMessage("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productAId,
          productBId,
          clientCaseId: clientCaseId === NO_CLIENT ? null : clientCaseId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSendMessage(typeof data?.message === "string" ? data.message : REVIEW_ERROR);
        setSendState("error");
        return;
      }
      // Finding an open review for the same work is a success. It is what
      // idempotent creation is FOR, so it is announced, not reported as a fault.
      const existing = data?.action === "existing_pending";
      setSendState(existing ? "existing_pending" : "created");
      setSendMessage(
        existing
          ? "已存在对应的待审核项。An existing pending review already covers this comparison."
          : "审核项已创建。Review item created.",
      );
      // The outcome travels to the destination: a message shown here would be
      // unmounted by the navigation a moment later, so the reviewer would land
      // on an existing review with no explanation of why it was already there.
      const reviewId = data?.reviewItem?.reviewId;
      if (typeof reviewId === "string") {
        router.push(`/review/${reviewId}?from=${existing ? "existing_pending" : "created"}`);
      }
    } catch {
      setSendMessage(REVIEW_ERROR);
      setSendState("error");
    }
  }, [clientCaseId, productAId, productBId, router]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
          Product Comparison Draft
        </p>
        <h1 data-testid="compare-title" className="text-3xl font-semibold text-[var(--brand)]">
          产品比较草稿
        </h1>
        <p data-testid="compare-tagline" className="max-w-2xl text-sm leading-relaxed text-slate-600">
          基于演示保险资料生成可追溯的产品事实对比。比较结果仅供经纪人内部审核，不构成产品推荐或适当性判断。
          <br />
          Compare documented product facts with source-level citations. For internal agent review only — not a
          recommendation or suitability determination.
        </p>
      </header>

      {/* Before the controls, the way the knowledge base panel sits before the
          question box: it answers "who can this compare for?", and the next
          thing you do is pick one. */}
      <ClientRosterPanel clients={clients} selectedCaseId={clientCaseId} onSelect={setClientCaseId} />

      <form
        data-testid="comparison-controls"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">演示客户 · Demo client</span>
            <select
              data-testid="select-client"
              value={clientCaseId}
              onChange={(event) => setClientCaseId(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
            >
              <option value={NO_CLIENT}>不绑定客户 · No client context</option>
              {clients.map((client) => (
                <option key={client.caseId} value={client.caseId}>
                  {client.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">产品 A · Product A</span>
            <select
              data-testid="select-product-a"
              value={productAId}
              onChange={(event) => setProductAId(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
            >
              {products.map((product) => (
                <option key={product.documentId} value={product.documentId}>
                  {product.productName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">产品 B · Product B</span>
            <select
              data-testid="select-product-b"
              value={productBId}
              onChange={(event) => setProductBId(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
            >
              {products.map((product) => (
                <option key={product.documentId} value={product.documentId}>
                  {product.productName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {sameProduct && (
          <p data-testid="duplicate-product-warning" role="alert" className="mt-3 text-sm text-amber-800">
            请选择两个不同的产品。Please select two different products.
          </p>
        )}

        <button
          type="submit"
          data-testid="generate-comparison"
          disabled={phase === "loading" || sameProduct}
          className="mt-4 rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[#16304f] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          {phase === "loading" ? "生成中… Generating…" : "生成比较草稿 · Generate comparison"}
        </button>
      </form>

      <div data-testid="comparison-status-region" aria-live="polite">
        {phase === "loading" && <p className="text-sm text-slate-600">正在组装比较表… Building the comparison…</p>}
        {phase === "done" && <span className="sr-only">比较草稿已生成 Comparison ready</span>}
      </div>

      {phase === "error" && (
        <div
          data-testid="comparison-error"
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      {phase === "done" && draft !== null && (
        <div data-testid="comparison-result" className="flex flex-col gap-6">
          {draft.clientContext && <ClientSummary client={draft.clientContext} />}
          <ComparisonStatusBadge status={draft.comparisonStatus} />
          {/* The one action that follows this draft, decided from its verified
              state. The review reasons live inside it rather than as a second
              banner further down: they are WHY the action is what it is. */}
          <section
            data-testid="send-to-review"
            data-next-action={nextAction?.kind}
            className={`flex flex-col gap-3 rounded-lg border p-5 ${nextAction?.tone ?? ""}`}
          >
            <h2 className="text-sm font-semibold text-slate-900">下一步 · Next step</h2>
            <p className="text-sm leading-relaxed text-slate-800">
              <span data-register="zh" className="block">{nextAction?.zh}</span>
              <span data-register="en" className="block text-xs text-slate-600">{nextAction?.en}</span>
            </p>
            {draft.missingClientInformation.length > 0 && (
              <a
                href="#missing"
                className="w-fit text-xs text-slate-700 underline decoration-dotted underline-offset-4 hover:text-[var(--brand)]"
              >
                送审前可先向客户确认 {draft.missingClientInformation.length} 项 ↓ · {draft.missingClientInformation.length} to confirm with the client first
              </a>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="send-to-review-button"
                disabled={sendState === "sending"}
                onClick={() => void sendToReview()}
                className={
                  nextAction?.primary
                    ? "rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[#16304f] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
                    : "rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-[var(--brand)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
                }
              >
                {sendState === "sending" ? "送交中… Sending…" : "送交审核 · Send to review"}
              </button>
              <p className="text-xs text-slate-500">
                审核项会存下这份比较的定稿版本与逐格出处，供审核者批准、拒绝或要求修改。
                <span className="block">A review item stores a locked copy of this comparison for a reviewer to act on.</span>
              </p>
            </div>
            <div data-testid="send-to-review-status" aria-live="polite">
              {sendMessage && (
                <p
                  data-testid={sendState === "error" ? "send-to-review-error" : "send-to-review-result"}
                  data-action={sendState}
                  role={sendState === "error" ? "alert" : undefined}
                  className={`text-sm ${sendState === "error" ? "text-red-800" : "text-slate-700"}`}
                >
                  {sendMessage}
                </p>
              )}
            </div>
            {draft.reviewRequired && <ReviewBanner reasons={draft.reviewReasons} />}
          </section>
          {/* Differences before the table: they are the conclusion of a
              comparison, the table is its evidence. */}
          <ObservationList draft={draft} />
          <ComparisonTable draft={draft} />
          <MissingInfoList
            items={draft.missingClientInformation}
            hasClient={draft.clientContext !== null}
          />
          <NarrativePanel
            status={narrativeStatus}
            sections={narrativeSections}
            loading={narrativeLoading}
            onLoad={() => void loadNarrative()}
          />
        </div>
      )}
    </div>
  );
}
