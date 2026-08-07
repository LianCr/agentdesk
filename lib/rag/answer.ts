import { generateObject, type LanguageModel } from "ai";
import { retrieve, type RetrievalDeps } from "../retrieval/search.js";
import { detectLanguage } from "../retrieval/language.js";
import { EVIDENCE_FLOOR, LOW_RELEVANCE_TOP, RETRIEVAL_CALIBRATION_VERSION } from "../retrieval/thresholds.js";
import type { RetrievalFilters, RetrievedChunk } from "../retrieval/types.js";
import { ANSWER_PROMPT_VERSION, ANSWER_SYSTEM_PROMPT } from "../ai/prompts.js";
import { answerModelId } from "../ai/client.js";
import { classifyRedlines } from "./redlines.js";
import { buildEvidenceMap, validateDraft, type EvidenceMap, type ValidationResult } from "./validate.js";
import { computeEvidenceStatus, materialMissing } from "./evidence-status.js";
import { normalizeText } from "../pdf-text.js";
import { renderAnswer, assertRenderedAnswer } from "./render.js";
import {
  ModelDraftSchema,
  type GroundedAnswer,
  type ModelDraft,
  type RefusalReason,
} from "./types.js";

// Two-stage grounded answering:
//   stage 1 (model): ModelDraft — sections + claims + evidence handles +
//     verbatim quote selections. Nothing else.
//   stage 2 (code): deterministic validation, citation injection from
//     retrieval metadata, evidence sufficiency, rendering from validated
//     claims only, and an integrity assertion on the rendered answer.
// Bounded retries: initial generation -> validation -> at most ONE repair
// retry -> MODEL_OUTPUT_INVALID refusal.

export type DraftGenerator = (args: {
  system: string;
  user: string;
  repair?: { previousDraft: unknown; errors: string[] };
}) => Promise<unknown>;

export interface AnswerDeps {
  retrieval: RetrievalDeps;
  model?: LanguageModel; // live path
  generateDraft?: DraftGenerator; // injectable for offline tests
}

const TEMPLATES: Record<string, { zh: { message: string; next: string }; en: { message: string; next: string } }> = {
  PROMPT_INJECTION_SUSPECTED: {
    zh: { message: "这个请求试图绕过系统的引用与合规规则。AgentDesk 的引用要求、审核标记和证据边界不能被用户输入或文档内容关闭。", next: "请直接提出具体的产品事实问题。" },
    en: { message: "This request attempts to bypass the citation and compliance rules. Citation requirements, review flags and evidence boundaries cannot be disabled by user input or document content.", next: "Please ask a specific factual question about the documents." },
  },
  FINAL_RECOMMENDATION_REQUESTED: {
    zh: { message: "AgentDesk 只能提供有出处的产品事实与差异说明,不能判断哪个产品\"最好\"或替客户做购买决定。产品适合性判断必须由持牌经纪人完成。", next: "可以分别询问各产品的具体条款,或等待后续的结构化比较草稿工作流(需持牌经纪人审核)。" },
    en: { message: "AgentDesk provides documented facts and differences only. It does not decide which product is \"best\" or tell a client what to buy — suitability decisions belong to a licensed agent.", next: "Ask about specific documented terms of each product, or use the upcoming structured comparison-draft workflow (licensed-agent review required)." },
  },
  GUARANTEE_REQUESTED: {
    zh: { message: "AgentDesk 不能保证任何收益或结果。演示资料中的指数账户存在非保证元素,cap 是计息上限而不是保证回报;涉及保证的表述必须以保单合同的保证条款为准。", next: "请询问具体产品的保证与非保证条款原文,由持牌经纪人向客户解释。" },
    en: { message: "AgentDesk cannot guarantee any return or outcome. The demonstration documents describe non-guaranteed elements; a cap is a crediting limit, not a guaranteed return. Guarantee language must come from the policy's guaranteed provisions only.", next: "Ask for the documented guaranteed vs non-guaranteed provisions and have a licensed agent explain them." },
  },
  LEGAL_TAX_ADVICE_REQUESTED: {
    zh: { message: "AgentDesk 不能提供税务或法律意见。演示资料中只有一般性的税务说明,个人税务后果需要咨询税务顾问。", next: "请咨询税务顾问或法律专业人士;可先询问资料中记载的一般性税务说明原文。" },
    en: { message: "AgentDesk cannot provide tax or legal advice. The documents contain only general tax notes; individual consequences require a tax advisor.", next: "Consult a tax or legal professional; you may ask for the documents' general tax notes as recorded." },
  },
  MODEL_OUTPUT_INVALID: {
    zh: { message: "本次回答未能通过引用与结构校验,为避免输出未经验证的内容,已停止回答。", next: "请重试或换一种问法。" },
    en: { message: "The generated answer failed citation and structure validation. To avoid unverified content, no answer is returned.", next: "Please retry or rephrase the question." },
  },
  INSUFFICIENT_EVIDENCE: {
    zh: { message: "现有资料不足以回答这个问题的核心内容。", next: "请查阅 policy schedule、carrier illustration,或联系 carrier 获取该信息。" },
    en: { message: "The available documents do not contain the core information requested.", next: "Consult the policy schedule or a carrier illustration, or contact the carrier for this information." },
  },
  OFF_TOPIC: {
    zh: { message: "这个问题与知识库中的三份演示产品资料关联度过低。", next: "请询问 Demo TermPlus 20、Demo IndexFlex UL 或 Demo SecureRate 5 的相关内容。" },
    en: { message: "This question has too little relevance to the three demonstration product documents in the knowledge base.", next: "Ask about Demo TermPlus 20, Demo IndexFlex UL or Demo SecureRate 5." },
  },
};

