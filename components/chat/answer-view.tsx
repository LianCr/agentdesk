import type { ReactNode } from "react";
import { CitationCard } from "../citations/citation-card";
import { EvidenceBadge } from "../evidence/evidence-badge";
import { EvidenceSummary } from "../evidence/evidence-summary";
import type { GroundedAnswer } from "./types";

const MISSING_LABELS = ["**资料中缺少:**", "**Missing from documents:**"];
const NEXT_STEP_LABELS = ["**建议下一步:**", "**Suggested next step:**"];

const REVIEW_REASON_LABELS: Record<string, string> = {
  FINAL_RECOMMENDATION_REQUESTED: "最终推荐请求 Final recommendation requested",
  GUARANTEE_REQUESTED: "收益保证请求 Guarantee request",
  LEGAL_TAX_ADVICE_REQUESTED: "税务/法律问题 Tax or legal topic",
  OUT_OF_KB_ESTIMATION_REQUEST: "要求估算资料外数值 Estimation of undocumented value requested",
  ILLUSTRATION_VALUE_REQUESTED: "演示数值请求 Illustration values requested",
  INSUFFICIENT_EVIDENCE: "资料不足以回答 Not enough in the documents",
  PROMPT_INJECTION_SUSPECTED: "输入包含可疑指令 Suspicious instructions in the input",
  MODEL_OUTPUT_INVALID: "结果未通过自动检查 Result failed automatic checks",
  NOT_IN_KNOWLEDGE_BASE: "资料未涵盖 Not covered by the documents",
  OFF_TOPIC: "与保险资料无关 Unrelated to the documents",
};

interface SplitAnswer {
  mainLines: string[];
  missingLines: string[];
  nextStep: string | null;
}

function startsWithLabel(line: string, labels: string[]): string | null {
  const trimmed = line.trim();
  for (const label of labels) {
    if (trimmed.startsWith(label)) {
      return label;
    }
  }
  return null;
}

function extractNextStep(lines: string[]): { lines: string[]; nextStep: string | null } {
  const index = lines.findIndex((line) => startsWithLabel(line, NEXT_STEP_LABELS) !== null);
  if (index === -1) {
    return { lines, nextStep: null };
  }
  const line = lines[index] ?? "";
  const label = startsWithLabel(line, NEXT_STEP_LABELS) ?? "";
  const nextStep = line.trim().slice(label.length).trim();
  return {
    lines: [...lines.slice(0, index), ...lines.slice(index + 1)],
    nextStep,
  };
}

function splitAnswer(answer: string): SplitAnswer {
  const allLines = answer.split("\n");
  const missingIndex = allLines.findIndex(
    (line) => startsWithLabel(line, MISSING_LABELS) !== null,
  );

  let mainLines: string[];
  let missingLines: string[];
  if (missingIndex === -1) {
    mainLines = allLines;
    missingLines = [];
  } else {
    mainLines = allLines.slice(0, missingIndex);
    missingLines = allLines.slice(missingIndex + 1);
    const labelLine = allLines[missingIndex] ?? "";
    const label = startsWithLabel(labelLine, MISSING_LABELS) ?? "";
    const trailing = labelLine.trim().slice(label.length).trim();
    if (trailing.length > 0) {
      missingLines = [trailing, ...missingLines];
    }
  }

  const mainResult = extractNextStep(mainLines);
  if (mainResult.nextStep !== null) {
    return {
      mainLines: mainResult.lines,
      missingLines,
      nextStep: mainResult.nextStep,
    };
  }
  const missingResult = extractNextStep(missingLines);
  return {
    mainLines: mainResult.lines,
    missingLines: missingResult.lines,
    nextStep: missingResult.nextStep,
  };
}

