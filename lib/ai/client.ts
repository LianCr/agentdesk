import { existsSync } from "node:fs";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// Server-only chat-model factory for the single approved demo model
// (GPT-5-mini via the Vercel AI SDK). The key is passed to the SDK only and
// never logged. See docs/model-selection.md for the selection rationale.

export const ANSWER_MODEL_DEFAULT = "gpt-5-mini";

let envLoaded = false;
function loadEnv(): void {
  if (envLoaded) return;
  if (existsSync(".env")) process.loadEnvFile(".env");
  envLoaded = true;
}

export function answerModelId(): string {
  loadEnv();
  return process.env.ANSWER_MODEL ?? ANSWER_MODEL_DEFAULT;
}

export function createAnswerModel(): LanguageModel {
  if (typeof window !== "undefined") {
    throw new Error("createAnswerModel is server-only and must never run in a browser");
  }
  loadEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set (add it to .env)");
  return createOpenAI({ apiKey }).chat(answerModelId());
}
