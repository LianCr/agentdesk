"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatMinutes } from "../../lib/support/sla";
import type { SupportMetrics } from "../../lib/support/metrics";
import type { KbGap } from "../../lib/support/gaps";
import type { TicketSummaryView } from "../../lib/support/views";
import { BiLine, CATEGORY_LABELS, PRIORITY_TONE, Pill, SLA_LABELS, SLA_TONE, STATUS_LABELS, SyntheticNotice } from "./labels";

// The support queue: sorted by SLA risk on the server, so the first row is
// always the one to look at. Metrics and knowledge-base gaps sit in folded
// layers — for whoever needs to check, not for whoever needs to act.

const FILTERS = [
  { value: "open", zh: "未关闭", en: "Open" },
  { value: "needs_human", zh: "待人工", en: "Needs human" },
  { value: "draft_ready", zh: "草稿待批", en: "Draft ready" },
  { value: "waiting_on_requester", zh: "等待提交人", en: "Waiting" },
  { value: "escalated", zh: "已升级", en: "Escalated" },
  { value: "resolved", zh: "已解决", en: "Resolved" },
  { value: "all", zh: "全部", en: "All" },
] as const;

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function slaText(t: TicketSummaryView): string {
  if (t.status === "resolved") return t.sla.resolution.state === "met" ? "resolved within SLA" : "resolved late";
  const clock = t.responded ? t.sla.resolution : t.sla.firstResponse;
  const late = t.responded && t.sla.firstResponse.state === "breached" ? "1st response was late · " : "";
  return `${late}${t.responded ? "resolve" : "1st response"} ${formatMinutes(clock.minutesRemaining)}`;
}

