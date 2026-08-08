import { describe, expect, it } from "vitest";
import {
  assertTransition,
  checkTransition,
  isTerminalReviewState,
  LEGAL_TRANSITIONS,
} from "../../lib/reviews/state-machine";
import {
  ReviewDecisionSchema,
  REVIEW_STATES,
  decisionEventType,
  decisionTargetState,
  type ReviewState,
} from "../../lib/reviews/types";

// M5-A state-machine and decision-contract tests (matrix items 7-13).

describe("only a pending review can be decided (7-10)", () => {
  it("pending_review accepts exactly the three decisions", () => {
    expect(LEGAL_TRANSITIONS.pending_review).toEqual(["approved", "rejected", "revision_requested"]);
    for (const target of ["approved", "rejected", "revision_requested"] as ReviewState[]) {
      expect(checkTransition("pending_review", target).ok).toBe(true);
    }
  });

  it.each(["approved", "rejected", "revision_requested"] as ReviewState[])(
    "%s is terminal and refuses every further transition",
    (terminal) => {
      expect(isTerminalReviewState(terminal)).toBe(true);
      expect(LEGAL_TRANSITIONS[terminal]).toEqual([]);
      for (const target of REVIEW_STATES) {
        const check = checkTransition(terminal, target);
        expect(check.ok).toBe(false);
        if (!check.ok) expect(check.code).toBe("REVIEW_ALREADY_DECIDED");
      }
    },
  );

  it("distinguishes an already-decided item from a nonsensical transition", () => {
    const decided = checkTransition("approved", "rejected");
    expect(decided.ok).toBe(false);
    if (!decided.ok) expect(decided.code).toBe("REVIEW_ALREADY_DECIDED");

    const nonsense = checkTransition("pending_review", "pending_review");
    expect(nonsense.ok).toBe(false);
    if (!nonsense.ok) expect(nonsense.code).toBe("REVIEW_TRANSITION_INVALID");
  });

  it("assertTransition throws a prefixed code", () => {
    expect(() => assertTransition("approved", "rejected")).toThrow(/^REVIEW_ALREADY_DECIDED:/);
    expect(() => assertTransition("pending_review", "pending_review")).toThrow(
      /^REVIEW_TRANSITION_INVALID:/,
    );
    expect(() => assertTransition("pending_review", "approved")).not.toThrow();
  });

  it("has no reopen or superseded state", () => {
    expect(REVIEW_STATES).toEqual(["pending_review", "approved", "rejected", "revision_requested"]);
    expect(REVIEW_STATES).not.toContain("superseded");
    expect(REVIEW_STATES).not.toContain("reopened");
  });
});

describe("decision contracts demand a written reason where it matters (11-13)", () => {
  it("approve may carry a note but does not require one", () => {
    expect(ReviewDecisionSchema.safeParse({ type: "approve" }).success).toBe(true);
    expect(ReviewDecisionSchema.safeParse({ type: "approve", note: "Looks right." }).success).toBe(true);
  });

  it("reject requires a non-empty reason", () => {
    expect(ReviewDecisionSchema.safeParse({ type: "reject" }).success).toBe(false);
    expect(ReviewDecisionSchema.safeParse({ type: "reject", reason: "" }).success).toBe(false);
    expect(ReviewDecisionSchema.safeParse({ type: "reject", reason: "   " }).success).toBe(true); // trimmed server-side
    expect(
      ReviewDecisionSchema.safeParse({ type: "reject", reason: "Cites the wrong page." }).success,
    ).toBe(true);
  });

  it("request_revision requires non-empty instructions", () => {
    expect(ReviewDecisionSchema.safeParse({ type: "request_revision" }).success).toBe(false);
    expect(ReviewDecisionSchema.safeParse({ type: "request_revision", instructions: "" }).success).toBe(false);
    expect(
      ReviewDecisionSchema.safeParse({
        type: "request_revision",
        instructions: "Confirm the current surrender charge before client-facing use.",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown fields — a decision is not a free-form patch", () => {
    expect(
      ReviewDecisionSchema.safeParse({ type: "approve", reviewState: "approved" }).success,
    ).toBe(false);
    expect(
      ReviewDecisionSchema.safeParse({ type: "approve", snapshot: {} }).success,
    ).toBe(false);
  });

  it("maps each decision to exactly one target state and one event type", () => {
    expect(decisionTargetState({ type: "approve" })).toBe("approved");
    expect(decisionTargetState({ type: "reject", reason: "x" })).toBe("rejected");
    expect(decisionTargetState({ type: "request_revision", instructions: "x" })).toBe("revision_requested");

    expect(decisionEventType({ type: "approve" })).toBe("APPROVED");
    expect(decisionEventType({ type: "reject", reason: "x" })).toBe("REJECTED");
    expect(decisionEventType({ type: "request_revision", instructions: "x" })).toBe("REVISION_REQUESTED");
  });

  it("every decision target is a legal transition from pending_review", () => {
    for (const decision of [
      { type: "approve" as const },
      { type: "reject" as const, reason: "x" },
      { type: "request_revision" as const, instructions: "x" },
    ]) {
      expect(checkTransition("pending_review", decisionTargetState(decision)).ok).toBe(true);
    }
  });
});