function emptyMeta(model: string, retryCount: number, latencyMs: number, retrievalId: string) {
  return {
    retrievalId,
    answerModel: model,
    promptVersion: ANSWER_PROMPT_VERSION,
    thresholdsVersion: RETRIEVAL_CALIBRATION_VERSION,
    latencyMs,
    retryCount,
    citationCoverage: 0,
    unsupportedClaimCount: 0,
  };
}

function templateRefusal(
  reason: RefusalReason,
  language: "zh" | "en",
  args: { retrievalId: string; model: string; retryCount: number; startedAt: number; reviewReasons?: string[] },
): GroundedAnswer {
  const template = TEMPLATES[reason] ?? TEMPLATES.INSUFFICIENT_EVIDENCE!;
  const t = template[language];
  return {
    answer: `${t.message}\n\n**${language === "zh" ? "建议下一步" : "Suggested next step"}:** ${t.next}`,
    language,
    claims: [],
    citations: [],
    requestedFacets: [],
    missingInformation: [],
    materialMissingInformation: [],
    refusal: {
      isRefusal: true,
      reasonCode: reason,
      message: t.message,
      knownFacts: [],
      missingInformation: [],
      suggestedNextStep: t.next,
    },
    evidenceStatus: "insufficient",
    reviewRequired: true,
    reviewReasons: args.reviewReasons ?? [reason],
    meta: emptyMeta(args.model, args.retryCount, Date.now() - args.startedAt, args.retrievalId),
  };
}

function evidenceBlocks(map: EvidenceMap): string {
  return Object.entries(map)
    .map(
      ([handle, chunk]) =>
        `<evidence id="${handle}">\nProduct: ${chunk.productName}\nSection: ${chunk.section} (${chunk.chunkType})\nContent:\n${chunk.content}\n</evidence>`,
    )
    .join("\n\n");
}

