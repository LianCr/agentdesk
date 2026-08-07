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
      label: "已验证事实 Verified claims",
      value: `${citedFactualClaims.length} / ${factualClaims.length}`,
    },
    {
      testId: "metric-coverage",
      label: "引用覆盖率 Citation coverage",
      value: coverage,
    },
    {
      testId: "metric-review",
      label: "需要人工审核 Review required",
      value: result.reviewRequired ? "需要 Yes" : "无需 No",
    },
  ];

  return (
    <section
      data-testid="evidence-summary"
      aria-label="证据摘要 Evidence summary"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        证据摘要 Evidence summary
      </h2>
      <dl className="divide-y divide-slate-100">
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
    </section>
  );
}
