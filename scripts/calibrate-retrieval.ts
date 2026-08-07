import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCatalogSchema } from "../lib/schemas";
import { DerivedChunksFileSchema } from "../lib/ingestion/types";
import { normalizeText } from "../lib/pdf-text";
import { createServiceClient } from "../lib/supabase/server";
import { createOpenAiProvider } from "../lib/embeddings/openai";
import { createAnswerModel } from "../lib/ai/client";
import { createRewriter } from "../lib/retrieval/rewrite";
import { retrieve } from "../lib/retrieval/search";
import type { RetrievalQueryKind } from "../lib/retrieval/types";

// M3-A calibration: measures real score distributions over the 45 live
// chunks and compares three retrieval baselines BEFORE any threshold or
// route policy is locked:
//   A = original query only
//   B = original + deterministic glossary normalization
//   C = original + GPT-5-mini English rewrite
// Read-only against the database. Results go to docs/retrieval-calibration.md.
// Retrieval relevance is reported separately from answer sufficiency: a high
// score on a missing-information probe is NOT evidence an answer exists.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

interface Probe {
  id: string;
  query: string;
  language: string;
  kind: "answerable" | "missing" | "filter" | "ambiguous";
  goldDocumentId?: string;
  goldPage?: number;
  goldMarker?: string; // substring locating the gold chunk in the fixtures
  filters?: { productCategories?: ["term_life" | "indexed_universal_life" | "fixed_annuity"] };
}

const PROBES: Probe[] = [
  { id: "P1", query: "Does TermPlus 20 accumulate cash value?", language: "en", kind: "answerable",
    goldDocumentId: "doc_termplus20_v1", goldPage: 2, goldMarker: "does not accumulate cash value" },
  { id: "P2", query: "定期寿险有现金价值吗？", language: "zh", kind: "answerable",
    goldDocumentId: "doc_termplus20_v1", goldPage: 2, goldMarker: "does not accumulate cash value" },
  { id: "P3", query: "IUL 的当前 cap 和保证最低 cap 是多少？", language: "mixed", kind: "answerable",
    goldDocumentId: "doc_indexflex_ul_v1", goldPage: 5, goldMarker: "9.50%" },
  { id: "P4", query: "SecureRate 有 rider 吗？", language: "mixed", kind: "answerable",
    goldDocumentId: "doc_securerate5_v1", goldPage: 5, goldMarker: "does not offer optional riders" },
  { id: "P5", query: "What happens to TermPlus premiums after the 20-year level period?", language: "en",
    kind: "answerable", goldDocumentId: "doc_termplus20_v1", goldPage: 4, goldMarker: "annually renewable" },
  { id: "P6", query: "SecureRate 的初始利率保证期是多久？", language: "zh", kind: "answerable",
    goldDocumentId: "doc_securerate5_v1", goldPage: 3, goldMarker: "first five contract years" },
  { id: "P7", query: "What is the SecureRate surrender charge schedule?", language: "en", kind: "answerable",
    goldDocumentId: "doc_securerate5_v1", goldPage: 4, goldMarker: "Contract Year 1 2 3 4 5 6 7 8+" },
  { id: "P8", query: "surrender charge", language: "en", kind: "filter",
    filters: { productCategories: ["fixed_annuity"] }, goldDocumentId: "doc_securerate5_v1" },
  { id: "P9", query: "surrender charge schedule", language: "en", kind: "ambiguous" },
  { id: "P10", query: "TermPlus 61 岁的续保保费是多少？", language: "mixed", kind: "missing" },
  { id: "P11", query: "How much cash value will IndexFlex have after 20 years?", language: "en", kind: "missing" },
  { id: "P12", query: "What have SecureRate's renewal rates been historically?", language: "en", kind: "missing" },
];

const CONFIGS: Array<{ name: string; routes: RetrievalQueryKind[] }> = [
  { name: "A_original", routes: ["original"] },
  { name: "B_glossary", routes: ["original", "glossary"] },
  { name: "C_llm_rewrite", routes: ["original", "rewrite"] },
];

// Locate gold chunk ids from the committed fixtures via content marker.
function goldChunks(documentId: string, marker: string): string[] {
  const fixture = DerivedChunksFileSchema.parse(
    JSON.parse(readFileSync(join(ROOT, `data/derived/chunks/${documentId}.chunks.json`), "utf8")),
  );
  return fixture.chunks
    .filter((c) => normalizeText(c.content).includes(normalizeText(marker)))
    .map((c) => c.chunkId);
}