export function SupportQueue() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("open");
  const [tickets, setTickets] = useState<TicketSummaryView[] | null>(null);
  const [metrics, setMetrics] = useState<SupportMetrics | null>(null);
  const [gaps, setGaps] = useState<KbGap[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (f: string) => {
    setTickets(null);
    setFailed(false);
    try {
      const res = await fetch(`/api/support/tickets?status=${f}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.tickets)) return setFailed(true);
      setTickets(data.tickets);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  useEffect(() => {
    fetch("/api/support/metrics").then((r) => (r.ok ? r.json() : null)).then(setMetrics).catch(() => setMetrics(null));
    fetch("/api/support/kb-gaps").then((r) => (r.ok ? r.json() : null)).then((d) => setGaps(d?.gaps ?? null)).catch(() => setGaps(null));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="caption">Support Desk · M9</p>
        <h1 data-testid="support-title" className="text-3xl font-semibold text-[var(--brand)]">支持工单队列</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          工单进来时由规则 + 知识库检索自动分诊（无大模型）：分类、P1–P4、带原文引用的回复草稿。按 SLA 风险排序。
          <br />
          Tickets are triaged on arrival by rules + knowledge-base retrieval (no LLM): category, P1–P4, and a reply
          draft quoting the docs verbatim. Sorted by SLA risk.
        </p>
        <SyntheticNotice />
      </header>

      {metrics && (
        <section data-testid="support-metrics" aria-label="Metrics" className="grid grid-cols-2 gap-px overflow-hidden rounded border border-slate-200 bg-slate-200 sm:grid-cols-5">
          {[
            { zh: "未关闭", en: "Open backlog", v: String(Object.values(metrics.backlogByPriority).reduce((a, b) => a + b, 0)) },
            { zh: "首响中位数", en: "Median 1st response", v: metrics.medianFirstResponseMinutes === null ? "—" : `${metrics.medianFirstResponseMinutes} min` },
            { zh: "首响 SLA 达成", en: "1st-response SLA met", v: pct(metrics.firstResponseSlaHitRate) },
            { zh: "草稿直接采纳", en: "Drafts approved unedited", v: pct(metrics.autoDraftAcceptanceRate) },
            { zh: "升级率", en: "Escalation rate", v: pct(metrics.escalationRate) },
          ].map((m) => (
            <div key={m.en} className="bg-white px-3 py-2">
              <p className="font-mono text-lg text-slate-900">{m.v}</p>
              <BiLine zh={m.zh} en={m.en} className="text-xs text-slate-600" />
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div data-testid="support-filters" className="flex flex-wrap gap-2">
          {FILTERS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={filter === o.value}
              onClick={() => setFilter(o.value)}
              className={`rounded-full border px-3 py-1 text-center text-sm leading-tight ${
                filter === o.value ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-[var(--brand)]"
              }`}
            >
              <BiLine zh={o.zh} en={o.en} />
            </button>
          ))}
        </div>
        <Link href="/support/handoff" data-testid="support-handoff-link" className="text-sm text-[var(--link)] underline underline-offset-2">
          交接班摘要 Shift handoff →
        </Link>
      </div>

      <div aria-live="polite">
        {tickets === null && !failed && <p className="text-sm text-slate-600">载入中… Loading…</p>}
        {failed && (
          <p role="alert" data-testid="support-error" className="text-sm text-red-800">
            读取工单时出现问题，请重试。Something went wrong loading tickets.
          </p>
        )}
        {tickets?.length === 0 && <p className="text-sm text-slate-600">没有符合条件的工单。No tickets match this filter.</p>}
        {tickets && tickets.length > 0 && (
          <ul data-testid="support-rows" className="flex flex-col divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {tickets.map((t) => (
              <li key={t.ticketId} data-testid="support-row" data-ticket-id={t.ticketId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex shrink-0 items-center gap-2 sm:w-40">
                  <Pill tone={PRIORITY_TONE[t.priority]!}>{t.priority}</Pill>
                  <Pill tone={SLA_TONE[t.sla.overall]} testId="support-row-sla">{SLA_LABELS[t.sla.overall].zh} · {SLA_LABELS[t.sla.overall].en}</Pill>
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/support/${t.ticketId}`} className="block truncate text-sm font-medium text-[var(--brand)] underline-offset-2 hover:underline">
                    {t.subject}
                  </Link>
                  <p className="text-xs text-slate-500 sm:truncate">
                    {t.requester} · {CATEGORY_LABELS[t.category].zh} {CATEGORY_LABELS[t.category].en} · <span className="font-mono">{slaText(t)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col text-xs text-slate-600 sm:w-48">
                  <span className="text-slate-800">{STATUS_LABELS[t.status].zh} · {STATUS_LABELS[t.status].en}</span>
                  <span>{t.assignee ?? "未指派 unassigned"} — {t.nextStep}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NewTicketForm onCreated={() => void load(filter)} />

      {gaps && (
        <details data-testid="support-kb-gaps" className="rounded border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">
            知识库缺口 Knowledge-base gaps ({gaps.length})
          </summary>
          <p className="mt-2 text-xs text-slate-600">
            知识库匹配不好的可回答工单，按知识库从未出现的词分组。文章答案留给人写，系统不生成。
            Answerable tickets the knowledge base matched poorly, grouped by words it has never seen. The answer is
            left for a person to write — it is not generated.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {gaps.map((g) => (
              <li key={g.gapKey} className="rounded border border-slate-200 p-3">
                <p className="text-sm text-slate-800">{g.suggestedArticle.title}</p>
                <p className="text-xs text-slate-500">{g.count} ticket(s) · missing terms: {g.terms.join(", ")}</p>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap bg-slate-50 p-2 font-mono text-[11px] text-slate-700">{g.suggestedArticle.markdown}</pre>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function NewTicketForm({ onCreated }: { onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [requester, setRequester] = useState("Synthetic Broker 99");
  const [state, setState] = useState<"idle" | "sending" | "error" | "limited">("idle");
  const [created, setCreated] = useState<{ id: string; route: string; category: string; priority: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, body, requester, channel: "form" }),
      });
      const data = await res.json();
      if (res.status === 429) return setState("limited");
      if (!res.ok) return setState("error");
      setCreated({ id: data.ticket.ticketId, route: data.ticket.triage.route, category: data.ticket.category, priority: data.ticket.priority });
      setSubject("");
      setBody("");
      setState("idle");
      onCreated();
    } catch {
      setState("error");
    }
  }

  return (
    <details data-testid="support-new-ticket" className="rounded border border-slate-200 bg-white px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-800">提交测试工单 Submit a test ticket</summary>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <p className="text-xs text-slate-600">请只填写虚构内容，勿填真实客户信息。Use made-up content only — no real customer details.</p>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          标题 Subject
          <input required minLength={3} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          描述 Description
          <textarea required minLength={3} maxLength={5000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          提交人（虚构） Requester (synthetic)
          <input required maxLength={120} value={requester} onChange={(e) => setRequester(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
        </label>
        <button type="submit" disabled={state === "sending"} className="self-start rounded border border-[var(--brand)] bg-white px-3 py-1.5 text-sm text-[var(--brand)] disabled:opacity-50">
          {state === "sending" ? "分诊中… Triaging…" : "提交并分诊 Submit & triage"}
        </button>
        {state === "error" && <p role="alert" className="text-xs text-red-800">提交失败，请重试。Could not create the ticket.</p>}
        {state === "limited" && <p role="alert" className="text-xs text-red-800">请求太频繁，请稍后再试。Too many tickets — try again in a few minutes.</p>}
        {created && (
          <p data-testid="support-created" className="text-xs text-slate-700">
            已创建 Created: <Link className="text-[var(--link)] underline" href={`/support/${created.id}`}>{created.id}</Link> → {created.category} · {created.priority} · {created.route}
          </p>
        )}
      </form>
    </details>
  );
}
