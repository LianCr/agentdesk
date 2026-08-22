"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerView } from "./answer-view";
import { PresetQuestions } from "./preset-questions";
import { lookupPresetAnswer } from "./preset-answers";
import { QuestionInput } from "./question-input";
import { KnowledgeBasePanel, type KnowledgeSummaryView } from "./knowledge-base-panel";
import { Disclaimer } from "../shell/disclaimer";
import type { GroundedAnswer, Phase } from "./types";

const LOADING_STAGES = [
  "正在查找相关保险资料… Searching the policy documents…",
  "正在整理资料并撰写回答… Reading the sources and writing the answer…",
  "正在逐条核对引用页码… Checking every quote against its page…",
] as const;

// Real number, measured: a grounded answer takes 15-20s because retrieval,
// generation and citation validation all actually run. Saying so beats a fake
// progress bar, and beats leaving someone wondering whether it hung.
const WAIT_NOTE =
  "演示环境通常需要约 15–20 秒。This demo usually takes about 15–20 seconds.";

const GENERIC_ERROR_MESSAGE =
  "请求失败，请稍后重试。The request failed, please try again later.";

function LoadingStages({ activeStage }: { activeStage: number }) {
  return (
    <div data-testid="loading-stages" className="flex flex-col gap-2">
      {LOADING_STAGES.map((stage, index) => (
        <p
          key={stage}
          className={`flex items-baseline gap-3 text-sm transition-opacity duration-300 ${
            index <= activeStage ? "text-slate-700" : "text-slate-400 opacity-60"
          }`}
        >
          <span className="w-6 shrink-0 text-xs font-medium tabular-nums text-[var(--brand)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span>{stage}</span>
        </p>
      ))}
      <p data-testid="loading-wait-note" className="mt-1 text-xs text-slate-500">
        {WAIT_NOTE}
      </p>
    </div>
  );
}

export function AssistantDemo({ knowledgeSummary }: { knowledgeSummary: KnowledgeSummaryView }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GroundedAnswer | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeStage, setActiveStage] = useState(0);
  // Presentation-level only: the answer contract is unchanged.
  const [fromSavedAnswer, setFromSavedAnswer] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (phase !== "loading") {
      return;
    }
    setActiveStage(0);
    const t1 = setTimeout(() => setActiveStage(1), 1500);
    const t2 = setTimeout(() => setActiveStage(2), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  const submit = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length === 0) {
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    // Exact preset match: show the saved, pre-verified answer immediately.
    // Anything else -- including a preset with one word changed -- runs the
    // real pipeline below.
    const saved = lookupPresetAnswer(trimmed);
    if (saved) {
      setErrorMessage("");
      setResult(saved);
      setFromSavedAnswer(true);
      setPhase("done");
      return;
    }

    setFromSavedAnswer(false);
    setPhase("loading");
    setResult(null);
    setErrorMessage("");

    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (!response.ok) {
        let message = GENERIC_ERROR_MESSAGE;
        try {
          const body = (await response.json()) as { message?: unknown };
          if (typeof body.message === "string" && body.message.length > 0) {
            message = body.message;
          }
        } catch {
          // Unparsable error body — keep the generic bilingual fallback.
        }
        setErrorMessage(message);
        setPhase("error");
        return;
      }
      const data = (await response.json()) as GroundedAnswer;
      if (requestId !== requestIdRef.current) {
        return;
      }
      setResult(data);
      setPhase("done");
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setErrorMessage(GENERIC_ERROR_MESSAGE);
      setPhase("error");
    }
  }, []);

  const [fillFlash, setFillFlash] = useState(0);
  const handlePreset = useCallback(
    (question: string) => {
      setQuery(question);
      // The click IS the input: the question box pulses so the eye sees where
      // the words landed before the answer starts loading.
      setFillFlash((n) => n + 1);
      void submit(question);
    },
    [submit],
  );

  const isLoading = phase === "loading";


  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-3">
          <p data-testid="hero-label" className="text-sm leading-snug text-slate-600">
            <span data-register="zh" className="block">
              持牌经纪人内部知识助手
            </span>
            <span data-register="en" className="mt-0.5 block text-xs text-slate-500">
              Internal knowledge assistant for licensed agents
            </span>
          </p>
          <h1
            data-testid="hero-title"
            className="text-3xl font-semibold text-[var(--brand)]"
          >
            AgentDesk
          </h1>
          <p data-testid="hero-tagline" className="max-w-2xl text-sm leading-relaxed text-slate-600">
            中文提问，从英文保险资料中查出答案，并附可核对的原文引用与页码。
            <br />
            Ask in Chinese. Every answer comes from the English insurance documents, with page references.
          </p>
          {/* What the whole project does, not just this page. Someone landing
              here should be able to tell in one line that the other two tabs
              exist and why. Plain description, no claims about quality. */}
          <p data-testid="hero-scope" className="max-w-3xl text-xs leading-relaxed text-slate-500">
            本项目还包括：带逐格引用的
            <Link href="/compare" className="underline underline-offset-2 hover:text-[var(--brand)]">产品比较草稿</Link>
            、把敏感情形自动转交
            <Link href="/review" className="underline underline-offset-2 hover:text-[var(--brand)]">人工审核</Link>
            、以及审核通过后触发内部跟进任务。
            <br />
            The project also builds a{" "}
            <Link href="/compare" className="underline underline-offset-2 hover:text-[var(--brand)]">product comparison draft</Link>{" "}
            with per-cell citations, hands sensitive cases to{" "}
            <Link href="/review" className="underline underline-offset-2 hover:text-[var(--brand)]">human review</Link>, and turns a
            completed review into an internal follow-up task.
          </p>

        </header>

        {/* Between the pitch and the question box: it answers "what is it
            searching?", and the next thing you do is ask. */}
        <KnowledgeBasePanel summary={knowledgeSummary} />

        <PresetQuestions disabled={isLoading} onSelect={handlePreset} />

        <QuestionInput
          fillFlash={fillFlash}
          query={query}
          disabled={isLoading}
          onQueryChange={setQuery}
          onSubmit={() => void submit(query)}
        />

        <div
          data-testid="status-region"
          aria-live="polite"
          className={
            isLoading
              ? "rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              : ""
          }
        >
          {isLoading && <LoadingStages activeStage={activeStage} />}
          {phase === "done" && (
            <span className="sr-only">回答已生成 Answer ready</span>
          )}
        </div>

        {phase === "error" && (
          <div
            data-testid="error-message"
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {errorMessage}
          </div>
        )}

        {phase === "done" && fromSavedAnswer && (
          // Plain language, not cache jargon. Without it an instant preset
          // answer implies the live pipeline is instant, and the very next
          // free-form question would say 15-20 seconds.
          <p data-testid="saved-answer-note" className="text-xs text-slate-500">
            示例问题使用已核验的预存回答，以便快速演示；自由提问会实时查询完整资料并生成回答。
            <br />
            Sample questions show a pre-verified saved answer for a fast demo. Your own questions
            are always answered live from the documents.
          </p>
        )}

        {phase === "done" && result !== null && <AnswerView result={result} />}

        <Disclaimer />
      </div>
    </main>
  );
}
