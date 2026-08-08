import type { ClientContext, ComparisonStatus, ReviewFlag } from "../comparison/types";
import type { WorkflowDecision } from "../schemas";
import type { RequiredApprovalLevel } from "../reviews/types";

// Deterministic workflow routing (CLAUDE.md §5 names this file).
//
// A pure function: no model, no database, no network, no narrative input. The
// answer depends only on validated review flags and on whether the facts
// themselves held up. That is what makes "the LLM cannot override rules.ts"
// (CLAUDE.md M5 acceptance) true by construction rather than by discipline —
// there is no parameter through which model output could arrive.
//
// It consumes the ReviewFlag vocabulary M4 already produces. Minting a fourth
// review vocabulary is explicitly forbidden (CLAUDE.md §13).

export interface WorkflowRoutingInput {
  reviewReasons: readonly ReviewFlag[];
  comparisonStatus: ComparisonStatus;
  client: ClientContext | null;
}

export interface WorkflowRouting {
  workflowDecision: WorkflowDecision;
  requiredApprovalLevel: RequiredApprovalLevel;
  /** The subset of validated flags that actually drove this routing. */
  routingReasons: ReviewFlag[];
}

// Flags that make a draft unsafe to put in front of a client without a
// licensed agent: an existing contract may be given up, or the client is at or
// past the age the fictional annuity documents its own heightened review.
const LICENSED_AGENT_FLAGS: readonly ReviewFlag[] = ["REPLACEMENT_CONTEXT", "AGE_65_PLUS"];

// Flags that keep the draft internal but raise the bar for who signs it off:
// values the carrier may change, an illustration the documents require, or a
// client asking for specific future figures.
const ENHANCED_REVIEW_FLAGS: readonly ReviewFlag[] = [
  "NON_GUARANTEED_ELEMENTS",
  "ILLUSTRATION_REQUIRED",
  "SPECIFIC_VALUE_REQUEST",
];

function present(reasons: readonly ReviewFlag[], wanted: readonly ReviewFlag[]): ReviewFlag[] {
  return wanted.filter((flag) => reasons.includes(flag));
}

export function computeWorkflowRouting(input: WorkflowRoutingInput): WorkflowRouting {
  // Fact layer first. If a core fact could not be reconciled with its source,
  // no internal draft is endorsed at all — only a checklist and next steps
  // (CLAUDE.md §4.4). This precedes every client-risk rule: there is nothing to
  // approve when the facts themselves are unverified.
  if (input.comparisonStatus === "blocked") {
    return {
      workflowDecision: "allow_checklist_only",
      requiredApprovalLevel: "blocked",
      routingReasons: [],
    };
  }

  const licensedAgent = present(input.reviewReasons, LICENSED_AGENT_FLAGS);
  if (licensedAgent.length > 0) {
    return {
      workflowDecision: "block_client_draft",
      requiredApprovalLevel: "licensed_agent_required",
      routingReasons: licensedAgent,
    };
  }

  const enhanced = present(input.reviewReasons, ENHANCED_REVIEW_FLAGS);
  if (enhanced.length > 0) {
    return {
      workflowDecision: "allow_internal_draft",
      requiredApprovalLevel: "enhanced_review",
      routingReasons: enhanced,
    };
  }

  // Every client-facing use still needs human approval before it leaves the
  // building (CLAUDE.md §4.4); the internal draft itself is fine.
  return {
    workflowDecision: "allow_internal_draft",
    requiredApprovalLevel: "standard_approval",
    routingReasons: present(input.reviewReasons, ["CLIENT_FACING_DRAFT"]),
  };
}
