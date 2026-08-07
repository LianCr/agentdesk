import type { EvidenceStatus } from "../chat/types";

const BADGE_STYLES: Record<EvidenceStatus, { label: string; className: string }> = {
  strong: {
    label: "证据充分 Strong evidence",
    className: "bg-green-50 text-green-800 border-green-200",
  },
  partial: {
    label: "部分证据 Partial evidence",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  insufficient: {
    label: "资料不足 Insufficient evidence",
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  const badge = BADGE_STYLES[status];
  return (
    <span
      data-testid="evidence-badge"
      data-status={status}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}
