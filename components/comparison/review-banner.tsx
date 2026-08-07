// Review flags only. Approve / request changes / reject is M5; nothing here
// implements a workflow. Demo business rules are labelled as Demo policy so a
// reader never mistakes this project's fictional threshold for a legal duty.

const FLAGS: Record<string, { labelZh: string; labelEn: string; demoRule: boolean }> = {
  CLIENT_FACING_DRAFT: { labelZh: "对外文案需人工批准", labelEn: "Client-facing use requires approval", demoRule: true },
  NON_GUARANTEED_ELEMENTS: { labelZh: "涉及非保证要素", labelEn: "Non-guaranteed elements", demoRule: false },
  ILLUSTRATION_REQUIRED: { labelZh: "需要个性化 illustration", labelEn: "Illustration required", demoRule: false },
  ANNUITY_CONTEXT: { labelZh: "涉及年金合同", labelEn: "Annuity context", demoRule: true },
  SURRENDER_CHARGE_EXPOSURE: { labelZh: "退保费用敞口", labelEn: "Surrender-charge exposure", demoRule: false },
  MARKET_VALUE_ADJUSTMENT_EXPOSURE: { labelZh: "市场价值调整敞口", labelEn: "Market-value-adjustment exposure", demoRule: false },
  AGE_65_PLUS: { labelZh: "客户年龄 65 岁及以上", labelEn: "Client age 65+", demoRule: true },
  REPLACEMENT_CONTEXT: { labelZh: "替换现有合同情形", labelEn: "Existing-policy replacement context", demoRule: true },
  SPECIFIC_VALUE_REQUEST: { labelZh: "客户询问具体收益数字", labelEn: "Specific future-value request", demoRule: true },
};

export function ReviewBanner({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <section
      data-testid="review-banner"
      role="note"
      className="rounded-lg border border-amber-200 bg-amber-50 p-5"
    >
      <p className="text-sm font-semibold text-amber-900">需要经纪人审核 · Agent review required</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {reasons.map((reason) => {
          const flag = FLAGS[reason];
          return (
            <li
              key={reason}
              data-testid="review-reason"
              data-flag={reason}
              className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-amber-900"
            >
              {flag ? `${flag.labelZh} · ${flag.labelEn}` : reason}
              {flag && (
                <span className="ml-1 text-amber-700/70">
                  ({flag.demoRule ? "本 Demo 规则 demo policy" : "文档事实 document fact"})
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-amber-800">
        标注为「本 Demo 规则」的条目是本演示项目的业务政策，不是普遍法律义务。审批流程不在本阶段实现。
        <br />
        Items marked “demo policy” are this demonstration&apos;s business rules, not universal legal requirements. Approval workflow is not implemented at this stage.
      </p>
    </section>
  );
}
