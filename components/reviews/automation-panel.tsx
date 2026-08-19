"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Post-review automation, made visible.
//
// There is one button and one kind of outcome: an internal task. No recipient
// field, no channel selector, no "send to client" anywhere -- not because they
// are hidden, but because the system has no such capability to expose.
//
// Mock mode is labelled as mock. A demo that shows "Delivered" when nothing
// left the process is claiming an integration it does not have.

type TaskType = "internal_followup" | "internal_revision";
type RunStatus = "pending" | "delivered" | "failed" | "mocked";

interface AutomationRunView {
  automationId: string;
  taskType: TaskType;
  status: RunStatus;
  attemptCount: number;
  externalTaskId: string | null;
  errorCode: string | null;
  updatedAt: string;
}

interface AutomationPayloadView {
  taskType: TaskType;
  title: string;
  actionItems: string[];
  reviewerInstructions: string | null;
  clientDisplayName: string | null;
}

interface AutomationView {
  eligible: boolean;
  taskType: TaskType | null;
  ineligibleReason: string | null;
  payload: AutomationPayloadView | null;
  runs: AutomationRunView[];
}

const INELIGIBLE_TEXT: Record<string, string> = {
  REVIEW_NOT_TERMINAL: "请先完成人工审核。Complete human review first.",
  REJECTED_NO_AUTOMATION: "已拒绝的审核项不产生后续自动化。No post-review automation for rejected reviews.",
  FACTS_UNVERIFIED:
    "比较事实未通过核验，因此无法运行自动化。Automation unavailable because the underlying comparison facts were not verified.",
  MISSING_TERMINAL_EVENT: "缺少对应的审计事件，无法安全去重。The decision's audit event is missing.",
};

const RUN_ACTION: Record<TaskType, string> = {
  internal_followup: "运行内部跟进任务 · Run internal follow-up",
  internal_revision: "创建修改任务 · Create revision task",
};

