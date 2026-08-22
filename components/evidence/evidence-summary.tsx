import type { GroundedAnswer } from "../chat/types";

interface MetricRow {
  testId: string;
  label: string;
  value: string;
}

export function EvidenceSummary({ result }: { result: GroundedAnswer }) {
  const uniqueDocuments = new Set(result.citations.map((c) => c.documentId)).size;
  const factualClaims = result.claims.filter((c) => c.factual);
  const citedFactualClaims = factualClaims.filter((c) => c.citationIds.length > 0);
  const coverage = `${Math.round(result.meta.citationCoverage * 100)}%`;

  const rows: MetricRow[] = [
    {
      testId: "metric-sources",
      label: "引用来源 Sources used",
      value: String(uniqueDocuments),
    },
    {
      testId: "metric-claims",
      label: "已核对的事实 Facts checked",
      value: `${citedFactualClaims.length} / ${factualClaims.length}`,
    },
    {
      testId: "metric-coverage",
      label: "有出处的事实比例 Facts with sources",
      value: coverage,
    },
    {
      testId: "metric-review",
      label: "需要人工审核 Review required",
      value: result.reviewRequired ? "需要 Yes" : "无需 No",
    },
  ];

  // Collapsed by default: these numbers are for whoever checks the work, not
  // for the person deciding what to do next. The one-line summary already
  // states the fact that matters.
  return (
    <details
      data-testid="evidence-summary"
      aria-label="核对情况 Verification summary"
      className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <summary
        data-testid="evidence-summary-toggle"
        className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm"
      >
        <span className="font-semibold text-slate-900">核对情况 Verification summary</span>
        <span className="text-xs text-slate-600">
          {citedFactualClaims.length} / {factualClaims.length} 事实有出处 facts cited{" "}
          <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>
      <dl className="mt-3 divide-y divide-slate-100">
        {rows.map((row) => (
          <div
            key={row.testId}
            data-testid={row.testId}
            className="flex items-center justify-between gap-4 py-2"
          >
            <dt className="text-sm text-slate-600">{row.label}</dt>
            <dd className="text-sm font-semibold text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
