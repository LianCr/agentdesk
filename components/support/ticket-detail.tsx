"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { EscalationInput } from "../../lib/support/escalation";
import { formatMinutes } from "../../lib/support/sla";
import { SUPPORT_AGENTS, type SupportAgent, type TicketAction } from "../../lib/support/types";
import type { TicketDetailView } from "../../lib/support/views";
import { ACTION_LABELS, BiLine, CATEGORY_LABELS, PRIORITY_TONE, Pill, SLA_LABELS, SLA_TONE, STATUS_LABELS, SyntheticNotice } from "./labels";

// One ticket. The page ends in ONE primary action chosen by code from the
// ticket's status (CLAUDE.md §13); every other legal action is folded away.
// The browser sends an action name, the status it saw, a roster name and the
// human's text — never a status, a category or a packet's code checks.

const AGENT_KEY = "agentdesk.support.actingAs";

type Fields = { text: string; assignee: SupportAgent | ""; escalation: EscalationInput | null };

function bodyFor(action: TicketAction, f: Fields): Record<string, unknown> {
  switch (action) {
    case "APPROVE_DRAFT":
    case "LOG_REPLY":
    case "REQUEST_INFO":
      return { replyText: f.text };
    case "RESOLVE":
      return { resolutionNote: f.text };
    case "REQUESTER_REPLIED":
    case "ENGINEERING_RETURNED":
      return { note: f.text };
    case "TAKE_OVER":
      return f.text.trim() ? { note: f.text } : {};
    case "ASSIGN":
      return { assignee: f.assignee || null };
    case "ESCALATE":
      return { escalation: f.escalation };
  }
}

