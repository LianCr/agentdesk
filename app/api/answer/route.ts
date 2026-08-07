import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ManifestSchema } from "../../../lib/schemas";
import { createServiceClient } from "../../../lib/supabase/server";
import { createOpenAiProvider } from "../../../lib/embeddings/openai";
import { createAnswerModel } from "../../../lib/ai/client";
import { createRewriter } from "../../../lib/retrieval/rewrite";
import { answerQuestion, type AnswerDeps } from "../../../lib/rag/answer";

// Thin presentation boundary over the approved M3-B pipeline. No prompts, no
// retrieval logic, no evidence-status computation, no citation construction
// here — the route validates input, calls answerQuestion, enriches each
// citation with a code-owned PDF URL from the manifest, and maps errors to
// safe HTTP responses. Secrets and stack traces never reach the browser.

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({
  query: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(500)),
});

// documentId -> public file name, from the manifest (code-owned; the model
// never produces URLs).
const fileByDocumentId: Map<string, string> = (() => {
  const manifest = ManifestSchema.parse(
    JSON.parse(
      readFileSync(join(process.cwd(), "data/fictional-products/manifest.json"), "utf8"),
    ),
  );
  return new Map(manifest.map((m) => [m.documentId, m.file]));
})();

let cachedDeps: AnswerDeps | null = null;
function deps(): AnswerDeps {
  if (!cachedDeps) {
    const model = createAnswerModel();
    cachedDeps = {
      retrieval: {
        db: createServiceClient(),
        provider: createOpenAiProvider(process.env.OPENAI_API_KEY),
        rewrite: createRewriter(model),
      },
      model,
    };
  }
  return cachedDeps;
}

export async function POST(request: Request): Promise<NextResponse> {
  let query: string;
  try {
    const body = RequestSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: "INVALID_QUERY", message: "请输入 1–500 字的问题。Please enter a question (1–500 characters)." },
        { status: 400 },
      );
    }
    query = body.data.query;
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    const answer = await answerQuestion(deps(), query);
    return NextResponse.json({
      ...answer,
      citations: answer.citations.map((citation) => ({
        ...citation,
        sourceUrl: fileByDocumentId.has(citation.documentId)
          ? `/documents/${fileByDocumentId.get(citation.documentId)}#page=${citation.pageStart}`
          : null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const code = message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? "ANSWER_FAILED";
    console.error(JSON.stringify({ event: "answer_error", code })); // sanitized: code only
    if (/429|rate.?limit|overloaded/i.test(message)) {
      return NextResponse.json(
        { error: "UPSTREAM_BUSY", message: "The AI service is temporarily busy. Please try again. AI 服务暂时繁忙，请稍后重试。" },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: code, message: "Something went wrong while answering. Please try again. 回答过程中出现问题，请重试。" },
      { status: 500 },
    );
  }
}
