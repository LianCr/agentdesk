import type { RefusalReason } from "./types.js";

// Deterministic red-line classification, applied BEFORE the model call.
// Code-owned classification always wins over model output.
//
// hard  -> template refusal, no model call at all (nothing to inject into)
// soft  -> pipeline continues with review flags; evidence-only generation
//          plus numeric-citation enforcement prevents invented values

export interface RedlineResult {
  hard: RefusalReason | null;
  softFlags: RefusalReason[];
  reviewRequired: boolean;
}

const INJECTION = [
  /ignore (all |any )?(previous |prior |the )?(instructions|rules)/i,
  /without (any )?citations?/i,
  /do( not|n't) cite/i,
  /disable .*(citation|rule|review)/i,
  /pretend (you are|to be)/i,
  /reveal .*(system|prompt)/i,
  /忽略(所有|之前|以上)?(的)?(规则|指令|要求)/,
  /不要(引用|标注)/,
  /假装你是/,
];

const FINAL_RECOMMENDATION = [
  /\b(best|which) (product|policy|option|one)\b.*\b(best|buy|choose|recommend)\b/i,
  /\bwhich (product|policy|one) is (the )?best\b/i,
  /\bshould (this client|the client|i|he|she|they|we) (buy|choose|pick)\b/i,
  /\brecommend (the )?(best|a) (product|policy)\b/i,
  /\brecommend the best\b/i,
  /\btell the client to (choose|buy|pick)\b/i,
  /哪(个|款)(产品|保单)?最(好|适合)/,
  /(最好|最适合)的(产品|保单)/,
  /(告诉|让)客户(买|选)/,
  /(推荐|建议).*(买|购买|选择?)哪/,
];

const GUARANTEE = [
  /guarantee[sd]? (me |that |a |an )?\d/i,
  /guaranteed? returns?\b/i,
  /risk[- ]?free/i,
  /can you guarantee/i,
  /保证.*(收益|回报|赚)/,
  /稳赚/,
  /无风险/,
];

const LEGAL_TAX = [
  /\btax (advice|consequence|liability|deduct)/i,
  /how (much|will) .*tax/i,
  /\blegal (advice|opinion)\b/i,
  /(报税|税务|避税|节税).{0,12}(建议|怎么|如何|多少)/,
  /法律(意见|建议)/,
];

const ILLUSTRATION = [
  /(cash value|account value).{0,40}(in|after) \d+ years?/i,
  /\d+ ?(年后|年之后).{0,20}(现金价值|账户价值|cash value)/,
  /(现金价值|cash value).{0,20}\d+ ?年/,
  /(project|illustrat)e?d? (cash|account) value/i,
];

function matches(query: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(query));
}

export function classifyRedlines(query: string): RedlineResult {
  // Order matters: injection first, then recommendation/guarantee/legal-tax.
  if (matches(query, INJECTION)) {
    return { hard: "PROMPT_INJECTION_SUSPECTED", softFlags: [], reviewRequired: true };
  }
  if (matches(query, FINAL_RECOMMENDATION)) {
    return { hard: "FINAL_RECOMMENDATION_REQUESTED", softFlags: [], reviewRequired: true };
  }
  if (matches(query, GUARANTEE)) {
    return { hard: "GUARANTEE_REQUESTED", softFlags: [], reviewRequired: true };
  }
  if (matches(query, LEGAL_TAX)) {
    return { hard: "LEGAL_TAX_ADVICE_REQUESTED", softFlags: [], reviewRequired: true };
  }
  const softFlags: RefusalReason[] = [];
  if (matches(query, ILLUSTRATION)) softFlags.push("ILLUSTRATION_VALUE_REQUESTED");
  return { hard: null, softFlags, reviewRequired: softFlags.length > 0 };
}
