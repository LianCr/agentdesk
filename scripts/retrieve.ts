import { createServiceClient } from "../lib/supabase/server";
import { createOpenAiProvider } from "../lib/embeddings/openai";
import { createAnswerModel } from "../lib/ai/client";
import { createRewriter } from "../lib/retrieval/rewrite";
import { retrieve } from "../lib/retrieval/search";
import type { RetrievalRequest } from "../lib/retrieval/types";

// Retrieval CLI (M3-A). Read-only. Usage:
//   npm run retrieve -- "定期寿险有现金价值吗？" [--topK=8] [--category=term_life]

const args = process.argv.slice(2);
const query = args.find((a) => !a.startsWith("--"));
const topK = Number(args.find((a) => a.startsWith("--topK="))?.split("=")[1] ?? 8);
const category = args.find((a) => a.startsWith("--category="))?.split("=")[1];

if (!query) {
  console.error('Usage: retrieve -- "<question>" [--topK=8] [--category=term_life|indexed_universal_life|fixed_annuity]');
  process.exit(1);
}

const request: RetrievalRequest = {
  query,
  topK,
  ...(category ? { filters: { productCategories: [category as never] } } : {}),
};

const result = await retrieve(
  {
    db: createServiceClient(),
    provider: createOpenAiProvider(process.env.OPENAI_API_KEY),
    rewrite: createRewriter(createAnswerModel()),
  },
  request,
);

console.log(`language: ${result.detectedLanguage} | routes: ${result.retrievalQueries.map((q) => q.kind).join("+")}${result.rewriteFailed ? " (rewrite failed)" : ""}`);
for (const q of result.retrievalQueries.filter((q) => q.kind !== "original")) {
  console.log(`${q.kind}: ${q.text}`);
}
console.log("");
for (const r of result.results) {
  console.log(
    `#${r.rank} ${r.similarityScore.toFixed(3)} ${r.chunkId} [${r.chunkType}] ${r.productName} p${r.pageStart} — ${r.section}`,
  );
  console.log(`   ${r.content.replaceAll("\n", " ").slice(0, 110)}…`);
}