/** Render inline text, turning citation markers like [1][2] into subtle superscript badges. */
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts
    .filter((part) => part.length > 0)
    .map((part, index) => {
      const marker = part.match(/^\[(\d+)\]$/);
      if (marker) {
        return (
          <sup
            key={index}
            className="ml-0.5 rounded bg-slate-100 px-1 text-[0.65rem] font-medium text-slate-600"
          >
            {marker[1]}
          </sup>
        );
      }
      return <span key={index}>{part}</span>;
    });
}

/** Deterministic renderer for the constrained answer syntax. No markdown library. */
function renderAnswerLines(lines: string[]): ReactNode[] {
  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = (key: string) => {
    if (bulletBuffer.length === 0) return;
    const items = bulletBuffer;
    bulletBuffer = [];
    blocks.push(
      <ul key={key} className="list-disc space-y-1.5 pl-5">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-slate-700">
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.length === 0) {
      flushBullets(`ul-${index}`);
      return;
    }
    if (line.startsWith("- ")) {
      bulletBuffer.push(line.slice(2));
      return;
    }
    flushBullets(`ul-${index}`);

    const bold = line.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
    if (bold) {
      const boldText = bold[1] ?? "";
      const rest = bold[2] ?? "";
      if (rest.length === 0) {
        blocks.push(
          <h3 key={index} className="text-sm font-semibold text-slate-900">
            {renderInline(boldText)}
          </h3>,
        );
      } else {
        blocks.push(
          <p key={index} className="text-sm leading-relaxed text-slate-700">
            <strong className="font-semibold text-slate-900">{boldText}</strong>{" "}
            {renderInline(rest)}
          </p>,
        );
      }
      return;
    }
    blocks.push(
      <p key={index} className="text-sm leading-relaxed text-slate-700">
        {renderInline(line)}
      </p>,
    );
  });

  flushBullets("ul-end");
  return blocks;
}

function ReviewBanner({ reasons }: { reasons: string[] }) {
  return (
    <div
      data-testid="review-banner"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4"
    >
      <p className="text-sm font-semibold text-amber-900">
        需要持牌保险经纪人审核 · Licensed-agent review required
      </p>
      {reasons.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {reasons.map((reason) => (
            <li
              key={reason}
              className="rounded-full border border-amber-200 bg-white px-3 py-0.5 text-xs text-amber-800"
            >
              {REVIEW_REASON_LABELS[reason] ?? reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnswerView({ result }: { result: GroundedAnswer }) {
  const { mainLines, missingLines, nextStep } = splitAnswer(result.answer);
  const missingItems = missingLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.startsWith("- ") ? line.slice(2) : line));

  return (
    <div data-testid="answer-view" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <EvidenceBadge status={result.evidenceStatus} />
        {result.refusal.isRefusal && (
          <span data-testid="refusal-reason" className="text-xs text-slate-600">
            {REVIEW_REASON_LABELS[result.refusal.reasonCode ?? ""] ?? "无法回答 Unable to answer"}
          </span>
        )}
      </div>

      {result.reviewRequired && <ReviewBanner reasons={result.reviewReasons} />}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div data-testid="answer-content" className="flex min-w-0 flex-col gap-3">
          {renderAnswerLines(mainLines)}
        </div>
      </div>

      {missingItems.length > 0 && (
        <div
          data-testid="missing-info"
          className="rounded-lg border border-slate-200 bg-[var(--brand-soft)] p-4 sm:p-5"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            资料中没有提供 · What is missing
          </h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            {missingItems.map((item, index) => (
              <li key={index} className="text-sm leading-relaxed text-slate-700">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextStep !== null && nextStep.length > 0 && (
        <div
          data-testid="next-step"
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            建议下一步 · Suggested next step
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {renderInline(nextStep)}
          </p>
        </div>
      )}

      <EvidenceSummary result={result} />

      {result.citations.length > 0 && (
        <section aria-label="引用来源 Citations">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            原文引用 · Source citations
          </h2>
          <div
            data-testid="citation-list"
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {result.citations.map((citation) => (
              <CitationCard key={citation.citationId} citation={citation} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
