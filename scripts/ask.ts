import { createServiceClient } from "../lib/supabase/server";
import { createOpenAiProvider } from "../lib/embeddings/openai";
import { createAnswerModel } from "../lib/ai/client";
import { createRewriter } from "../lib/retrieval/rewrite";
import { answerQuestion } from "../lib/rag/answer";

// Grounded Q&A CLI (M3-B). Read-only against the database.
//   npm run ask -- "定期寿险有现金价值吗？" [--category=term_life]
// Never prints vectors, keys, environment values or the system prompt.

const args = process.argv.slice(2);
const query = args.find((a) => !a.startsWith("--"));
const category = args.find((a) => a.startsWith("--category="))?.split("=")[1];

if (!query) {
  console.error('Usage: ask -- "<question>" [--category=term_life|indexed_universal_life|fixed_annuity]');
  process.exit(1);
}

const model = createAnswerModel();
const result = await answerQuestion(
  {
    retrieval: {
      db: createServiceClient(),
      provider: createOpenAiProvider(process.env.OPENAI_API_KEY),
      rewrite: createRewriter(model),
    },
    model,
  },
  query,
  category ? { filters: { productCategories: [category as never] } } : {},
);

console.log(`Question:        ${query}`);
console.log(`Language:        ${result.language}`);
console.log(`Evidence status: ${result.evidenceStatus}`);
console.log(`Review required: ${result.reviewRequired}${result.reviewReasons.length ? ` (${result.reviewReasons.join(", ")})` : ""}`);
if (result.refusal.isRefusal) console.log(`Refusal reason:  ${result.refusal.reasonCode}`);
console.log(
  `Meta:            model=${result.meta.answerModel} promptV=${result.meta.promptVersion} retries=${result.meta.retryCount} ` +
    `coverage=${result.meta.citationCoverage.toFixed(2)} unsupported=${result.meta.unsupportedClaimCount} latency=${result.meta.latencyMs}ms`,
);
console.log(`\n--- Answer ---\n${result.answer}`);
if (result.citations.length > 0) {
  console.log(`\n--- Citations ---`);
  result.citations.forEach((c, i) => {
    console.log(`[${i + 1}] ${c.productName} — ${c.documentName}, p.${c.pageStart} (${c.section})`);
    console.log(`    "${c.quote}"`);
  });
}
if (result.missingInformation.length > 0) {
  console.log(`\n--- Missing information ---`);
  for (const m of result.missingInformation) console.log(`- ${m}`);
}
process.exit(0);
