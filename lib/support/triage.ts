import { tokenize, searchChunks } from "../knowledge/lexical-search";
import { glossaryRewrite } from "../retrieval/glossary";
import { classifyRedlines } from "../rag/redlines";
import { detectLanguage } from "../retrieval/language";
import { matchedGlossaryTerms } from "../retrieval/glossary";
import type { Passage, TriageCorpus } from "./kb";
import type {
  MatchLevel,
  TicketCategory,
  TicketPriority,
  TriageCitation,
  TriageResult,
  TriageRoute,
} from "./types";

// Automated first line. Rules + BM25 retrieval + a fixed reply template.
// There is NO model call anywhere in this file (tests/database/schema.test.ts
// enforces that for lib/support): category, priority and route are decided by
// code, as CLAUDE.md §3.3 requires for every routing decision in this repo.
//
// The "match level" is computed from retrieval statistics and listed with its
// reasons. It is not a model's self-reported confidence (§6.5).

export const TRIAGE_RULES_VERSION = 1;

type Rule = { id: string; re: RegExp };

// Order matters: the first category rule that matches wins.
const PRIVACY: Rule[] = [
  { id: "privacy.delete_data", re: /\b(delete|erase|remove) (all )?(my|our) (data|account|information|records)\b/i },
  { id: "privacy.pii", re: /\b(ssn|social security|personal data|pii|gdpr|ccpa|data export)\b/i },
  { id: "privacy.zh", re: /(删除|注销).{0,6}(数据|账户|资料)|个人信息|隐私/ },
];

const RATE_LIMIT_HOWTO: Rule[] = [
  { id: "howto.rate_limit", re: /\b429\b|too many requests|rate[- ]limit/i },
  { id: "howto.rate_limit_zh", re: /请求太频繁|限流/ },
];

