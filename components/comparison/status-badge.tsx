import type { ComparisonStatus } from "./types";

// Factual states, not confidence. There is deliberately no percentage, score,
// probability or similarity anywhere in this UI.

const STATUS: Record<ComparisonStatus, { labelZh: string; labelEn: string; className: string; noteZh: string; noteEn: string }> = {
  complete: {
    labelZh: "比较资料完整",
    labelEn: "Complete comparison",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    noteZh: "所有比较维度都已核验为有据、不适用或资料未提供。",
    noteEn: "Every dimension resolved to a documented value, not applicable, or not provided.",
  },
  partial: {
    labelZh: "部分资料无法核验",
    labelEn: "Partial comparison",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    noteZh: "个别非核心维度的事实无法与原文核对，其余内容仍可使用。",
    noteEn: "A non-core fact could not be reconciled with its source; the rest of the table remains usable.",
  },
  blocked: {
    labelZh: "比较已阻止",
    labelEn: "Comparison blocked",
    className: "border-slate-300 bg-slate-100 text-slate-800",
    noteZh: "一个或多个核心事实无法与原文核对，因此不输出比较结论。无法核验的数值不会显示为产品事实。",
    noteEn: "One or more core facts could not be verified against their source, so no comparison conclusion is presented. Unverified values are never shown as product facts.",
  },
};

export function ComparisonStatusBadge({ status }: { status: ComparisonStatus }) {
  const s = STATUS[status];
  return (
    <section
      data-testid="comparison-status"
      data-status={status}
      className={`rounded-lg border p-4 ${s.className}`}
    >
      <p className="text-sm font-semibold">
        {s.labelZh} · {s.labelEn}
      </p>
      <p className="mt-1 text-xs leading-relaxed">
        {s.noteZh}
        <br />
        {s.noteEn}
      </p>
    </section>
  );
}