const STATUS_TEXT: Record<RunStatus, { label: string; tone: string }> = {
  pending: { label: "待发送 · Pending", tone: "border-slate-300 bg-slate-50 text-slate-800" },
  delivered: { label: "已投递至 n8n · Delivered to n8n", tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  failed: { label: "投递失败 · Delivery failed", tone: "border-red-200 bg-red-50 text-red-900" },
  mocked: { label: "演示模式 · Demo / mock", tone: "border-amber-200 bg-amber-50 text-amber-900" },
};

const GENERIC_ERROR = "运行自动化时出现问题，请重试。Something went wrong running the automation.";
const MAX_ATTEMPTS = 3;

export function AutomationPanel({ reviewId }: { reviewId: string }) {
  const [view, setView] = useState<AutomationView | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [running, setRunning] = useState(false);
  // A ref, not the state above: React re-renders asynchronously, so two clicks
  // in the same tick both see `running === false`. The database deduplicates
  // either way, but a stray double-click should not inflate the attempt count.
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/automation`);
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(typeof data?.message === "string" ? data.message : GENERIC_ERROR);
        return;
      }
      setView(data as AutomationView);
    } catch {
      setErrorMessage(GENERIC_ERROR);
    }
  }, [reviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  // One in-flight run at a time. The database deduplicates anyway, but the
  // reviewer should not have to learn that from a surprising result.
  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/reviews/${reviewId}/automation`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(typeof data?.message === "string" ? data.message : GENERIC_ERROR);
        return;
      }
      setView(data as AutomationView);
    } catch {
      setErrorMessage(GENERIC_ERROR);
    } finally {
      inFlight.current = false;
      setRunning(false);
    }
  }, [reviewId]);

  if (!view) return null;

  const latest = view.runs.at(-1) ?? null;
  const delivered = latest?.status === "delivered";
  const exhausted = (latest?.attemptCount ?? 0) >= MAX_ATTEMPTS;
  // Re-running a delivered automation would create a second task in n8n for
  // one human decision, so the control goes away once it has landed.
  const canRun = view.eligible && !delivered && !exhausted;

  return (
    <section
      data-testid="automation-panel"
      data-eligible={String(view.eligible)}
      data-task-type={view.taskType ?? ""}
      data-status={latest?.status ?? "none"}
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 className="text-sm font-semibold text-slate-800">审核后自动化 · Post-review automation</h2>
      <p className="mt-1 text-xs text-slate-500">
        自动化只产生**内部**任务。本系统没有对外发送客户沟通的能力。
        <br />
        Automation only ever creates an <strong>internal</strong> task. This system has no ability to send
        client communication.
      </p>

      {!view.eligible && (
        <p data-testid="automation-unavailable" data-reason={view.ineligibleReason ?? ""} className="mt-3 text-sm text-slate-700">
          {INELIGIBLE_TEXT[view.ineligibleReason ?? ""] ?? "自动化当前不可用。Automation is not available."}
        </p>
      )}

      {view.eligible && view.payload && (
        <div data-testid="automation-preview" className="mt-3 rounded border border-slate-200 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {view.payload.taskType === "internal_revision"
              ? "内部修改任务 · Internal revision task"
              : "内部跟进任务 · Internal follow-up task"}
          </p>
          <p data-testid="automation-task-title" className="mt-1 text-sm font-medium text-slate-900">
            {view.payload.title}
          </p>
          {view.payload.reviewerInstructions && (
            <p data-testid="automation-instructions" className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700">
              {view.payload.reviewerInstructions}
            </p>
          )}
          {view.payload.actionItems.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {view.payload.actionItems.map((item) => (
                <li key={item} data-testid="automation-action-item" className="text-sm text-slate-700">
                  · {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {latest && (
        <div
          data-testid="automation-result"
          data-status={latest.status}
          className={`mt-3 rounded border p-3 text-sm ${STATUS_TEXT[latest.status].tone}`}
        >
          <p className="font-medium">{STATUS_TEXT[latest.status].label}</p>
          {latest.status === "mocked" && (
            <p data-testid="automation-mock-note" className="mt-1 text-xs">
              演示自动化已在本地完成，未调用任何外部 n8n webhook。
              <br />
              Demo automation completed locally. No external n8n webhook was called.
            </p>
          )}
          {latest.status === "delivered" && latest.externalTaskId && (
            <p data-testid="automation-task-id" className="mt-1 font-mono text-xs">
              task {latest.externalTaskId}
            </p>
          )}
          {latest.status === "failed" && (
            <p className="mt-1 text-xs">
              {latest.errorCode} · 审核决定与审计记录不受影响。The review decision and its audit history are
              unaffected.
            </p>
          )}
          <p className="mt-1 text-xs opacity-80">
            <span className="whitespace-nowrap">尝试次数 attempts {latest.attemptCount}</span> ·{" "}
            <time dateTime={latest.updatedAt} className="whitespace-nowrap tabular-nums">
              {latest.updatedAt.slice(0, 10)} {latest.updatedAt.slice(11, 16)}
            </time>
          </p>
        </div>
      )}

      {errorMessage && (
        <p data-testid="automation-error" role="alert" className="mt-3 text-sm text-red-800">
          {errorMessage}
        </p>
      )}

      {canRun && (
        <button
          type="button"
          data-testid="run-automation"
          disabled={running}
          onClick={() => void run()}
          className="mt-3 rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[#16304f] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          {running
            ? "运行中… Running…"
            : latest?.status === "failed"
              ? "重试 · Retry"
              : latest
                ? // It already ran (demo mode, or still pending). Repeating the
                  // original call-to-action would read as "nothing happened yet".
                  "重新运行 · Run again"
                : RUN_ACTION[view.taskType ?? "internal_followup"]}
        </button>
      )}
      {view.eligible && exhausted && !delivered && (
        <p data-testid="automation-exhausted" className="mt-3 text-sm text-slate-700">
          已达到重试上限,请人工处理。Retry limit reached; handle this manually.
        </p>
      )}
    </section>
  );
}
