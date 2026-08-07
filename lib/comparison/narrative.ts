import { z } from "zod";
import { generateObject, type LanguageModel } from "ai";
import { isRecommendationConclusion } from "../rag/validate";
import type { ProductDefinition } from "../schemas";
import { DimensionIdSchema, type ComparisonDraft, type NarrativeSection } from "./types";

// Optional neutral narrative.
//
// The model receives ONLY validated structures — cell display values,
// observation texts, missing-information reasons — never a PDF, never a chunk,
// never a retrieval tool. It cannot choose products, produce citations, or
// change a single field of the deterministic draft.
//
// Every failure mode ends the same way: the narrative is dropped and the
// deterministic comparison returns unchanged. A narrative problem is never a
// comparison problem.

export const NARRATIVE_PROMPT_VERSION = 1;

export const NARRATIVE_SYSTEM_PROMPT = `You are AgentDesk's comparison explainer for a licensed insurance agent's INTERNAL working draft.

You are given a comparison that has ALREADY been built and verified by code: table rows with per-product values, documented observations, and a list of missing client information. Your only job is to restate that material in fluent prose in the requested language.

## Hard rules
- Use ONLY the facts present in the provided rows and observations. Introduce no product fact, no number, no percentage, no year count and no amount that is not already written in the material you were given.
- Do NOT produce citations, page numbers, document ids or chunk ids. Citations are attached by code.
- Do NOT say which product is better, best, more suitable, recommended, or what the client should buy. You may state that the documents do not establish which product is better, and that this is not a recommendation.
- Do NOT speculate about values the materials call missing or not provided. If something is missing, say it is missing.
- Do NOT give tax, legal or suitability conclusions.

## Output
Return JSON with a language and 1-4 sections. Each section names the dimensionIds and observationIds it restates, and its text must be traceable to exactly those references.`;