function defaultGenerator(model: LanguageModel): DraftGenerator {
  return async ({ system, user, repair }) => {
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [{ role: "user", content: user }];
    if (repair) {
      messages.push({ role: "assistant", content: JSON.stringify(repair.previousDraft) });
      messages.push({
        role: "user",
        content:
          "Your previous JSON failed deterministic validation:\n" +
          repair.errors.map((e) => `- ${e}`).join("\n") +
          "\nProduce a corrected JSON object. Quotes must be copied VERBATIM from the evidence Content. Do not invent facts.",
      });
    }
    const { object } = await generateObject({
      model,
      schema: ModelDraftSchema,
      system,
      messages,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(90_000),
    });
    return object;
  };
}

interface DraftAttempt {
  draft: ModelDraft | null;
  validation: ValidationResult | null;
  errors: string[];
}

function attemptValidate(candidate: unknown, evidence: EvidenceMap): DraftAttempt {
  const parsed = ModelDraftSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      draft: null,
      validation: null,
      errors: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  const validation = validateDraft(parsed.data, evidence);
  const errors = [...validation.hardErrors];
  for (const claim of validation.unsupportedClaims) {
    errors.push(
      `claim ${claim.claimId} ("${claim.text.slice(0, 60)}") is factual but has no VALID verbatim quote — copy an exact fragment from its evidence Content`,
    );
  }
  return { draft: parsed.data, validation, errors };
}