const db = createServiceClient();
const provider = createOpenAiProvider(process.env.OPENAI_API_KEY);
const rewrite = createRewriter(createAnswerModel());
ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);

const lines: string[] = [
  "# Retrieval Calibration (M3-A)",
  "",
  "Measured on the 45 live chunks with `text-embedding-3-large@1536`.",
  "Baselines: A = original query only; B = + deterministic glossary; C = + GPT-5-mini rewrite.",
  "Score = 1 − cosine distance. Retrieval relevance is labeled separately from",
  "answer sufficiency — high similarity on missing-information probes proves",
  "nothing about answerability.",
  "",
];

let failures = 0;

for (const probe of PROBES) {
  const gold = probe.goldDocumentId && probe.goldMarker ? goldChunks(probe.goldDocumentId, probe.goldMarker) : [];
  lines.push(`## ${probe.id} (${probe.language}, ${probe.kind}): ${probe.query}`);
  if (probe.goldDocumentId) {
    lines.push(`Expected: ${probe.goldDocumentId}${probe.goldPage ? ` page ${probe.goldPage}` : ""}${gold.length ? ` (gold chunks: ${gold.join(", ")})` : ""}`);
  }
  lines.push("");
  lines.push("| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |");
  lines.push("|---|---|---|---|---|---|---|---|");

  for (const config of CONFIGS) {
    const isDual = probe.language !== "en";
    if (config.name === "C_llm_rewrite" && !isDual) {
      lines.push(`| ${config.name} | (en single-route — n/a) | | | | | | |`);
      continue;
    }
    const result = await retrieve(
      { db, provider, rewrite },
      { query: probe.query, topK: 8, filters: probe.filters },
      { routes: config.routes },
    );
    const top3 = result.results.slice(0, 3)
      .map((r) => `${r.chunkId.replace("doc_", "")} @ ${r.similarityScore.toFixed(3)}`)
      .join("<br>");
    const goldRank = result.results.find((r) => gold.includes(r.chunkId))?.rank ?? null;
    const goldScore = result.results.find((r) => gold.includes(r.chunkId))?.similarityScore ?? null;
    const outranked =
      probe.goldDocumentId && result.results[0] && result.results[0].documentId !== probe.goldDocumentId;
    const hit = (k: number): string => (gold.length === 0 ? "—" : goldRank !== null && goldRank <= k ? "✓" : "✗");
    lines.push(
      `| ${config.name} | ${top3} | ${goldRank ?? "—"} | ${goldScore?.toFixed(3) ?? "—"} | ${hit(1)} | ${hit(3)} | ${hit(8)} | ${outranked ? "YES ⚠" : "no"} |`,
    );

    if (probe.kind === "answerable" && gold.length > 0 && goldRank === null) failures++;
    if (probe.kind === "filter") {
      const wrong = result.results.filter((r) => r.documentId !== probe.goldDocumentId);
      if (wrong.length > 0) {
        failures++;
        lines.push(`| | FILTER LEAK: ${wrong.map((r) => r.documentId).join(",")} | | | | | | |`);
      }
    }
    if (probe.kind === "ambiguous" && config.name === "A_original") {
      const products = [...new Set(result.results.map((r) => r.documentId))];
      lines.push(`| | products in top8: ${products.join(", ")} | | | | | | |`);
    }
    if (probe.kind === "missing") {
      lines.push(
        `| | top score ${result.results[0]?.similarityScore.toFixed(3)} — related context only; answer sufficiency: NOT ANSWERABLE (intentional omission) | | | | | | |`,
      );
    }
  }
  lines.push("");
}

// Preserve the maintained "Locked conclusions" section: the script owns the
// measured tables above the marker; humans own the conclusions below it.
const docPath = join(ROOT, "docs/retrieval-calibration.md");
const MARKER = "## Locked conclusions";
let tail = `${MARKER} (lib/retrieval/thresholds.ts)\n\n(To be filled from the measured tables above.)\n`;
try {
  const existing = readFileSync(docPath, "utf8");
  const idx = existing.indexOf(MARKER);
  if (idx >= 0) tail = existing.slice(idx);
} catch {
  // first run — placeholder tail stands
}
writeFileSync(docPath, (lines.join("\n") + "\n" + tail).replace(/\n+$/, "\n"));
console.log(lines.join("\n"));
console.log(`\ncalibration ${failures === 0 ? "OK" : `saw ${failures} recall/filter failure(s)`}`);
process.exit(failures > 0 ? 1 : 0);