const TEXT_PROMPT: Partial<Record<TicketAction, string>> = {
  LOG_REPLY: "回复内容（由你在系统外发出）Reply text (you send it outside AgentDesk)",
  REQUEST_INFO: "你要问提交人的问题 What you need from the requester",
  RESOLVE: "解决说明 Resolution note",
  REQUESTER_REPLIED: "提交人回复了什么 What the requester said",
  ENGINEERING_RETURNED: "工程的结论 What engineering found",
  TAKE_OVER: "接手原因（可选）Why you are taking over (optional)",
};

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const [detail, setDetail] = useState<TicketDetailView | null>(null);
  const [failed, setFailed] = useState<"none" | "missing" | "error">("none");
  const [actor, setActor] = useState<SupportAgent>("Demo Agent A");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(AGENT_KEY);
      if (saved && (SUPPORT_AGENTS as readonly string[]).includes(saved)) setActor(saved as SupportAgent);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`);
      if (res.status === 404) return setFailed("missing");
      if (!res.ok) return setFailed("error");
      setDetail(await res.json());
    } catch {
      setFailed("error");
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: TicketAction, fields: Fields) {
    if (!detail) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, expectedStatus: detail.ticket.status, actor, ...bodyFor(action, fields) }),
      });
      const data = await res.json();
      if (res.ok) setDetail(data);
      else if (data?.detail) {
        setDetail(data.detail);
        setNotice(data.message);
      } else setNotice(data?.message ?? "操作失败 The action failed.");
    } catch {
      setNotice("操作失败，请重试。The action failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (failed === "missing") return <p className="text-sm text-slate-700">找不到该工单。Ticket not found. <Link className="text-[var(--link)] underline" href="/support">← Queue</Link></p>;
  if (failed === "error") return <p role="alert" className="text-sm text-red-800">读取工单时出现问题。Something went wrong loading the ticket.</p>;
  if (!detail) return <p className="text-sm text-slate-600">载入中… Loading…</p>;

  const { ticket, sla } = detail;
  const triage = ticket.triage;
  const secondary = detail.allowedActions.filter((a) => a !== detail.primaryAction);

  return (
    <div className="flex flex-col gap-6" data-testid="ticket-detail" data-ticket-status={ticket.status}>
      <Link href="/support" className="text-sm text-[var(--link)] underline underline-offset-2">← 工单队列 Ticket queue</Link>

      <header className="flex flex-col gap-2">
        <p className="caption">{ticket.ticketId}{ticket.seed ? " · seed (synthetic)" : ""}</p>
        <h1 className="text-2xl font-semibold text-[var(--brand)]">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={PRIORITY_TONE[ticket.priority]!}>{ticket.priority}</Pill>
          <Pill tone="border-slate-300 bg-white text-slate-800" testId="ticket-status">{STATUS_LABELS[ticket.status].zh} · {STATUS_LABELS[ticket.status].en}</Pill>
          <Pill tone={SLA_TONE[sla.firstResponse.state]}>
            首响 1st response: {SLA_LABELS[sla.firstResponse.state].en}{ticket.firstResponseAt ? "" : ` (${formatMinutes(sla.firstResponse.minutesRemaining)})`}
          </Pill>
          <Pill tone={SLA_TONE[sla.resolution.state]}>
            解决 Resolution: {SLA_LABELS[sla.resolution.state].en}{ticket.resolvedAt ? "" : ` (${formatMinutes(sla.resolution.minutesRemaining)})`}
          </Pill>
        </div>
        <p className="text-xs text-slate-500">
          {ticket.requester} · via {ticket.channel} · {CATEGORY_LABELS[ticket.category].zh} {CATEGORY_LABELS[ticket.category].en} · owner {ticket.assignee ?? "unassigned"} · opened {ticket.createdAt}
        </p>
        <SyntheticNotice />
      </header>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="caption mb-2">工单内容 Ticket</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{ticket.body}</p>
      </section>

      <details className="rounded border border-slate-200 bg-white p-4" data-testid="ticket-triage">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">
          自动分诊依据 Why triage routed it here — {triage.route} (rules v{triage.rulesVersion}, no LLM)
        </summary>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-700 sm:grid-cols-[10rem_1fr]">
          <dt className="text-slate-500">Category</dt><dd>{triage.category} <span className="font-mono text-slate-500">({triage.categoryRule})</span></dd>
          <dt className="text-slate-500">Priority</dt><dd>{triage.priority} <span className="font-mono text-slate-500">({triage.priorityRule})</span></dd>
          <dt className="text-slate-500">Red line</dt><dd>{triage.redline.hard ?? "none"}{triage.redline.softFlags.length ? ` · flags ${triage.redline.softFlags.join(", ")}` : ""}</dd>
          <dt className="text-slate-500">Knowledge-base match</dt><dd>{triage.match.level} — {triage.match.reasons.join("; ")}</dd>
          <dt className="text-slate-500">Route reasons</dt><dd>{triage.routeReasons.join("; ")}</dd>
          <dt className="text-slate-500">Passages</dt>
          <dd>
            <ul className="flex flex-col gap-1">
              {triage.retrieval.hits.map((h) => (
                <li key={h.chunkId} className="font-mono text-[11px]">{h.title}{h.page ? ` p.${h.page}` : ""} · score {h.score} · [{h.matchedTerms.join(", ")}]</li>
              ))}
              {triage.retrieval.hits.length === 0 && <li>none</li>}
            </ul>
          </dd>
        </dl>
      </details>

      <ActionArea detail={detail} busy={busy} onAct={act} secondary={secondary} />
      {notice && <p role="alert" data-testid="ticket-notice" className="text-sm text-red-800">{notice}</p>}

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <label htmlFor="acting-as">以此身份操作 Acting as (demo roster, not a login):</label>
        <select
          id="acting-as"
          value={actor}
          onChange={(e) => {
            setActor(e.target.value as SupportAgent);
            try {
              window.localStorage.setItem(AGENT_KEY, e.target.value);
            } catch {
              /* ignore */
            }
          }}
          className="rounded border border-slate-300 bg-white px-2 py-1"
        >
          {SUPPORT_AGENTS.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      {detail.escalations.map((e) => (
        <section key={e.eventId} data-testid="ticket-escalation" className="rounded border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="caption">升级包 Escalation packet · sha256 {e.packetSha256.slice(0, 12)}…</h2>
            <CopyButton text={e.markdown} />
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap bg-slate-50 p-3 font-mono text-[11px] text-slate-800">{e.markdown}</pre>
        </section>
      ))}

      <section className="rounded border border-slate-200 bg-white p-4" data-testid="ticket-timeline">
        <h2 className="caption mb-3">时间线（只追加） Timeline (append-only)</h2>
        <ol className="flex flex-col gap-2">
          {detail.events.map((e) => (
            <li key={e.eventId} className="border-l-2 border-slate-300 pl-3 text-xs text-slate-700">
              <span className="font-mono text-slate-900">{e.eventType}</span> · {e.actor} · {e.occurredAt}
              {e.toStatus && e.fromStatus !== e.toStatus ? ` · ${e.fromStatus ?? "—"} → ${e.toStatus}` : ""}
              {e.requestId ? <span className="font-mono text-slate-500"> · req {e.requestId}</span> : null}
              {typeof e.payload.replyText === "string" && <p className="mt-1 whitespace-pre-wrap text-slate-600">{e.payload.replyText as string}</p>}
              {typeof e.payload.note === "string" && <p className="mt-1 text-slate-600">{e.payload.note as string}</p>}
              {typeof e.payload.resolutionNote === "string" && <p className="mt-1 text-slate-600">{e.payload.resolutionNote as string}</p>}
              {e.payload.edited === true && <p className="mt-1 text-slate-500">(draft edited before approval)</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ActionArea({
  detail,
  busy,
  onAct,
  secondary,
}: {
  detail: TicketDetailView;
  busy: boolean;
  onAct: (a: TicketAction, f: Fields) => void;
  secondary: TicketAction[];
}) {
  const draft = detail.ticket.triage.draft;
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState<SupportAgent | "">("");
  const [escalation, setEscalation] = useState<EscalationInput | null>(detail.escalationSuggestion);
  const [chosen, setChosen] = useState<TicketAction | null>(detail.primaryAction);

  useEffect(() => {
    setChosen(detail.primaryAction);
    setEscalation(detail.escalationSuggestion);
    const usesDraft = detail.primaryAction === "APPROVE_DRAFT" || detail.primaryAction === "LOG_REPLY";
    setText(usesDraft && draft ? draft.text : "");
  }, [detail.ticket.status, detail.primaryAction, detail.escalationSuggestion, draft]);

  if (!detail.primaryAction) {
    return <p data-testid="ticket-done" className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">已解决，无需操作。Resolved — nothing left to do.</p>;
  }

  const action = chosen ?? detail.primaryAction;
  const fields: Fields = { text, assignee, escalation };
  const isPrimary = action === detail.primaryAction;

  return (
    <section data-testid="ticket-action" className="rounded border border-slate-200 bg-white p-4">
      <p className="caption mb-1">下一步 Next step</p>
      <p className="mb-3 text-sm text-slate-800">{detail.nextStep}</p>

      {(action === "APPROVE_DRAFT" || action === "LOG_REPLY") && draft && (
        <div className="mb-3 flex flex-col gap-2">
          <p className="text-xs text-slate-600">
            自动草稿（只引用原文，可编辑）。系统不会发送——批准即记录“已回复”。
            Automated draft (verbatim quotes only; editable). AgentDesk sends nothing — approving records it as replied.
          </p>
          <ul className="flex flex-col gap-1">
            {draft.citations.map((c) => (
              <li key={c.citationId} className="text-xs text-slate-600">
                [{c.citationId}] {c.title}{c.page ? `, p. ${c.page}` : ""}{" "}
                {c.url && <a className="text-[var(--link)] underline" href={c.url} target="_blank" rel="noopener noreferrer">open PDF</a>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {action !== "ASSIGN" && action !== "ESCALATE" && (
        <label className="mb-3 flex flex-col gap-1 text-xs text-slate-600">
          {action === "APPROVE_DRAFT" ? "回复草稿 Reply draft" : TEXT_PROMPT[action]}
          <textarea data-testid="ticket-text" rows={action === "APPROVE_DRAFT" || action === "LOG_REPLY" ? 9 : 3} value={text} onChange={(e) => setText(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 font-mono text-xs text-slate-900" />
        </label>
      )}

      {action === "ASSIGN" && (
        <select value={assignee} onChange={(e) => setAssignee(e.target.value as SupportAgent | "")} className="mb-3 rounded border border-slate-300 bg-white px-2 py-1 text-sm">
          <option value="">— unassign —</option>
          {SUPPORT_AGENTS.map((a) => <option key={a}>{a}</option>)}
        </select>
      )}

      {action === "ESCALATE" && escalation && <EscalationForm value={escalation} onChange={setEscalation} />}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="ticket-submit"
          disabled={busy}
          onClick={() => onAct(action, fields)}
          className={`rounded px-4 py-2 text-sm font-medium disabled:opacity-50 ${isPrimary ? "bg-[var(--action)] text-white hover:bg-[var(--action-hover)]" : "border border-[var(--brand)] bg-white text-[var(--brand)]"}`}
        >
          <BiLine zh={ACTION_LABELS[action].zh} en={ACTION_LABELS[action].en} />
        </button>
        {!isPrimary && (
          <button type="button" className="text-xs text-[var(--link)] underline" onClick={() => setChosen(detail.primaryAction)}>
            ← back to the suggested step
          </button>
        )}
      </div>

      {secondary.length > 0 && (
        <details className="mt-4 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-xs text-slate-600">其他操作 Other actions</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {secondary.map((a) => (
              <button
                key={a}
                type="button"
                data-testid={`ticket-other-${a}`}
                onClick={() => {
                  setChosen(a);
                  setText(a === "LOG_REPLY" && draft ? draft.text : "");
                }}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:border-[var(--brand)]"
              >
                {ACTION_LABELS[a].zh} · {ACTION_LABELS[a].en}
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function EscalationForm({ value, onChange }: { value: EscalationInput; onChange: (v: EscalationInput) => void }) {
  const set = <K extends keyof EscalationInput>(k: K, v: EscalationInput[K]) => onChange({ ...value, [k]: v });
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
  const input = "rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900";
  return (
    <div data-testid="escalation-form" className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <p className="text-xs text-slate-600 sm:col-span-2">
        代码已预填，请核对修改。工单事实、请求 ID 与代码检查项由服务端生成，不可编辑。
        Pre-filled by code — check and edit. Ticket facts, request ids and code checks are added by the server and cannot be edited.
      </p>
      <label className="flex flex-col gap-1 text-xs text-slate-600 sm:col-span-2">摘要 Summary
        <input className={input} value={value.summary} onChange={(e) => set("summary", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600 sm:col-span-2">复现步骤（每行一步）Repro steps (one per line)
        <textarea rows={4} className={input} value={value.reproSteps.join("\n")} onChange={(e) => set("reproSteps", lines(e.target.value))} />
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={value.reproAttempted} onChange={(e) => set("reproAttempted", e.target.checked)} />
        支持已尝试复现 Support attempted repro
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">复现结果 Repro result
        <input className={input} value={value.reproResult} onChange={(e) => set("reproResult", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">预期 Expected
        <input className={input} value={value.expected} onChange={(e) => set("expected", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">实际 Actual
        <input className={input} value={value.actual} onChange={(e) => set("actual", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">影响范围 Affected users
        <input className={input} value={value.affectedUsers} onChange={(e) => set("affectedUsers", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">临时方案 Workaround
        <input className={input} value={value.workaround} onChange={(e) => set("workaround", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600 sm:col-span-2">环境 Environment
        <input className={input} value={value.environment} onChange={(e) => set("environment", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600 sm:col-span-2">已排除（每行一项）Ruled out (one per line)
        <textarea rows={3} className={input} value={value.ruledOut.join("\n")} onChange={(e) => set("ruledOut", lines(e.target.value))} />
      </label>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-testid="copy-markdown"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false));
      }}
      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:border-[var(--brand)]"
    >
      {copied ? "已复制 Copied" : "复制 Markdown Copy"}
    </button>
  );
}