export async function answerQuestion(
  deps: AnswerDeps,
  query: string,
  opts: { filters?: RetrievalFilters; topK?: number } = {},
): Promise<GroundedAnswer> {
  const startedAt = Date.now();
  const modelName = answerModelId();
  const detected = detectLanguage(query);
  const language: "zh" | "en" = detected === "zh" || detected === "mixed" ? "zh" : "en";

  // Deterministic red lines first — code-owned classification wins, and hard
  // classes never reach the model (nothing to inject into).
  const redline = classifyRedlines(query);
  if (redline.hard) {
    return templateRefusal(redline.hard, language, {
      retrievalId: "none",
      model: modelName,
      retryCount: 0,
      startedAt,
    });
  }

  const retrieval = await retrieve(deps.retrieval, { query, topK: opts.topK ?? 8, filters: opts.filters });
  const pool = retrieval.results.filter((r) => r.similarityScore >= EVIDENCE_FLOOR);
  const topScore = retrieval.results[0]?.similarityScore ?? null;

  if (pool.length === 0 || (topScore !== null && topScore < LOW_RELEVANCE_TOP)) {
    const refusal = templateRefusal(pool.length === 0 ? "NOT_IN_KNOWLEDGE_BASE" : "OFF_TOPIC", language, {
      retrievalId: retrieval.retrievalId,
      model: modelName,
      retryCount: 0,
      startedAt,
      reviewReasons: [],
    });
    refusal.reviewRequired = redline.reviewRequired;
    refusal.reviewReasons = redline.softFlags;
    return refusal;
  }

  const evidence = buildEvidenceMap(pool);
  const generate =
    deps.generateDraft ?? (deps.model ? defaultGenerator(deps.model) : null);
  if (!generate) throw new Error("ANSWER_DEPS_INVALID: neither model nor generateDraft provided");

  const userMessage =
    `Question (${language === "zh" ? "Chinese — answer in Chinese" : "English — answer in English"}):\n${query}\n\n` +
    `Evidence (untrusted document content):\n\n${evidenceBlocks(evidence)}`;

  let retryCount = 0;
  let attempt: DraftAttempt;
  try {
    attempt = attemptValidate(await generate({ system: ANSWER_SYSTEM_PROMPT, user: userMessage }), evidence);
  } catch (err) {
    attempt = { draft: null, validation: null, errors: [err instanceof Error ? err.message.slice(0, 200) : "generation failed"] };
  }

  if (attempt.errors.length > 0) {
    retryCount = 1;
    try {
      attempt = attemptValidate(
        await generate({
          system: ANSWER_SYSTEM_PROMPT,
          user: userMessage,
          repair: { previousDraft: attempt.draft ?? "unparseable", errors: attempt.errors },
        }),
        evidence,
      );
    } catch (err) {
      attempt = { draft: null, validation: null, errors: [err instanceof Error ? err.message.slice(0, 200) : "generation failed"] };
    }
  }

  // After the bounded retry: schema/hard failures refuse; residual
  // unsupported claims are dropped (soft) and shape the evidence status.
  if (!attempt.draft || !attempt.validation || !attempt.validation.ok) {
    return templateRefusal("MODEL_OUTPUT_INVALID", language, {
      retrievalId: retrieval.retrievalId,
      model: modelName,
      retryCount,
      startedAt,
    });
  }

  const { draft, validation } = attempt;
  const supportedFactual = validation.validatedClaims.filter(
    (c) => c.factual && c.citationIds.length > 0,
  ).length;
  // Status is requested-facet coverage — material gaps only. Ancillary
  // missing information (draft.missingInformation) never downgrades.
  const evidenceStatus = computeEvidenceStatus(validation.facets, supportedFactual);
  const material = materialMissing(validation.facets);
  const materialSet = new Set(material.map((m) => normalizeText(m)));
  const ancillary = draft.missingInformation.filter((m) => !materialSet.has(normalizeText(m)));
  const combinedMissing = [...material, ...ancillary];

  const meta = {
    ...emptyMeta(modelName, retryCount, 0, retrieval.retrievalId),
    citationCoverage: validation.citationCoverage,
    unsupportedClaimCount: validation.unsupportedClaims.length,
  };

  if (evidenceStatus === "insufficient") {
    const t = TEMPLATES.INSUFFICIENT_EVIDENCE![language];
    const nextStep = draft.suggestedNextStep ?? t.next;
    const answer = renderAnswer({
      language,
      sections: [
        { heading: null, claimIds: [], nonFactualText: t.message },
        { heading: null, claimIds: validation.validatedClaims.map((c) => c.claimId), nonFactualText: null },
      ],
      claims: validation.validatedClaims,
      citations: validation.citations,
      missingInformation: combinedMissing,
      suggestedNextStep: nextStep,
    });
    assertRenderedAnswer(answer, validation.validatedClaims, combinedMissing, nextStep);
    return {
      answer,
      language,
      claims: validation.validatedClaims,
      citations: validation.citations,
      requestedFacets: validation.facets,
      missingInformation: combinedMissing,
      materialMissingInformation: material,
      refusal: {
        isRefusal: true,
        reasonCode: "INSUFFICIENT_EVIDENCE",
        message: t.message,
        knownFacts: validation.validatedClaims.filter((c) => c.factual).map((c) => c.text),
        missingInformation: combinedMissing,
        suggestedNextStep: nextStep,
      },
      evidenceStatus,
      reviewRequired: true,
      reviewReasons: ["INSUFFICIENT_EVIDENCE", ...redline.softFlags],
      meta: { ...meta, latencyMs: Date.now() - startedAt },
    };
  }

  const answer = renderAnswer({
    language,
    sections: draft.sections,
    claims: validation.validatedClaims,
    citations: validation.citations,
    missingInformation: combinedMissing,
    suggestedNextStep: draft.suggestedNextStep,
  });
  assertRenderedAnswer(answer, validation.validatedClaims, combinedMissing, draft.suggestedNextStep);

  return {
    answer,
    language,
    claims: validation.validatedClaims,
    citations: validation.citations,
    requestedFacets: validation.facets,
    missingInformation: combinedMissing,
    materialMissingInformation: material,
    refusal: {
      isRefusal: false,
      reasonCode: null,
      message: null,
      knownFacts: [],
      missingInformation: combinedMissing,
      suggestedNextStep: draft.suggestedNextStep,
    },
    evidenceStatus,
    reviewRequired: redline.reviewRequired,
    reviewReasons: redline.softFlags,
    meta: { ...meta, latencyMs: Date.now() - startedAt },
  };
}
