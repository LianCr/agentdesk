import type { ClockState } from "../../lib/support/sla";
import type { TicketAction, TicketCategory, TicketStatus } from "../../lib/support/types";

// Bilingual labels and tones for the support desk: Chinese to scan, English
// beneath to confirm — the same two registers as the review queue.

export type Bi = { zh: string; en: string };

export const STATUS_LABELS: Record<TicketStatus, Bi> = {
  needs_human: { zh: "待人工处理", en: "Needs human" },
  draft_ready: { zh: "草稿待批准", en: "Draft ready" },
  waiting_on_requester: { zh: "等待提交人", en: "Waiting on requester" },
  escalated: { zh: "已升级工程", en: "Escalated" },
  resolved: { zh: "已解决", en: "Resolved" },
};

export const CATEGORY_LABELS: Record<TicketCategory, Bi> = {
  product_question: { zh: "产品问题", en: "Product question" },
  how_to: { zh: "使用问题", en: "How-to" },
  bug_report: { zh: "故障", en: "Bug report" },
  access: { zh: "访问", en: "Access" },
  privacy_request: { zh: "隐私请求", en: "Privacy request" },
  policy_sensitive: { zh: "合规敏感", en: "Policy-sensitive" },
  feature_request: { zh: "功能建议", en: "Feature request" },
  other: { zh: "其他", en: "Other" },
};

export const SLA_LABELS: Record<ClockState, Bi> = {
  breached: { zh: "已超时", en: "Breached" },
  at_risk: { zh: "即将超时", en: "At risk" },
  on_track: { zh: "正常", en: "On track" },
  met: { zh: "已达成", en: "Met" },
};

export const SLA_TONE: Record<ClockState, string> = {
  breached: "border-red-200 bg-red-50 text-red-900",
  at_risk: "border-amber-200 bg-amber-50 text-amber-900",
  on_track: "border-slate-300 bg-white text-slate-700",
  met: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export const PRIORITY_TONE: Record<string, string> = {
  P1: "border-red-300 bg-red-50 text-red-900",
  P2: "border-amber-300 bg-amber-50 text-amber-900",
  P3: "border-slate-300 bg-white text-slate-700",
  P4: "border-slate-200 bg-slate-50 text-slate-500",
};

export const ACTION_LABELS: Record<TicketAction, Bi> = {
  APPROVE_DRAFT: { zh: "批准草稿并记为已回复", en: "Approve draft & mark replied" },
  TAKE_OVER: { zh: "转人工接手", en: "Take over" },
  LOG_REPLY: { zh: "记录已回复（继续处理）", en: "Log reply (keep working)" },
  REQUEST_INFO: { zh: "向提交人索取信息", en: "Ask requester for info" },
  REQUESTER_REPLIED: { zh: "提交人已回复", en: "Requester replied" },
  ESCALATE: { zh: "升级给工程", en: "Escalate to engineering" },
  ENGINEERING_RETURNED: { zh: "工程已退回", en: "Engineering returned it" },
  RESOLVE: { zh: "标记已解决", en: "Resolve" },
  ASSIGN: { zh: "指派", en: "Assign" },
};

export function BiLine({ zh, en, className = "" }: Bi & { className?: string }) {
  return (
    <span className={className}>
      <span data-register="zh" className="block whitespace-nowrap">{zh}</span>
      <span data-register="en" className="block text-[11px] leading-tight opacity-75">{en}</span>
    </span>
  );
}

export function Pill({ tone, children, testId }: { tone: string; children: React.ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} className={`inline-block shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {children}
    </span>
  );
}

export function SyntheticNotice() {
  return (
    <p data-testid="support-synthetic-notice" className="rounded border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
      演示数据：所有工单、提交人与指标均为合成数据（seed），不是真实客户或真实团队表现。系统没有任何对外发送渠道——“已回复”表示由人记录。
      <br />
      Demo data: every ticket, requester and metric here is synthetic (seeded), not a real customer or a real team&apos;s
      performance. AgentDesk has no outbound channel — &ldquo;replied&rdquo; means a person recorded it.
    </p>
  );
}
