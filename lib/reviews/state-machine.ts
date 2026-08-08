import { TERMINAL_REVIEW_STATES, type ReviewState } from "./types";

// The smallest state machine that tells the truth about this workflow.
//
// Only a pending item can be decided, and a decision is final in v1. There is
// no reopen and no `superseded` because there is no regeneration flow for them
// to describe — an empty state is worse than no state.

export const LEGAL_TRANSITIONS: Readonly<Record<ReviewState, readonly ReviewState[]>> = {
  pending_review: ["approved", "rejected", "revision_requested"],
  approved: [],
  rejected: [],
  revision_requested: [],
};

export type TransitionErrorCode =
  | "REVIEW_ALREADY_DECIDED"
  | "REVIEW_TRANSITION_INVALID";

export type TransitionCheck =
  | { ok: true }
  | { ok: false; code: TransitionErrorCode; message: string };

export function isTerminalReviewState(state: ReviewState): boolean {
  return TERMINAL_REVIEW_STATES.includes(state);
}

/**
 * Deterministic guard. Distinguishes "this item is already finished" from
 * "that is not a transition at all", because a reviewer whose colleague just
 * approved the item needs a different message from one who sent a malformed
 * request.
 */
export function checkTransition(from: ReviewState, to: ReviewState): TransitionCheck {
  if (isTerminalReviewState(from)) {
    return {
      ok: false,
      code: "REVIEW_ALREADY_DECIDED",
      message: `review is already ${from} and cannot move to ${to}`,
    };
  }
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      code: "REVIEW_TRANSITION_INVALID",
      message: `${from} -> ${to} is not a legal transition`,
    };
  }
  return { ok: true };
}

export function assertTransition(from: ReviewState, to: ReviewState): void {
  const check = checkTransition(from, to);
  if (!check.ok) throw new Error(`${check.code}: ${check.message}`);
}
