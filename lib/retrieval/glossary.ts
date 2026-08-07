// Deterministic insurance-term normalization — no LLM. Two uses:
//   1. Baseline B in calibration and (if it wins) production: augment a
//      Chinese/mixed query with the English terms its insurance vocabulary
//      maps to, giving the embedding an English anchor.
//   2. English acronym expansion (IUL -> indexed universal life) where the
//      calibration shows it helps.
// The tables only translate terminology; they never add facts, numbers or
// products the user did not mention.

const ZH_GLOSSARY: Array<[string, string]> = [
  ["定期寿险", "term life insurance"],
  ["万能寿险", "universal life insurance"],
  ["指数型万能寿险", "indexed universal life"],
  ["年金", "annuity"],
  ["固定年金", "fixed annuity"],
  ["现金价值", "cash value"],
  ["退保费用", "surrender charge"],
  ["退保", "surrender"],
  ["附加条款", "rider"],
  ["附约", "rider"],
  ["身故赔偿", "death benefit"],
  ["身故给付", "death benefit"],
  ["保费", "premium"],
  ["续保", "renewal"],
  ["保证利率", "guaranteed rate"],
  ["利率", "interest rate"],
  ["上限", "cap"],
  ["参与率", "participation rate"],
  ["保底", "guaranteed minimum"],
  ["免体检", "no evidence of insurability"],
  ["转换", "conversion"],
  ["免费提取", "free withdrawal"],
  ["提取", "withdrawal"],
  ["市场价值调整", "market value adjustment"],
  ["核保", "underwriting"],
  ["受益人", "beneficiary"],
  ["保额", "face amount"],
  ["承保年龄", "issue ages"],
  ["等待期", "waiting period"],
];

const EN_ACRONYMS: Array<[RegExp, string]> = [
  [/\bIUL\b/gi, "indexed universal life"],
  [/\bMVA\b/gi, "market value adjustment"],
  [/\bUL\b/gi, "universal life"],
];

// Longest-match-first so 退保费用 wins over 退保.
const ZH_SORTED = [...ZH_GLOSSARY].sort((a, b) => b[0].length - a[0].length);

// Returns the English glossary terms matched in a zh/mixed query, in match
// order, deduplicated. Empty array when nothing matches.
export function matchedGlossaryTerms(query: string): string[] {
  const terms: string[] = [];
  let remaining = query;
  for (const [zh, en] of ZH_SORTED) {
    if (remaining.includes(zh)) {
      if (!terms.includes(en)) terms.push(en);
      remaining = remaining.replaceAll(zh, " ");
    }
  }
  return terms;
}

// Baseline B rewrite: the original query augmented with matched English
// terms and expanded acronyms. Returns null when normalization adds nothing.
export function glossaryRewrite(query: string): string | null {
  const terms = matchedGlossaryTerms(query);
  let expanded = query;
  for (const [re, full] of EN_ACRONYMS) {
    expanded = expanded.replace(re, (m) => `${m} ${full}`);
  }
  const augmented =
    terms.length > 0 ? `${expanded} ${terms.join(" ")}` : expanded;
  return augmented === query ? null : augmented;
}

// English-only acronym expansion used in calibration for en queries.
export function expandEnglishAcronyms(query: string): string | null {
  let expanded = query;
  for (const [re, full] of EN_ACRONYMS) {
    expanded = expanded.replace(re, (m) => `${m} ${full}`);
  }
  return expanded === query ? null : expanded;
}
