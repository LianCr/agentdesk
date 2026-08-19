import { MISSING_FIELD_LABELS } from "./field-labels";
import { normalizeClientContext } from "./client-context";
import { UNKNOWN, type ClientContext } from "./types";
import type { SyntheticCase } from "../schemas";

// The demo-client roster shown on /compare, the counterpart to the knowledge
// base panel on the assistant page: it answers "which clients does this demo
// have, and what is actually known about each of them".
//
// Two rules shape it.
//
// 1. What is stated and what is not is COMPUTED, never authored. Every field
//    below runs through normalizeClientContext(); the ones that come back as
//    UNKNOWN are exactly the ones the fixture does not state, which is also why
//    they later appear under "information still needed". One source, two views.
//
// 2. `riskTier` and the whole `expected` block are deliberately absent. They are
//    frozen ground truth for the evaluations, and runtime code never reads them.
//    Showing them would suggest the risk flags and workflow decision were read
//    out of the case file rather than computed by lib/guardrails/rules.ts.
//    `replacementContext` is the opposite: it is derived at runtime from the
//    client's own words, so showing it displays a computation.

/** The ClientContext fields carrying an UNKNOWN sentinel — the partitionable set. */
const PARTITIONABLE = [
  "age",
  "dependents",
  "budgetMonthly",
  "coverageHorizon",
  "existingCoverageNote",
  "riskTolerance",
  "tobaccoUse",
  "desiredCoverageAmount",
] as const;
type PartitionableField = (typeof PARTITIONABLE)[number];

const FIELD_LABELS: Record<PartitionableField, { zh: string; en: string }> = {
  age: { zh: "年龄", en: "Age" },
  dependents: { zh: "受养人", en: "Dependents" },
  budgetMonthly: { zh: "月预算", en: "Monthly budget" },
  coverageHorizon: { zh: "保障期望", en: "Coverage horizon" },
  existingCoverageNote: { zh: "现有保障", en: "Existing coverage" },
  riskTolerance: { zh: "风险偏好", en: "Risk tolerance" },
  // Same wording as the missing-information list, imported so it cannot drift.
  tobaccoUse: MISSING_FIELD_LABELS.tobaccoUse!,
  desiredCoverageAmount: MISSING_FIELD_LABELS.desiredCoverageAmount!,
};

// Descriptive attributes the fixtures state but normalizeClientContext drops,
// because the comparison engine has no use for them. They are read straight off
// the raw record rather than widening ClientContext, which would reach into the
// schema, the review snapshot and the review page's rendering.
const DESCRIPTOR_LABELS: Record<string, { zh: string; en: string }> = {
  maritalStatus: { zh: "婚姻状况", en: "Marital status" },
  occupation: { zh: "职业", en: "Occupation" },
  status: { zh: "状态", en: "Status" },
};

// The VALUES are English source strings too. A Chinese card must not leak
// `small business owner`, so values go through an approved table exactly like
// the keys do. No approved pair -> the whole entry is omitted rather than
// guessed (the same discipline as lib/reviews/checklist.ts).
const DESCRIPTOR_VALUES: Record<string, { zh: string; en: string }> = {
  married: { zh: "已婚", en: "Married" },
  single: { zh: "未婚", en: "Single" },
  "small business owner": { zh: "小企业主", en: "Small business owner" },
  retired: { zh: "已退休", en: "Retired" },
  employed: { zh: "在职", en: "Employed" },
};

const RISK_TOLERANCE_VALUES: Record<string, { zh: string; en: string }> = {
  low: { zh: "低", en: "Low" },
  moderate: { zh: "中等", en: "Moderate" },
  high: { zh: "高", en: "High" },
};

export interface ClientRosterField {
  key: string;
  labelZh: string;
  labelEn: string;
  valueZh: string;
  valueEn: string;
  /** True when the value is fixture free text that cannot be translated without
   *  inventing something, so the UI marks it up as English. */
  verbatimEnglish?: boolean;
}

export type ClientRosterGap = Pick<ClientRosterField, "key" | "labelZh" | "labelEn">;

