import type { ReactNode } from "react";
import Link from "next/link";
import { CitationCard } from "../citations/citation-card";
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

/**
 * Drop what the reader has already read. The model sometimes repeats a
 * claim under a second heading ("evidence excerpts" restating the answer).
 * A bullet that already appeared is removed; a heading left with nothing but
 * its intro sentence goes with it. Pure text comparison, no judgement.
 */
function dropRepeatedSections(lines: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      const key = line.slice(2).replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
    }
    kept.push(raw);
  }
  // Remove heading blocks that lost all their bullets.
  const out: string[] = [];
  let i = 0;
  while (i < kept.length) {
    const line = kept[i]?.trim() ?? "";
    const isHeading = /^\*\*[^*]+\*\*$/.test(line);
    if (!isHeading) {
      out.push(kept[i] ?? "");
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < kept.length && !/^\*\*[^*]+\*\*$/.test(kept[j]?.trim() ?? "")) j += 1;
    const block = kept.slice(i, j);
    const hasBullet = block.some((l) => l.trim().startsWith("- "));
    const prose = block.slice(1).filter((l) => l.trim().length > 0);
    if (hasBullet || prose.length > 1) out.push(...block);
    i = j;
  }
  return out;
}

/** The panel already says "Answer"; a first line that only says it again is dropped. */
function dropLeadingHeading(lines: string[]): string[] {
  const first = lines.findIndex((l) => l.trim().length > 0);
  if (first === -1) return lines;
  return /^\*\*[^*]+\*\*$/.test(lines[first]?.trim() ?? "") ? [...lines.slice(0, first), ...lines.slice(first + 1)] : lines;
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
  // One sentence, then the reasons as small chips. The reasons stay on screen
  // for anyone auditing the decision, but they are not a second headline.
  return (
    <div data-testid="review-banner" className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-amber-900">
        需要持牌保险经纪人审核 · Licensed-agent review required
      </p>
      {reasons.length > 0 && (
        <ul className="flex flex-wrap gap-2">
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

// The one real-world action that follows this answer.
//
// Decided by code from the answer's verified state, never by the model: the
// model's suggested next step (when there is one) is shown as explanation, the
// link target and the action itself come from this table. A refusal that asked
// for a recommendation is routed to the comparison draft; a question the
// documents do not answer is routed back to the documents or to a person;
// a cited answer is told where it may be used and where it may not.

type NextActionKind =
  | "usable_internally"
  | "needs_agent_before_client"
  | "ask_the_documents"
  | "compare_instead"
  | "hand_to_a_person";

const COMPARE_INSTEAD_CODES = new Set([
  "FINAL_RECOMMENDATION_REQUESTED",
  "GUARANTEE_REQUESTED",
  "ILLUSTRATION_VALUE_REQUESTED",
  "OUT_OF_KB_ESTIMATION_REQUEST",
]);

function classifyNextAction(result: GroundedAnswer): NextActionKind {
  if (result.refusal.isRefusal) {
    const code = result.refusal.reasonCode ?? "";
    if (COMPARE_INSTEAD_CODES.has(code)) return "compare_instead";
    if (code === "INSUFFICIENT_EVIDENCE" || code === "NOT_IN_KNOWLEDGE_BASE") return "ask_the_documents";
    return "hand_to_a_person";
  }
  if (result.evidenceStatus !== "strong") return "ask_the_documents";
  return result.reviewRequired ? "needs_agent_before_client" : "usable_internally";
}

/** The product this answer is mostly about, for pre-filling the comparison. */
function dominantDocumentId(result: GroundedAnswer): string | null {
  const counts = new Map<string, number>();
  for (const citation of result.citations) {
    counts.set(citation.documentId, (counts.get(citation.documentId) ?? 0) + 1);
  }
  let dominant: string | null = null;
  let dominantCount = 0;
  for (const [documentId, count] of counts) {
    if (count > dominantCount) {
      dominant = documentId;
      dominantCount = count;
    }
  }
  return dominant;
}

function NextActionCard({ result, modelNextStep }: { result: GroundedAnswer; modelNextStep: string | null }) {
  const kind = classifyNextAction(result);
  const documentId = dominantDocumentId(result);
  const compareHref = documentId ? `/compare?a=${encodeURIComponent(documentId)}` : "/compare";
  const firstSource = result.citations.find((c) => c.sourceUrl !== null) ?? null;
  // The model's own "next step" is shown only where the action IS to go and
  // ask -- there it names what to ask for. Under a cited answer it is a hedge
  // that contradicts the verdict above it, so it is not shown.
  const explanation =
    kind === "ask_the_documents" || kind === "hand_to_a_person"
      ? (modelNextStep ?? result.refusal.suggestedNextStep)
      : null;

  const COPY: Record<NextActionKind, { zh: string; en: string }> = {
    usable_internally: {
      zh: "每个事实都有出处。内部可以直接用。",
      en: "Every fact has a source. Fine to use internally.",
    },
    needs_agent_before_client: {
      zh: "内部能看。给客户前，先让持牌经纪人审。",
      en: "Fine internally. A licensed agent checks it before any client sees it.",
    },
    ask_the_documents: {
      zh: "资料里没写这一项。到这里为止，去问客户或承保方。",
      en: "The documents do not say. Stop here; ask the client or the carrier.",
    },
    compare_instead: {
      zh: "系统不做推荐。先做两个产品的比较表，再交持牌经纪人审。",
      en: "This system does not recommend. Build a two-product comparison, then send it to a licensed agent.",
    },
    hand_to_a_person: {
      zh: "这类问题系统不答。到这里为止，交给持牌经纪人或合规。",
      en: "Not a question for this system. Stop here; hand it to a licensed agent or compliance.",
    },
  };

  const copy = COPY[kind];
  const LINK_CLASS =
    "inline-flex w-fit items-center rounded bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--action-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2";

  return (
    <div
      data-testid="next-step"
      data-next-action={kind}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 border-l-[3px] border-l-[var(--action)] bg-white p-4 sm:p-5"
    >
      <h3 className="caption">下一步 · Next step</h3>
      <p className="text-sm leading-relaxed text-slate-800">
        <span data-register="zh" className="block">{copy.zh}</span>
        <span data-register="en" className="block text-xs text-slate-600">{copy.en}</span>
      </p>
      {explanation && explanation.length > 0 && (
        <p className="text-sm leading-relaxed text-slate-700">{renderInline(explanation)}</p>
      )}
      {result.reviewRequired && <ReviewBanner reasons={result.reviewReasons} />}
      {(kind === "usable_internally" || kind === "needs_agent_before_client" || kind === "compare_instead") && (
        <Link data-testid="next-action-link" href={compareHref} className={LINK_CLASS}>
          生成比较草稿 · Build a comparison draft →
        </Link>
      )}
      {kind === "ask_the_documents" && firstSource && (
        <a
          data-testid="next-action-link"
          href={firstSource.sourceUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          打开原文第 {firstSource.pageStart} 页 · Open source page {firstSource.pageStart} ↗
        </a>
      )}
    </div>
  );
}

export function AnswerView({ result }: { result: GroundedAnswer }) {
  const { mainLines: rawMain, missingLines, nextStep } = splitAnswer(result.answer);
  const mainLines = dropLeadingHeading(dropRepeatedSections(rawMain));
  // Code decides whether a gap is material (an unsupported required facet).
  // When it says no and the evidence is strong, the model's list is caveats,
  // not missing information -- kept for the curious, folded out of the way.
  const gapsAreMaterial =
    result.evidenceStatus !== "strong" || result.materialMissingInformation.length > 0;
  const missingItems = missingLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.startsWith("- ") ? line.slice(2) : line));

  return (
    <div data-testid="answer-view" className="flex min-w-0 flex-col gap-4">
      <EvidenceSummary result={result} />
      {result.refusal.isRefusal && (
        <p data-testid="refusal-reason" className="-mt-2 text-xs text-slate-600">
          {REVIEW_REASON_LABELS[result.refusal.reasonCode ?? ""] ?? "无法回答 Unable to answer"}
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <p className="caption mb-3">回答 · Answer</p>
        <div data-testid="answer-content" className="flex min-w-0 flex-col gap-3">
          {renderAnswerLines(mainLines)}
        </div>
      </div>

      {missingItems.length > 0 && gapsAreMaterial && (
        <div
          data-testid="missing-info"
          className="rounded-lg border border-slate-200 bg-[var(--brand-soft)] p-4 sm:p-5"
        >
          <h3 className="caption">资料中没有提供 · What is missing</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            {missingItems.map((item, index) => (
              <li key={index} className="text-sm leading-relaxed text-slate-700">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The one action that follows. Everything after it is evidence and
          audit detail for whoever wants to check the work. */}
      <NextActionCard result={result} modelNextStep={nextStep} />

      {result.citations.length > 0 && (
        <section aria-label="引用来源 Citations">
          <h2 className="caption mb-3">原文引用 · Source citations</h2>
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

      {missingItems.length > 0 && !gapsAreMaterial && (
        <details
          data-testid="answer-notes"
          className="group rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
            <span className="caption">其他说明 · Notes</span>
            <span className="text-xs text-slate-600">
              {missingItems.length} 条 {missingItems.length === 1 ? "note" : "notes"}{" "}
              <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">▾</span>
            </span>
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            {missingItems.map((item, index) => (
              <li key={index} className="text-sm leading-relaxed text-slate-700">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        </details>
      )}

    </div>
  );
}
