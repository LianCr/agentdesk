import type { UiClientContext } from "./types";

// Only fields the synthetic fixtures actually state. Everything unknown is
// deliberately absent here and appears under "information still needed"
// instead — a tidier-looking profile would be a fabricated one.

// Exported: the client roster panel names the same goals, and the bilingual
// copy must exist once.
export const GOAL_LABELS: Record<string, string> = {
  income_replacement: "收入替代 Income replacement",
  permanent_coverage_with_cash_accumulation: "终身保障与现金积累 Permanent coverage with cash accumulation",
  higher_fixed_rate_for_savings: "更高的储蓄固定利率 Higher fixed rate for savings",
};

export function ClientSummary({ client }: { client: UiClientContext }) {
  const rows: Array<[string, string]> = [];
  if (client.age !== "unknown") rows.push(["年龄 Age", String(client.age)]);
  if (client.dependents !== "unknown") rows.push(["受养人 Dependents", String(client.dependents)]);
  rows.push(["目标 Goal", GOAL_LABELS[client.primaryGoal] ?? client.primaryGoal]);
  if (client.budgetMonthly !== "unknown") rows.push(["月预算 Budget", `$${client.budgetMonthly}/month`]);
  if (client.coverageHorizon !== "unknown") rows.push(["保障期望 Coverage horizon", `${client.coverageHorizon}\u00a0年 years`]);
  if (client.existingCoverageNote !== "unknown") rows.push(["现有保障 Existing coverage", client.existingCoverageNote]);
  if (client.riskTolerance !== "unknown") rows.push(["风险偏好 Risk tolerance", client.riskTolerance]);
  rows.push(["语言 Language", client.language === "zh" ? "中文 Chinese" : "英文 English"]);
  if (client.replacementContext) {
    rows.push(["替换情形 Replacement context", "是 Yes — 涉及现有合同 involves an existing contract"]);
  }

  return (
    <section
      data-testid="client-summary"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 className="text-sm font-semibold text-[var(--brand)]">
        {client.displayName} <span className="font-normal text-slate-500">({client.caseId})</span>
      </h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-sm text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