const BUG: Rule[] = [
  { id: "bug.http_5xx", re: /\b50[0-9]\b|internal server error|server error/i },
  { id: "bug.broken", re: /\b(broken|crash(es|ed)?|bug|not working|doesn'?t work|does not work|stopped working)\b/i },
  { id: "bug.failure", re: /\b(error|fails?|failed|failing|stuck|blank (page|screen)|timed? ?out|spinner|hangs?)\b/i },
  { id: "bug.wrong_result", re: /\b(wrong|incorrect) (page|citation|number|value|link)\b/i },
  { id: "bug.zh", re: /报错|出错|打不开|卡住|白屏|崩溃|一直转/ },
];

const ACCESS: Rule[] = [
  { id: "access.login", re: /\b(log ?in|sign ?in|password|locked out|reset my|2fa|sso|invite|permission)\b/i },
  { id: "access.zh", re: /登录|密码|账号/ },
];

const FEATURE: Rule[] = [
  { id: "feature.request", re: /\b(feature request|would be (great|nice|helpful)|could you (add|support)|please add|can you add|wish (it|you)|suggestion)\b/i },
  { id: "feature.zh", re: /希望(能|可以)?(增加|支持)|建议(增加|加上)/ },
];

const PRODUCT_TERMS =
  /\b(cash value|surrender|rider|premium|death benefit|term(plus)?|annuity|indexed|universal life|iul|mva|market value adjustment|guarantee period|participation rate|cap rate|free withdrawal|issue ages?|conversion|underwriting|beneficiary|face amount|policy|securerate|indexflex)\b/i;

const HOW_TO: Rule[] = [
  { id: "howto.question", re: /\b(how (do|does|can|to)|where (do|can|is)|can i|what does|what is|why (does|did|is))\b/i },
  { id: "howto.zh", re: /怎么|如何|在哪|为什么|是什么/ },
];

// Priority signals.
const OUTAGE = /\b(everyone|all (users|agents|brokers|of us)|whole (team|office)|(site|app|demo) is down|is down|outage|nobody can|no one can|entire)\b|所有人|全部(用户|同事)|整个(团队|办公室)/i;
const BLOCKING = /\b(can'?t|cannot|unable to|blocked|blocking|prevents?|no way to)\b|无法|没法|不能/i;

function firstMatch(rules: Rule[], text: string): string | null {
  return rules.find((r) => r.re.test(text))?.id ?? null;
}

export function classifyCategory(text: string): { category: TicketCategory; rule: string } {
  const redline = classifyRedlines(text);
  if (redline.hard) return { category: "policy_sensitive", rule: `redline.${redline.hard}` };
  const checks: Array<[TicketCategory, Rule[]]> = [
    ["privacy_request", PRIVACY],
    ["how_to", RATE_LIMIT_HOWTO],
    ["bug_report", BUG],
    ["access", ACCESS],
    ["feature_request", FEATURE],
  ];
  for (const [category, rules] of checks) {
    const id = firstMatch(rules, text);
    if (id) return { category, rule: id };
  }
  if (PRODUCT_TERMS.test(text) || matchedGlossaryTerms(text).length > 0) {
    return { category: "product_question", rule: "product.terms" };
  }
  const howTo = firstMatch(HOW_TO, text);
  if (howTo) return { category: "how_to", rule: howTo };
  return { category: "other", rule: "fallback.other" };
}

export function classifyPriority(category: TicketCategory, text: string): { priority: TicketPriority; rule: string } {
  switch (category) {
    case "bug_report":
      if (OUTAGE.test(text)) return { priority: "P1", rule: "bug.outage_many_users" };
      if (BLOCKING.test(text)) return { priority: "P2", rule: "bug.blocking_one_user" };
      return { priority: "P3", rule: "bug.degraded" };
    case "privacy_request":
      return { priority: "P2", rule: "privacy.always_p2" };
    case "policy_sensitive":
      return { priority: "P2", rule: "policy.always_p2" };
    case "access":
      return { priority: OUTAGE.test(text) ? "P1" : "P3", rule: OUTAGE.test(text) ? "access.many_users" : "access.single_user" };
    case "feature_request":
      return { priority: "P4", rule: "feature.always_p4" };
    default:
      return { priority: "P3", rule: "question.default_p3" };
  }
}

// Match-level thresholds. Calibrated once against the frozen triage set
// (evals/triage-cases.json) and frozen with rulesVersion; the eval report
// prints the observed scores so a drift is visible.
export const MATCH_THRESHOLDS = { highScore: 6, highCoverage: 0.3, mediumScore: 3 } as const;

const AUTO_DRAFT_CATEGORIES: readonly TicketCategory[] = ["how_to", "product_question"];
const AUTO_DRAFT_PRIORITIES: readonly TicketPriority[] = ["P3", "P4"];

/** Sentences of a passage, each an exact substring of the original content. */
export function sentencesOf(content: string): string[] {
  return content
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

/**
 * The verbatim sentence that carries the most (idf-weighted) ticket terms.
 * Headings (fewer than 4 words) are never quoted on their own; a table
 * passage is quoted whole. A help article whose title matched but whose
 * sentences do not is answered by its first sentence. null = nothing to quote.
 */
export function bestQuote(passage: Passage, terms: string[], corpus: TriageCorpus): string | null {
  if (passage.chunkType === "table") return passage.content.trim();
  // idf WITHIN the passage's own document: once the product is chosen, words
  // that describe the whole product ("term life insurance") say nothing about
  // which of its sentences answers the question.
  // Help articles have one or two sections, so they use corpus-wide idf.
  const siblings =
    passage.sourceType === "product_guide"
      ? corpus.index.docs.filter((d) => d.chunk.documentId === passage.documentId)
      : corpus.index.docs;
  const idf = (t: string) => {
    const df = siblings.filter((d) => d.tf.has(t)).length;
    return Math.log(1 + (siblings.length - df + 0.5) / (df + 0.5));
  };
  const sentences = sentencesOf(passage.content).filter((s) => s.split(/\s+/).length >= 4);
  let best: string | null = null;
  let bestScore = 0;
  for (const s of sentences) {
    const tokens = new Set(tokenize(s));
    const score = terms.filter((t) => tokens.has(t)).reduce((sum, t) => sum + idf(t), 0);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  if (!best && passage.sourceType === "help_article") return sentences[0] ?? null;
  return best;
}

/**
 * Tokens that only name a product ("demo", "securerate", "5"). They make the
 * cover page of a guide outscore the page that answers the question, so they
 * select WHICH product, not WHICH passage.
 */
function productNameTokens(corpus: TriageCorpus): Map<string, Set<string>> {
  const byDoc = new Map<string, Set<string>>();
  for (const p of corpus.passages.values()) {
    if (p.sourceType !== "product_guide" || byDoc.has(p.documentId)) continue;
    byDoc.set(p.documentId, new Set(tokenize(`${p.productName} ${p.documentName} ${p.documentId.replace(/_/g, " ")}`)));
  }
  return byDoc;
}

/** Product guides the ticket names, by their distinctive name token. */
export function mentionedProducts(text: string, corpus: TriageCorpus): string[] {
  const tokens = new Set(tokenize(text));
  const out: string[] = [];
  for (const [documentId, nameTokens] of productNameTokens(corpus)) {
    const distinctive = [...nameTokens].filter((t) => t.length > 3 && !GENERIC_NAME_TOKENS.has(t));
    if (distinctive.some((t) => tokens.has(t))) out.push(documentId);
  }
  return out;
}

const GENERIC_NAME_TOKENS = new Set(["demo", "product", "guide", "fixed", "annuity", "life", "term", "level", "insurance", "universal", "indexed", "doc"]);

const TEMPLATE = {
  en: {
    open: "Hi — thanks for reaching out. Here is what our documentation says:",
    close: "If this does not answer your question, reply and a support engineer will pick it up.",
  },
  zh: {
    open: "您好，感谢来信。以下是文档中的相关说明（英文原文）：",
    close: "如果这没有解决您的问题，请直接回复，支持工程师会接手处理。",
  },
} as const;

export interface TriageInput {
  subject: string;
  body: string;
}

/**
 * Pure: the same ticket text and corpus always produce the same result. The
 * result is frozen onto the ticket row and never recomputed.
 */
export function triageTicket(input: TriageInput, corpus: TriageCorpus): TriageResult {
  const text = `${input.subject}\n${input.body}`;
  const language = detectLanguage(text) === "zh" || detectLanguage(text) === "mixed" ? "zh" : "en";
  const redline = classifyRedlines(text);
  const { category, rule: categoryRule } = classifyCategory(text);
  const { priority, rule: priorityRule } = classifyPriority(category, text);

  // Product-name tokens choose the product, not the passage: strip them from
  // the search, then keep only the named product's pages (never mix products).
  const products = mentionedProducts(text, corpus);
  const nameTokens = new Set([...productNameTokens(corpus).values()].flatMap((s) => [...s]));
  const searched = [...new Set(tokenize(glossaryRewrite(text) ?? text))].filter((t) => !nameTokens.has(t));
  const unknownTerms = searched.filter((t) => !corpus.index.df.has(t));
  const search = searchChunks(corpus.index, searched.join(" "), { limit: 10 });
  const hits = search.hits
    .filter((h) => {
      const p = corpus.passages.get(h.chunkId)!;
      return p.sourceType !== "product_guide" || products.length !== 1 || p.documentId === products[0];
    })
    .slice(0, 3)
    .map((h) => {
    const p = corpus.passages.get(h.chunkId)!;
    return {
      sourceType: p.sourceType,
      sourceId: p.documentId,
      chunkId: h.chunkId,
      title: p.documentName,
      page: p.sourceType === "product_guide" ? p.pageStart : null,
      score: h.score,
      matchedTerms: h.matchedTerms,
    };
  });

  const top = hits[0];
  const topScore = top?.score ?? 0;
  const coverage = top && searched.length > 0 ? Math.round((top.matchedTerms.length / searched.length) * 1000) / 1000 : 0;
  const reasons: string[] = [];
  let level: MatchLevel;
  if (topScore >= MATCH_THRESHOLDS.highScore && coverage >= MATCH_THRESHOLDS.highCoverage) {
    level = "high";
    reasons.push(`top passage score ${topScore} ≥ ${MATCH_THRESHOLDS.highScore}`);
    reasons.push(`covers ${top!.matchedTerms.length}/${searched.length} ticket terms`);
  } else if (topScore >= MATCH_THRESHOLDS.mediumScore) {
    level = "medium";
    reasons.push(`top passage score ${topScore} (high needs ≥ ${MATCH_THRESHOLDS.highScore} and coverage ≥ ${MATCH_THRESHOLDS.highCoverage})`);
    reasons.push(`covers ${top!.matchedTerms.length}/${searched.length} ticket terms`);
  } else {
    level = "low";
    reasons.push(top ? `best passage score only ${topScore}` : "no passage matched any ticket term");
  }

  // Route. Every condition is listed, so a human can see why it went where it went.
  const routeReasons: string[] = [];
  if (!AUTO_DRAFT_CATEGORIES.includes(category)) routeReasons.push(`category ${category} always goes to a human`);
  if (!AUTO_DRAFT_PRIORITIES.includes(priority)) routeReasons.push(`priority ${priority} always goes to a human`);
  if (level !== "high") routeReasons.push(`knowledge-base match is ${level}, not high`);
  if (redline.hard) routeReasons.push(`red line ${redline.hard}: no draft is written`);
  if (redline.softFlags.length > 0) routeReasons.push(`review flags ${redline.softFlags.join(", ")}`);
  const route: TriageRoute = routeReasons.length === 0 ? "draft_ready" : "needs_human";
  if (route === "draft_ready") routeReasons.push("answerable question, low priority, high knowledge-base match, no red line");

  // Draft: verbatim sentences from the top passages, never paraphrased. A
  // human still has to approve it; nothing is ever sent by the system.
  let draft: TriageResult["draft"] = null;
  if (!redline.hard && level !== "low" && top) {
    const citations: TriageCitation[] = [];
    // The top passage, plus a second one only when it is another part of the
    // SAME document and scores at least 60 % as well — never a loosely
    // related article stapled on.
    for (const hit of hits.slice(0, 2)) {
      if (hit !== top && (hit.sourceId !== top.sourceId || hit.score < top.score * 0.6)) continue;
      const passage = corpus.passages.get(hit.chunkId)!;
      const quote = bestQuote(passage, hit.matchedTerms, corpus);
      if (!quote) continue;
      citations.push({
        citationId: `c${citations.length + 1}`,
        sourceType: hit.sourceType,
        sourceId: hit.sourceId,
        chunkId: hit.chunkId,
        title: hit.title,
        page: hit.page,
        quote,
        url: passage.url,
      });
    }
    const t = TEMPLATE[language];
    const lines = citations.map(
      (c) => `${c.quote.split("\n").map((line) => `> ${line}`).join("\n")}\n> — ${c.title}${c.page ? `, p. ${c.page}` : ""} [${c.citationId}]`,
    );
    if (citations.length > 0)
      draft = { text: [t.open, "", ...lines.flatMap((l) => [l, ""]), t.close].join("\n"), citations };
  }

  return {
    schemaVersion: 1,
    rulesVersion: TRIAGE_RULES_VERSION,
    language,
    category,
    categoryRule,
    priority,
    priorityRule,
    redline: { hard: redline.hard, softFlags: redline.softFlags },
    retrieval: { searchedTerms: searched, unknownTerms, hits },
    match: { level, topScore, coverage, reasons },
    route,
    routeReasons,
    draft,
  };
}

/** Deterministic check used by tests and the eval: every quote is verbatim. */
export function verifyDraftQuotes(result: TriageResult, corpus: TriageCorpus): string[] {
  const problems: string[] = [];
  for (const c of result.draft?.citations ?? []) {
    const passage = corpus.passages.get(c.chunkId);
    if (!passage) problems.push(`${c.citationId}: unknown chunk ${c.chunkId}`);
    else if (!passage.content.includes(c.quote)) problems.push(`${c.citationId}: quote is not verbatim`);
  }
  return problems;
}
