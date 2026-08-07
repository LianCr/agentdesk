// Deterministic GroundedAnswer fixtures for mocked UI tests. Shapes mirror
// the /api/answer response (GroundedAnswer + citation.sourceUrl).

export interface UiCitation {
  citationId: string;
  documentId: string;
  documentName: string;
  productName: string;
  chunkId: string;
  pageStart: number;
  pageEnd: number;
  section: string;
  quote: string;
  claimIds: string[];
  sourceUrl: string | null;
}

export interface UiGroundedAnswer {
  answer: string;
  language: "zh" | "en";
  claims: { claimId: string; text: string; factual: boolean; citationIds: string[] }[];
  citations: UiCitation[];
  requestedFacets: { facetId: string; description: string; required: boolean; supported: boolean; claimIds: string[] }[];
  missingInformation: string[];
  materialMissingInformation: string[];
  refusal: {
    isRefusal: boolean;
    reasonCode: string | null;
    message: string | null;
    knownFacts: string[];
    missingInformation: string[];
    suggestedNextStep: string | null;
  };
  evidenceStatus: "strong" | "partial" | "insufficient";
  reviewRequired: boolean;
  reviewReasons: string[];
  meta: {
    retrievalId: string;
    answerModel: string;
    promptVersion: number;
    thresholdsVersion: number;
    latencyMs: number;
    retryCount: number;
    citationCoverage: number;
    unsupportedClaimCount: number;
  };
}

const meta = {
  answerModel: "gpt-5-mini",
  promptVersion: 2,
  thresholdsVersion: 1,
  latencyMs: 1234,
  retryCount: 0,
  citationCoverage: 1,
  unsupportedClaimCount: 0,
};

export const strongAnswer: UiGroundedAnswer = {
  answer: "**回答**\n- Demo TermPlus 20 不积累现金价值。 [1]",
  language: "zh",
  claims: [
    { claimId: "c1", text: "Demo TermPlus 20 不积累现金价值。", factual: true, citationIds: ["cit_001"] },
  ],
  citations: [
    {
      citationId: "cit_001",
      documentId: "doc_termplus20_v1",
      documentName: "Demo TermPlus 20 Product Guide",
      productName: "Demo TermPlus 20",
      chunkId: "doc_termplus20_v1:c001",
      pageStart: 2,
      pageEnd: 2,
      section: "At a Glance",
      quote: "Cash Value None. The policy does not accumulate cash value.",
      claimIds: ["c1"],
      sourceUrl: "/documents/demo-termplus-20.pdf#page=2",
    },
  ],
  requestedFacets: [
    { facetId: "f1", description: "whether term life accumulates cash value", required: true, supported: true, claimIds: ["c1"] },
  ],
  missingInformation: [],
  materialMissingInformation: [],
  refusal: { isRefusal: false, reasonCode: null, message: null, knownFacts: [], missingInformation: [], suggestedNextStep: null },
  evidenceStatus: "strong",
  reviewRequired: false,
  reviewReasons: [],
  meta: { ...meta, retrievalId: "req_mock_strong" },
};

export const insufficientAnswer: UiGroundedAnswer = {
  answer:
    "现有资料不足以回答这个问题的核心内容。\n- 该产品的投保年龄为 18–60 岁。 [1]\n\n**资料中缺少:**\n- Demo TermPlus 20 在 61 岁时的续保保费金额\n\n**建议下一步:** 请查阅 policy schedule 或联系 carrier。",
  language: "zh",
  claims: [
    { claimId: "c1", text: "该产品的投保年龄为 18–60 岁。", factual: true, citationIds: ["cit_001"] },
  ],
  citations: [
    {
      citationId: "cit_001",
      documentId: "doc_termplus20_v1",
      documentName: "Demo TermPlus 20 Product Guide",
      productName: "Demo TermPlus 20",
      chunkId: "doc_termplus20_v1:c002",
      pageStart: 3,
      pageEnd: 3,
      section: "Eligibility and Underwriting Classes",
      quote: "available at issue ages 18–60",
      claimIds: ["c1"],
      sourceUrl: "/documents/demo-termplus-20.pdf#page=3",
    },
  ],
  requestedFacets: [
    { facetId: "f1", description: "Demo TermPlus 20 在 61 岁时的续保保费金额", required: true, supported: false, claimIds: [] },
  ],
  missingInformation: ["Demo TermPlus 20 在 61 岁时的续保保费金额"],
  materialMissingInformation: ["Demo TermPlus 20 在 61 岁时的续保保费金额"],
  refusal: {
    isRefusal: true,
    reasonCode: "INSUFFICIENT_EVIDENCE",
    message: "现有资料不足以回答这个问题的核心内容。",
    knownFacts: ["该产品的投保年龄为 18–60 岁。"],
    missingInformation: ["Demo TermPlus 20 在 61 岁时的续保保费金额"],
    suggestedNextStep: "请查阅 policy schedule 或联系 carrier。",
  },
  evidenceStatus: "insufficient",
  reviewRequired: true,
  reviewReasons: ["INSUFFICIENT_EVIDENCE"],
  meta: { ...meta, retrievalId: "req_mock_missing" },
};

export const reviewAnswer: UiGroundedAnswer = {
  answer:
    "AgentDesk 只能提供有出处的产品事实与差异说明，不能判断哪个产品\"最好\"或替客户做购买决定。\n\n**建议下一步:** 可以分别询问各产品的具体条款，由持牌经纪人完成适合性判断。",
  language: "zh",
  claims: [],
  citations: [],
  requestedFacets: [],
  missingInformation: [],
  materialMissingInformation: [],
  refusal: {
    isRefusal: true,
    reasonCode: "FINAL_RECOMMENDATION_REQUESTED",
    message: "AgentDesk 只能提供有出处的产品事实与差异说明。",
    knownFacts: [],
    missingInformation: [],
    suggestedNextStep: "可以分别询问各产品的具体条款，由持牌经纪人完成适合性判断。",
  },
  evidenceStatus: "insufficient",
  reviewRequired: true,
  reviewReasons: ["FINAL_RECOMMENDATION_REQUESTED"],
  meta: { ...meta, citationCoverage: 0, retrievalId: "req_mock_review" },
};
