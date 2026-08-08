import { classifyRedlines } from "../rag/redlines";
import type { ProductCategory } from "../schemas";
import { UNKNOWN, type ClientContext, type ComparisonRow, type ReviewFlag } from "./types";

// Code-owned review flags. M4 only RAISES flags; the workflow decision that
// can block a client-facing draft is M5's lib/guardrails/rules.ts, and the
// human decision is M5-C. A model cannot add, remove or downgrade anything
// here. How each flag is worded for a reader lives in one leaf module so the
// comparison page, the review page and the CLI cannot drift apart.

export {
  REVIEW_FLAG_DEFINITIONS,
  type ReviewFlagDefinition,
} from "../reviews/flag-presentation";

// Demo-policy age threshold. It comes from the fictional annuity's own
// suitability fact, so it is read from the product rather than hardcoded as a
// legal rule.
function heightenedReviewAge(products: readonly { facts: unknown }[]): number | null {
  for (const product of products) {
    const suitability = (product.facts as { suitability?: { heightenedReviewAge?: unknown } }).suitability;
    if (typeof suitability?.heightenedReviewAge === "number") return suitability.heightenedReviewAge;
  }
  return null;
}

export function computeReviewFlags(args: {
  rows: readonly ComparisonRow[];
  client: ClientContext | null;
  categories: readonly ProductCategory[];
  products: readonly { facts: unknown }[];
}): ReviewFlag[] {
  const flags = new Set<ReviewFlag>();

  // Every comparison draft is internal until a licensed agent approves it.
  flags.add("CLIENT_FACING_DRAFT");

  const available = (dimensionId: string) =>
    args.rows
      .find((r) => r.dimensionId === dimensionId)
      ?.cells.some((c) => c.availability === "available") ?? false;

  if (available("non_guaranteed_elements")) flags.add("NON_GUARANTEED_ELEMENTS");
  if (available("illustration_documentation")) flags.add("ILLUSTRATION_REQUIRED");
  if (args.categories.includes("fixed_annuity")) flags.add("ANNUITY_CONTEXT");
  if (available("surrender_liquidity")) flags.add("SURRENDER_CHARGE_EXPOSURE");

  // MVA is a documented annuity feature, not an inference.
  const mvaDocumented = args.products.some((p) =>
    typeof (p.facts as { marketValueAdjustment?: { display?: unknown } }).marketValueAdjustment?.display === "string",
  );
  if (mvaDocumented) flags.add("MARKET_VALUE_ADJUSTMENT_EXPOSURE");

  if (args.client !== null) {
    const threshold = heightenedReviewAge(args.products);
    if (threshold !== null && args.client.age !== UNKNOWN && args.client.age >= threshold) {
      flags.add("AGE_65_PLUS");
    }
    if (args.client.replacementContext) flags.add("REPLACEMENT_CONTEXT");
    // Reuse the M3 production classifier rather than writing a second set of
    // patterns: a client asking "how much cash value after 20 years" is the
    // same illustration/estimation request the answer pipeline already knows.
    for (const question of args.client.clientQuestions) {
      const redline = classifyRedlines(question);
      if (redline.hard !== null || redline.softFlags.length > 0) {
        flags.add("SPECIFIC_VALUE_REQUEST");
        break;
      }
    }
  }

  // Stable order for deterministic output.
  const ORDER: ReviewFlag[] = [
    "CLIENT_FACING_DRAFT",
    "NON_GUARANTEED_ELEMENTS",
    "ILLUSTRATION_REQUIRED",
    "ANNUITY_CONTEXT",
    "SURRENDER_CHARGE_EXPOSURE",
    "MARKET_VALUE_ADJUSTMENT_EXPOSURE",
    "AGE_65_PLUS",
    "REPLACEMENT_CONTEXT",
    "SPECIFIC_VALUE_REQUEST",
  ];
  return ORDER.filter((flag) => flags.has(flag));
}