export const NarrativeDraftSchema = z
  .object({
    language: z.enum(["zh", "en"]),
    sections: z
      .array(
        z
          .object({
            headingZh: z.string().min(1).max(60),
            headingEn: z.string().min(1).max(60),
            text: z.string().min(1).max(900),
            dimensionIds: z.array(DimensionIdSchema).max(13),
            observationIds: z.array(z.string()).max(10),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();
export type NarrativeDraft = z.infer<typeof NarrativeDraftSchema>;

export type NarrativeGenerator = (args: { system: string; user: string }) => Promise<unknown>;

export interface NarrativeDeps {
  model?: LanguageModel;
  generate?: NarrativeGenerator; // injectable for offline tests
  timeoutMs?: number;
}

export type NarrativeOutcome =
  | { ok: true; sections: NarrativeSection[] }
  | { ok: false; reason: string };

const NUMERIC_TOKEN_RE = /\d+(?:,\d{3})*(?:\.\d+)?\s?(?:[%％]|[kmKM]\b|万)?/g;
// Product names carry digits that mean nothing numerically.
const PRODUCT_NAME_DIGITS = /(demo\s+)?(termplus\s*20|securerate\s*5|indexflex\s*ul)/gi;

function numbersIn(text: string): string[] {
  return (text.replace(PRODUCT_NAME_DIGITS, " ").match(NUMERIC_TOKEN_RE) ?? []).map((token) => {
    const trimmed = token.trim();
    const percent = /[%％]$/.test(trimmed);
    const digits = trimmed.replace(/[%％kmKM万]$/, "").replace(/,/g, "").trim();
    const suffix = trimmed.slice(-1).toLowerCase();
    const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "万" ? 10_000 : 1;
    const value = Number(digits) * multiplier;
    return Number.isFinite(value) ? `${value}${percent ? "%" : ""}` : trimmed;
  });
}

// The documents spell some counts as words ("guaranteed for the first five
// contract years"), and a bilingual restatement naturally writes the digit.
// Word and digit forms of the same value in the same cited cell are the same
// fact — the same equivalence as "5%" and "5.00%". This licenses only what a
// referenced source already says; a value absent from those sources stays
// unlicensed in either form.
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20,
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function numberWordsIn(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(NUMBER_WORDS)
    .filter(([word]) => (/^[a-z]+$/.test(word) ? new RegExp(`\\b${word}\\b`).test(lower) : text.includes(word)))
    .map(([, value]) => String(value));
}

// A number is licensed by the specific rows and observations a section cites —
// not by a global pool over the whole draft. This is the M3 structured-scoping
// lesson: section-scoped evidence, not "it appears somewhere".
function licensedNumbers(draft: ComparisonDraft, section: NarrativeDraft["sections"][number]): Set<string> {
  const licensed = new Set<string>();
  const add = (text: string) => {
    for (const core of numbersIn(text)) {
      licensed.add(core);
      // A percent source also licenses its unitless form ("9.50%" -> "9.5").
      if (core.endsWith("%")) licensed.add(core.slice(0, -1));
    }
    for (const core of numberWordsIn(text)) licensed.add(core);
  };
  for (const dimensionId of section.dimensionIds) {
    const row = draft.dimensions.find((r) => r.dimensionId === dimensionId);
    if (!row) continue;
    for (const cell of row.cells) {
      if (cell.displayValue) add(cell.displayValue);
      for (const citation of cell.citations) add(citation.quote);
    }
  }
  for (const observationId of section.observationIds) {
    const observation = draft.observations.find((o) => o.observationId === observationId);
    if (!observation) continue;
    add(observation.textZh);
    add(observation.textEn);
  }
  return licensed;
}

const FAKE_CITATION_RE = /\b(doc_[a-z0-9_]+|cit_\d{3}|chunk|chunkId|page\s*\d+|第\s*\d+\s*页)\b/i;

/**
 * Validates a candidate narrative against the deterministic draft. Any failure
 * returns a reason; callers drop the narrative and keep the draft intact.
 */
export function validateNarrative(
  draft: ComparisonDraft,
  candidate: unknown,
  products: readonly ProductDefinition[],
): NarrativeOutcome {
  const parsed = NarrativeDraftSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, reason: `SCHEMA_INVALID: ${parsed.error.issues[0]?.message ?? "unparseable"}` };
  }

  const knownDimensions = new Set(draft.dimensions.map((r) => r.dimensionId));
  const knownObservations = new Set(draft.observations.map((o) => o.observationId));
  const omissionRegexes = products.flatMap((product) =>
    product.omissionPatterns.map((pattern) => ({
      description: pattern.description,
      regex: new RegExp(pattern.pattern, pattern.flags ?? ""),
    })),
  );

  for (const section of parsed.data.sections) {
    for (const dimensionId of section.dimensionIds) {
      if (!knownDimensions.has(dimensionId)) {
        return { ok: false, reason: `UNKNOWN_DIMENSION: ${dimensionId}` };
      }
    }
    for (const observationId of section.observationIds) {
      if (!knownObservations.has(observationId)) {
        return { ok: false, reason: `UNKNOWN_OBSERVATION: ${observationId}` };
      }
    }
    if (section.dimensionIds.length === 0 && section.observationIds.length === 0) {
      return { ok: false, reason: "SECTION_WITHOUT_REFERENCES" };
    }

    // Reuse the production recommendation predicate — no second regex set.
    for (const text of [section.text, section.headingZh, section.headingEn]) {
      if (isRecommendationConclusion(text)) {
        return { ok: false, reason: `RECOMMENDATION: ${text.slice(0, 60)}` };
      }
    }

    // Checked before the numeric guard: a document id or page reference is a
    // more specific failure than the stray digits it happens to contain.
    if (FAKE_CITATION_RE.test(section.text)) {
      return { ok: false, reason: "FABRICATED_CITATION_REFERENCE" };
    }

    const licensed = licensedNumbers(draft, section);
    for (const core of numbersIn(section.text)) {
      if (!licensed.has(core)) {
        return { ok: false, reason: `UNSUPPORTED_NUMBER: ${core}` };
      }
    }

    for (const { description, regex } of omissionRegexes) {
      regex.lastIndex = 0;
      if (regex.test(section.text)) {
        return { ok: false, reason: `INTENTIONAL_OMISSION: ${description}` };
      }
    }
  }

  return {
    ok: true,
    sections: parsed.data.sections.map((section) => ({
      headingZh: section.headingZh,
      headingEn: section.headingEn,
      text: section.text,
      dimensionIds: section.dimensionIds,
      observationIds: section.observationIds,
    })),
  };
}

// What the model is allowed to see: validated text only.
export function buildNarrativeInput(draft: ComparisonDraft, language: "zh" | "en"): string {
  const rows = draft.dimensions
    .map((row) => {
      const label = language === "zh" ? row.labelZh : row.labelEn;
      const cells = row.cells
        .map((cell) => {
          const product = cell.productId === draft.productA.documentId ? draft.productA : draft.productB;
          return `    ${product.productName}: [${cell.availability}] ${cell.displayValue ?? "—"}`;
        })
        .join("\n");
      return `  <dimension id="${row.dimensionId}" label="${label}">\n${cells}\n  </dimension>`;
    })
    .join("\n");
  const observations = draft.observations
    .map((o) => `  <observation id="${o.observationId}" severity="${o.severity}">${language === "zh" ? o.textZh : o.textEn}</observation>`)
    .join("\n");
  const missing = draft.missingClientInformation
    .map((m) => `  <missing field="${m.field}">${language === "zh" ? m.reasonZh : m.reasonEn}</missing>`)
    .join("\n");

  return [
    `Language: ${language}`,
    `Comparison status: ${draft.comparisonStatus}`,
    "<dimensions>",
    rows,
    "</dimensions>",
    "<observations>",
    observations || "  (none)",
    "</observations>",
    "<missingClientInformation>",
    missing || "  (none)",
    "</missingClientInformation>",
  ].join("\n");
}

/**
 * Attaches a narrative to a deterministic draft. On ANY failure the draft is
 * returned with narrativeSections empty and a status explaining why — the
 * table, observations, missing information, flags and status never change.
 */
export async function attachNarrative(
  draft: ComparisonDraft,
  products: readonly ProductDefinition[],
  deps: NarrativeDeps,
  language: "zh" | "en" = draft.clientContext?.language ?? "zh",
): Promise<ComparisonDraft> {
  // A blocked comparison has an unsafe factual base; explaining it in prose
  // would dress up facts the code refused to stand behind.
  if (draft.comparisonStatus === "blocked") {
    return { ...draft, narrativeStatus: "unavailable", narrativeRejectionReason: "COMPARISON_BLOCKED" };
  }

  const generate =
    deps.generate ??
    (async ({ system, user }: { system: string; user: string }) => {
      if (!deps.model) throw new Error("NARRATIVE_MODEL_UNAVAILABLE");
      const { object } = await generateObject({
        model: deps.model,
        schema: NarrativeDraftSchema,
        system,
        messages: [{ role: "user", content: user }],
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(deps.timeoutMs ?? 60_000),
      });
      return object;
    });

  let candidate: unknown;
  try {
    candidate = await generate({
      system: NARRATIVE_SYSTEM_PROMPT,
      user: buildNarrativeInput(draft, language),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...draft,
      narrativeStatus: "unavailable",
      narrativeRejectionReason: message.slice(0, 120),
    };
  }

  const outcome = validateNarrative(draft, candidate, products);
  if (!outcome.ok) {
    return { ...draft, narrativeStatus: "rejected", narrativeRejectionReason: outcome.reason };
  }
  return {
    ...draft,
    narrativeSections: outcome.sections,
    narrativeStatus: "available",
    narrativeRejectionReason: null,
  };
}
