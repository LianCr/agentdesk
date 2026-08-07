import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { REWRITE_PROMPT } from "../ai/prompts.js";

// English retrieval rewrite for Chinese questions (query B of the dual-path
// design). On any failure — timeout, schema violation, API error — the
// caller degrades to original-query-only retrieval; the rewrite never blocks.

const RewriteSchema = z.object({
  englishRetrievalQuery: z.string().min(3).max(300),
});

import type { RewriteFn } from "./types.js";
export type { RewriteFn };

export function createRewriter(model: LanguageModel): RewriteFn {
  return async (query: string): Promise<string | null> => {
    try {
      const { object } = await generateObject({
        model,
        schema: RewriteSchema,
        system: REWRITE_PROMPT,
        prompt: query,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(10_000),
      });
      return object.englishRetrievalQuery;
    } catch {
      return null; // degrade to single-path retrieval
    }
  };
}
