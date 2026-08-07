import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import type { EmbeddingProvider } from "./provider.js";

// Real embedding provider: OpenAI text-embedding-3-large truncated to 1536
// dimensions via the API's dimensions parameter, called through the Vercel
// AI SDK (the project's mandated model-call interface). The AI SDK retries
// rate-limit/transient errors with backoff and does not retry auth or
// invalid-request errors. The key is passed to the SDK only — never logged.

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";
export const OPENAI_EMBEDDING_DIMENSIONS = 1536;
const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;

export function createOpenAiProvider(apiKey: string | undefined): EmbeddingProvider {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set (add it to .env); refusing to continue");
  }
  const openai = createOpenAI({ apiKey });
  const model = openai.textEmbeddingModel(OPENAI_EMBEDDING_MODEL);
  return {
    providerName: "openai",
    modelName: OPENAI_EMBEDDING_MODEL,
    dimensions: OPENAI_EMBEDDING_DIMENSIONS,
    // embedMany batches per model limits internally and preserves input order.
    embedMany: async (inputs: string[]) => {
      const { embeddings } = await embedMany({
        model,
        values: inputs,
        maxRetries: MAX_RETRIES,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        providerOptions: { openai: { dimensions: OPENAI_EMBEDDING_DIMENSIONS } },
      });
      return embeddings;
    },
  };
}
