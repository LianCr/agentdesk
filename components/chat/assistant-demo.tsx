"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerView } from "./answer-view";
import { PresetQuestions } from "./preset-questions";
import { QuestionInput } from "./question-input";
import type { GroundedAnswer, Phase } from "./types";

const LOADING_STAGES = [
  "检索保险资料中… Searching insurance documents…",
  "生成有据草稿中… Generating grounded draft…",
  "校验引用中… Validating citations…",
] as const;

const GENERIC_ERROR_MESSAGE =
  "请求失败，请稍后重试。The request failed, please try again later.";

const DISCLAIMER_EN =
  "Demo uses fictional insurance products and synthetic scenarios. AI-generated content is for internal comparison and knowledge assistance only. It is not a quote, policy illustration, suitability determination, legal or tax advice, or final insurance recommendation. Licensed-agent review is required where indicated.";

const DISCLAIMER_ZH =
  "本演示使用虚构保险产品与合成场景。AI 生成内容仅用于内部比较与知识辅助，不构成报价、保单演示、适合性判断、法律或税务意见，也不构成最终保险推荐。标注处需持牌保险经纪人审核。";

function LoadingStages({ activeStage }: { activeStage: number }) {
  return (
    <div data-testid="loading-stages" className="flex flex-col gap-1.5">
      {LOADING_STAGES.map((stage, index) => (
        <p
          key={stage}
          className={`text-sm transition-opacity duration-300 ${
            index <= activeStage ? "text-slate-700" : "text-slate-400 opacity-60"
          }`}
        >
          {stage}
        </p>
      ))}
    </div>
  );
}

export function AssistantDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GroundedAnswer | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeStage, setActiveStage] = useState(0);
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

  const handlePreset = useCallback(
    (question: string) => {
      setQuery(question);
      void submit(question);
    },
    [submit],
  );

  const isLoading = phase === "loading";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-2">
          <p
            data-testid="hero-label"
            className="text-xs font-medium uppercase tracking-widest text-slate-500"
          >
            Insurance Agent Knowledge Assistant
          </p>
          <h1
            data-testid="hero-title"
            className="text-3xl font-semibold text-[var(--brand)]"
          >
            AgentDesk
          </h1>
          <p data-testid="hero-tagline" className="max-w-2xl text-sm text-slate-600">
            中文提问，检索英文保险资料，并返回可验证的原文引用与页码。
            <br />
            Ask in Chinese. Get answers grounded in English insurance documents.
          </p>
        </header>

        <PresetQuestions disabled={isLoading} onSelect={handlePreset} />

        <QuestionInput
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
              ? "rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
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

        {phase === "done" && result !== null && <AnswerView result={result} />}

        <footer
          data-testid="demo-disclaimer"
          className="mt-4 border-t border-slate-200 pt-5 text-xs leading-relaxed text-slate-500"
        >
          <p>{DISCLAIMER_ZH}</p>
          <p className="mt-2">{DISCLAIMER_EN}</p>
        </footer>
      </div>
    </main>
  );
}