export interface ClientRosterEntry {
  caseId: string;
  displayName: string;
  language: "zh" | "en";
  /** Raw goal id; the panel renders it through the shared GOAL_LABELS map. */
  primaryGoal: string;
  /** Derived by detectReplacementContext(), not declared by the fixture. */
  replacementContext: boolean;
  stated: ClientRosterField[];
  /** Fields the fixture leaves out, which is why they surface as missing later. */
  notStated: ClientRosterGap[];
  /** The client's own words, in their own language. */
  clientQuestions: string[];
}

function statedValue(
  field: PartitionableField,
  value: Exclude<ClientContext[PartitionableField], typeof UNKNOWN>,
): { valueZh: string; valueEn: string; verbatimEnglish?: boolean } | null {
  switch (field) {
    case "age":
      return { valueZh: `${value} 岁`, valueEn: `${value}` };
    case "dependents":
      return { valueZh: `${value} 位`, valueEn: `${value}` };
    // Inline-bilingual in one string, the way ClientSummary already writes these
    // two — a separate zh and en rendering would just repeat the number.
    case "budgetMonthly":
      return { valueZh: `$${value} / 月 per month`, valueEn: `$${value} / 月 per month` };
    case "coverageHorizon":
      return { valueZh: `${value} 年 years`, valueEn: `${value} 年 years` };
    case "existingCoverageNote":
      // "none" is a STATED fact — the client has no existing coverage. That is a
      // different thing from not knowing whether they have any, which is what a
      // replacement review has to establish.
      if (value === "none") return { valueZh: "无", valueEn: "None" };
      return { valueZh: String(value), valueEn: String(value), verbatimEnglish: true };
    case "riskTolerance": {
      const approved = RISK_TOLERANCE_VALUES[String(value)];
      return approved ? { valueZh: approved.zh, valueEn: approved.en } : null;
    }
    default:
      // tobaccoUse and desiredCoverageAmount are UNKNOWN in every committed
      // fixture; if one ever states them, it needs a deliberate rendering rather
      // than a guessed one.
      return null;
  }
}

function descriptorFields(rawClient: Record<string, unknown>): ClientRosterField[] {
  const out: ClientRosterField[] = [];
  for (const [key, label] of Object.entries(DESCRIPTOR_LABELS)) {
    const raw = rawClient[key];
    if (typeof raw !== "string") continue;
    const approved = DESCRIPTOR_VALUES[raw.trim().toLowerCase()];
    if (!approved) continue; // better absent than half-translated
    out.push({ key, labelZh: label.zh, labelEn: label.en, valueZh: approved.zh, valueEn: approved.en });
  }
  return out;
}

export function buildClientRosterEntry(syntheticCase: SyntheticCase): ClientRosterEntry {
  const context = normalizeClientContext(syntheticCase);
  const stated: ClientRosterField[] = [];
  const notStated: ClientRosterGap[] = [];

  for (const field of PARTITIONABLE) {
    const label = FIELD_LABELS[field];
    const value = context[field];
    if (value === UNKNOWN) {
      notStated.push({ key: field, labelZh: label.zh, labelEn: label.en });
      continue;
    }
    const rendered = statedValue(field, value as Exclude<typeof value, typeof UNKNOWN>);
    if (!rendered) {
      // Stated but with no approved rendering: report it as a gap rather than
      // showing a raw source string on a bilingual card.
      notStated.push({ key: field, labelZh: label.zh, labelEn: label.en });
      continue;
    }
    stated.push({ key: field, labelZh: label.zh, labelEn: label.en, ...rendered });
  }

  return {
    caseId: context.caseId,
    displayName: context.displayName,
    language: context.language,
    primaryGoal: context.primaryGoal,
    replacementContext: context.replacementContext,
    // Descriptors first: they say who the person is before what they can spend.
    stated: [...descriptorFields(syntheticCase.client as Record<string, unknown>), ...stated],
    notStated,
    clientQuestions: context.clientQuestions,
  };
}
