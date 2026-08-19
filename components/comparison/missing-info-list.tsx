import type { UiMissingInfo } from "./types";

// What the agent still needs to ask. This is a checklist, not a verdict:
// nothing here says the client is unsuitable, and there is no risk score.

const FIELD_LABELS: Record<string, string> = {
  desiredCoverageAmount: "期望身故保额 Desired death benefit",
  tobaccoUse: "吸烟状况 Tobacco use",
  underwritingClass: "核保分类 Underwriting class",
  employerGroupCoverage: "团体/雇主保障 Employer or group coverage",
  existingIndividualCoverage: "个人自购保障 Individually owned coverage",
  plannedPremiumDuration: "计划缴费年限 Planned premium duration",
  cashValueTimeHorizon: "现金价值时间目标 Cash-value time horizon",
  withdrawalExpectations: "取用预期 Withdrawal expectations",
  personalizedIllustration: "个性化 illustration Personalized illustration",
  currentSurrenderCharge: "现有合同退保费用 Existing surrender charge",
  currentMarketValueAdjustment: "现有合同市场价值调整 Existing market value adjustment",
  existingGuaranteedRateEndDate: "现有保证利率到期日 Existing guaranteed-rate end date",
  currentAccountValue: "现有账户价值 Current account value",
  benefitsThatMayBeLost: "可能失去的利益 Benefits that may be lost",
};

// Exported: the review checklist renders the same "affects" label, and the
// bilingual copy must exist once.
export const REQUIRED_FOR: Record<string, string> = {
  coverage_need: "保障需求评估 Coverage-need assessment",
  cost_comparison: "费率比较 Cost comparison",
  illustration: "illustration 与非保证要素 Illustration and non-guaranteed elements",
  replacement_review: "替换审核 Replacement review",
};

export function MissingInfoList({ items, hasClient }: { items: UiMissingInfo[]; hasClient: boolean }) {
  if (!hasClient) {
    return (
      <section
        data-testid="missing-info"
        data-mode="no-client"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-800">
          仍需确认的信息 <span className="font-normal text-slate-500">· Information still needed</span>
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          本次为纯产品比较，未绑定演示客户，因此没有客户信息缺口。
          <br />
          No demo client is attached to this product-only comparison, so no client information is listed.
        </p>
      </section>
    );
  }
  if (items.length === 0) return null;

  return (
    <section data-testid="missing-info" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-slate-800">
        仍需确认的信息 <span className="font-normal text-slate-500">· Information still needed</span>
      </h2>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.field}
            data-testid="missing-info-item"
            data-field={item.field}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-800">{FIELD_LABELS[item.field] ?? item.field}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.reasonZh}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.reasonEn}</p>
            <p className="mt-2 text-xs text-slate-500">
              影响 Affects: {REQUIRED_FOR[item.requiredFor] ?? item.requiredFor}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
