import type { RefusalReason } from "./types";

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

// Requests whose core intent is to FILL an absent knowledge-base value via
// estimation, guessing, external/general knowledge or approximation. The
// patterns target imperative estimation of a value ("estimate the ...
// premium/rate/value") and external-knowledge fallbacks — adjectival uses
// like "the estimated premiums shown in the sample table" do not match
// (\bestimate\b does not match "estimated", and no fallback marker fires).
const OUT_OF_KB_ESTIMATION = [
  /\b(estimate|guess|approximate|extrapolate|calculate|infer|ballpark)\b[^.。?？]{0,60}\b(premium|rate|value|cost|price|return|number|amount|figure)/i,
  /\b(industry averages?|industry (data|experience)|general (insurance )?knowledge|your (own |general )?knowledge|market averages?)\b/i,
  /\b(fill in|make up|assume|assumption|invent)\b[^.。?？]{0,40}\b(missing|value|number|figure)/i,
  /(if|even if|though)[^.。?？]{0,30}(pdf|document|guide|资料|文档)[^.。?？]{0,20}(incomplete|does not show|doesn'?t show|missing|没写|没有)/i,
  /(资料|文档|指南)没写[^。？]{0,15}(也|还是)?(帮我|给我)?(估|算|猜)/,
  /按(行业|市场)(经验|平均|水平)[^。？]{0,10}(估|算|猜)/,
  /(帮我|给我)?(估一下|估个|猜一个|猜个|大概算一下|毛估|估算一下)/,
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
  // Estimation-of-absent-value requests: classified deterministically BEFORE
  // the model can redefine the requested facets. The pipeline caps
  // evidenceStatus at insufficient for these — validated known facts may
  // still render with citations, but the requested value is never fabricated
  // and never counts as satisfied.
  if (matches(query, OUT_OF_KB_ESTIMATION)) softFlags.push("OUT_OF_KB_ESTIMATION_REQUEST");
  return { hard: null, softFlags, reviewRequired: softFlags.length > 0 };
}
