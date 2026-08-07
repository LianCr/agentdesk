import { z } from "zod";
import type { ProductCategory, ProductDefinition } from "../schemas";

// Category-specific typed access to the existing `facts` object, which
// lib/schemas.ts intentionally types as z.record(z.string(), z.unknown()).
//
// This module VALIDATES the data that is already there. It does not transform
// it, enrich it, or write a normalized copy anywhere: products.json stays the
// single machine source of truth (CLAUDE.md §10). Every schema below is
// permissive about extra keys so adding a fact never breaks parsing — only
// the paths the comparison registry actually reads are required.

const Display = z.object({ display: z.string().min(1) });
const RateDisplay = z.object({ rate: z.number(), display: z.string().min(1) });
const AmountDisplay = z.object({ amount: z.number(), display: z.string().min(1) });
const RangeDisplay = z.object({ min: z.number(), max: z.number(), display: z.string().min(1) });
const NamedDisplay = z.object({ name: z.string().min(1), display: z.string().min(1) });

export const TermFactsSchema = z
  .object({
    productType: z.string().min(1),
    issueAges: RangeDisplay,
    faceAmounts: RangeDisplay,
    premiums: z.object({
      levelYears: z.number().int().positive(),
      coverageMaxAge: z.number().int().positive(),
      display: z.string().min(1),
    }),
    underwritingClasses: z.array(z.string().min(1)).min(1),
    cashValue: z.object({ hasCashValue: z.boolean(), display: z.string().min(1) }),
    conversion: Display,
    riders: z.array(NamedDisplay).min(1),
    exclusions: z.array(z.string().min(1)).min(1),
    samplePremiums: z.object({
      tablePage: z.number().int().positive(),
      tableTitle: z.string().min(1),
    }).passthrough(),
  })
  .passthrough();
export type TermFacts = z.infer<typeof TermFactsSchema>;

export const IulFactsSchema = z
  .object({
    productType: z.string().min(1),
    issueAges: RangeDisplay,
    minimumFaceAmount: AmountDisplay,
    premiums: Display,
    noLapseGuarantee: z.object({ years: z.number().int().positive(), display: z.string().min(1) }),
    fixedAccount: z.object({
      currentRate: z.number(),
      currentRateDisplay: z.string().min(1),
      guaranteedMinimumRate: z.number(),
      guaranteedMinimumRateDisplay: z.string().min(1),
    }).passthrough(),
    indexedAccount: Display,
    floor: z.object({ rate: z.number(), display: z.string().min(1), guaranteed: z.boolean() }),
    cap: z.object({
      currentRate: z.number(),
      currentRateDisplay: z.string().min(1),
      guaranteedMinimumRate: z.number(),
      guaranteedMinimumRateDisplay: z.string().min(1),
    }),
    participation: z.object({
      currentRate: z.number(),
      currentRateDisplay: z.string().min(1),
      guaranteedMinimumRate: z.number(),
      guaranteedMinimumRateDisplay: z.string().min(1),
    }),
    rateChanges: Display,
    surrenderCharge: z.object({ years: z.number().int().positive(), display: z.string().min(1) }),
    surrenderChargeSchedule: z.object({
      basis: z.string().min(1),
      chargesByYear: z.array(z.number()).min(1),
      afterYear10: z.number(),
      tablePage: z.number().int().positive(),
      tableTitle: z.string().min(1),
    }),
    loans: Display,
    withdrawals: Display,
    riders: z.array(NamedDisplay).min(1),
    nonGuaranteedElements: z.array(z.string().min(1)).min(1),
    illustration: Display,
    disclosures: z.array(z.string().min(1)).min(1),
    requiredPage8Sentence: z.string().min(1),
  })
  .passthrough();
export type IulFacts = z.infer<typeof IulFactsSchema>;

export const AnnuityFactsSchema = z
  .object({
    productType: z.string().min(1),
    issueAges: RangeDisplay,
    minimumPremium: AmountDisplay,
    maximumPremium: AmountDisplay,
    initialRate: z.object({
      rate: z.number(),
      display: z.string().min(1),
      guaranteeYears: z.number().int().positive(),
      guaranteeDisplay: z.string().min(1),
    }),
    renewalRates: Display,
    guaranteedMinimumRate: RateDisplay,
    surrenderPeriodYears: z.number().int().positive(),
    freeWithdrawal: Display.passthrough(),
    marketValueAdjustment: Display,
    deathBenefit: Display,
    annuitizationOptions: z.array(z.string().min(1)).min(1),
    optionalRiders: z.object({ offered: z.boolean(), display: z.string().min(1) }),
    taxNote: Display.passthrough(),
    replacement: Display,
    suitability: z.object({
      heightenedReviewAge: z.number().int().positive(),
      display: z.string().min(1),
    }),
    surrenderChargeSchedule: z.object({
      basis: z.string().min(1),
      chargesByYearPercent: z.array(z.number()).min(1),
      afterYear7Percent: z.number(),
      tablePage: z.number().int().positive(),
      tableTitle: z.string().min(1),
    }),
  })
  .passthrough();
export type AnnuityFacts = z.infer<typeof AnnuityFactsSchema>;

const PARSERS: Record<ProductCategory, z.ZodTypeAny> = {
  term_life: TermFactsSchema,
  indexed_universal_life: IulFactsSchema,
  fixed_annuity: AnnuityFactsSchema,
};

// Keys that exist for implementers and must never surface as product facts:
// nonRenderedSpecNotes documents an intentional data design (the 5-vs-7
// mismatch) and is explicitly NOT rendered into the PDF, so it can never be
// cited as evidence.
export const NON_FACT_KEYS = ["nonRenderedSpecNotes"] as const;

export function parseProductFacts(product: ProductDefinition): Record<string, unknown> {
  const parser = PARSERS[product.productCategory];
  const result = parser.safeParse(product.facts);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `PRODUCT_FACTS_INVALID: ${product.documentId} (${product.productCategory}) ` +
        `${issue ? `${issue.path.join(".")}: ${issue.message}` : "unknown issue"}`,
    );
  }
  return result.data as Record<string, unknown>;
}

// Dotted path reader supporting `riders[0].display`. Returns undefined for any
// missing segment — callers decide whether that means not_provided or a
// registry bug.
export function readFactPath(facts: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc === null || acc === undefined) return undefined;
    const indexed = segment.match(/^([A-Za-z0-9_]+)\[(\d+)\]$/);
    if (indexed) {
      const arr = (acc as Record<string, unknown>)[indexed[1]!];
      return Array.isArray(arr) ? arr[Number(indexed[2])] : undefined;
    }
    return (acc as Record<string, unknown>)[segment];
  }, facts);
}

export function isNonFactKey(path: string): boolean {
  const head = path.split(".")[0]!.replace(/\[\d+\]$/, "");
  return (NON_FACT_KEYS as readonly string[]).includes(head);
}
