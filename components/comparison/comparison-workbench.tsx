"use client";

import { useCallback, useState } from "react";
import { ClientSummary } from "./client-summary";
import { ComparisonStatusBadge } from "./status-badge";
import { ComparisonTable } from "./comparison-table";
import { MissingInfoList } from "./missing-info-list";
import { NarrativePanel } from "./narrative-panel";
import { ObservationList } from "./observation-list";
import { ReviewBanner } from "./review-banner";
import type { ComparisonDraftView, NarrativeStatus, Phase, UiNarrativeSection } from "./types";

// The comparison work surface. It owns selection state and rendering order and
// nothing else: every fact, observation, flag and status comes from the
// deterministic engine behind /api/compare. The optional explanation is a
// second, clearly subordinate request that cannot alter any of it.

export interface ProductOption {
  documentId: string;
  productName: string;
  productCategory: string;
}
export interface ClientOption {
  caseId: string;
  displayName: string;
}

const GENERIC_ERROR = "生成比较草稿时出现问题，请重试。Something went wrong building the comparison. Please try again.";
const NO_CLIENT = "";

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

  const sameProduct = productAId === productBId;

  const generate = useCallback(async () => {
    if (sameProduct) return;
    setPhase("loading");
    setDraft(null);
    setNarrativeStatus("not_requested");
    setNarrativeSections([]);
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
          <ComparisonTable draft={draft} />
          <ObservationList draft={draft} />
          <MissingInfoList
            items={draft.missingClientInformation}
            hasClient={draft.clientContext !== null}
          />
          {draft.reviewRequired && <ReviewBanner reasons={draft.reviewReasons} />}
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
