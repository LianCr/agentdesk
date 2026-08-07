import { normalizeText } from "../pdf-text.js";
import { stripProductNames, violatesNonFactualGuard } from "./validate.js";
import type { Citation, DraftSection, ValidatedClaim } from "./types.js";

// Deterministic answer renderer. The visible answer is assembled ONLY from:
// validated claims (with citation markers), guarded non-factual section text,
// missing-information entries and the suggested next step. A factual
// statement absent from validated claims cannot appear — enforced twice:
// structurally here, and by assertRenderedAnswer below.

const LABELS = {
  zh: { missing: "资料中缺少", nextStep: "建议下一步", known: "资料确认" },
  en: { missing: "Missing from documents", nextStep: "Suggested next step", known: "Known from documents" },
};

export interface RenderInput {
  language: "zh" | "en";
  sections: DraftSection[];
  claims: ValidatedClaim[]; // validated only — unsupported claims never reach here
  citations: Citation[];
  missingInformation: string[];
  suggestedNextStep: string | null;
}

export function renderAnswer(input: RenderInput): string {
  const labels = LABELS[input.language];
  const claimById = new Map(input.claims.map((c) => [c.claimId, c]));
  const citationIndex = new Map(input.citations.map((c, i) => [c.citationId, i + 1]));
  const lines: string[] = [];

  for (const section of input.sections) {
    const renderable = section.claimIds
      .map((id) => claimById.get(id))
      .filter((c): c is ValidatedClaim => c !== undefined);
    const nonFactual =
      section.nonFactualText && !violatesNonFactualGuard(section.nonFactualText)
        ? section.nonFactualText
        : null;
    if (renderable.length === 0 && !nonFactual) continue; // fully unsupported section disappears

    // Headings pass the same guard as nonFactualText — a heading carrying
    // figures or fact-bearing wording is omitted, never rendered unvalidated.
    if (section.heading && !violatesNonFactualGuard(section.heading)) {
      lines.push(`**${section.heading}**`);
    }
    if (nonFactual) lines.push(nonFactual);
    for (const claim of renderable) {
      const markers = claim.citationIds
        .map((id) => citationIndex.get(id))
        .filter((n): n is number => n !== undefined)
        .map((n) => `[${n}]`)
        .join("");
      lines.push(`- ${claim.text}${markers ? ` ${markers}` : ""}`);
    }
    lines.push("");
  }

  if (input.missingInformation.length > 0) {
    lines.push(`**${labels.missing}:**`);
    for (const missing of input.missingInformation) lines.push(`- ${missing}`);
    lines.push("");
  }
  if (input.suggestedNextStep) {
    lines.push(`**${labels.nextStep}:** ${input.suggestedNextStep}`);
  }
  return lines.join("\n").trim();
}

// Integrity assertion: every rendered line that carries factual content
// (numbers/amounts after product-name stripping) must be a validated claim
// text or a missing-information/next-step line. Throws when free-form
// factual prose sneaks in.
export function assertRenderedAnswer(
  answer: string,
  claims: ValidatedClaim[],
  missingInformation: string[],
  suggestedNextStep: string | null,
): void {
  const allowed = new Set([
    ...claims.map((c) => normalizeText(c.text)),
    ...missingInformation.map((m) => normalizeText(m)),
    ...(suggestedNextStep ? [normalizeText(suggestedNextStep)] : []),
  ]);
  for (const raw of answer.split("\n")) {
    let line = raw.replace(/^\s*-\s+/, "").replace(/\[\d+\]/g, "").trim();
    // Strip a leading bold label whether the colon sits inside or outside the
    // bold markers: "**Label:** text", "**Label**: text" -> "text".
    line = line.replace(/^\*\*[^*]+\*\*:?\s*/, "");
    line = line.replace(/^\*\*([^*]+)\*\*:?$/, "$1"); // bare "**Heading**" -> "Heading"
    line = line.trim();
    if (!line) continue;
    const normalized = normalizeText(line);
    if (allowed.has(normalized)) continue;
    if (!/[\d％%$¥]/.test(stripProductNames(line))) continue; // structural text without figures
    throw new Error(
      `RENDER_INTEGRITY: factual prose outside validated claims: "${line.slice(0, 80)}"`,
    );
  }
}
