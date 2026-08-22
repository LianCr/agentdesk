import type { EvidenceStatus } from "../chat/types";

const BADGE_STYLES: Record<EvidenceStatus, { label: string; className: string }> = {
  strong: {
    label: "证据充分 Strong evidence",
    className: "text-[#7bd65a]",
  },
  partial: {
    label: "部分证据 Partial evidence",
    className: "text-[#ffc857]",
  },
  insufficient: {
    label: "资料不足 Insufficient evidence",
    className: "text-slate-300",
  },
};

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  const badge = BADGE_STYLES[status];
  return (
    <span
      data-testid="evidence-badge"
      data-status={status}
      className={`inline-flex items-center text-sm font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}
