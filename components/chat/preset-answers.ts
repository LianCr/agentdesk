import demoAnswers from "../../data/demo-answers.json";
import type { GroundedAnswer } from "./types";

// Pre-verified answers for the fixed preset questions.
//
// A live grounded answer takes 15-20 seconds, which is honest but makes the
// preset chips a poor first impression. These five answers came from real
// /api/answer runs and were checked citation by citation against the committed
// chunks -- quote present in the chunk, page inside the chunk's range,
// sourceUrl matching the manifest -- so they are the same answers the pipeline
// produces, not a hand-written approximation.
//
// EXACT MATCH ONLY, and deliberately so. This is a presentation shortcut for
// five known strings, not a cache: there is no similarity, no embedding, no
// TTL and no invalidation. Change one character of a preset and the live
// pipeline runs, which is the behaviour that keeps the demo honest -- an
// interviewer who rewords a question is testing the real system, and they
// should get the real system.

const ANSWERS = (demoAnswers as { answers: Record<string, GroundedAnswer> }).answers;

/** The saved answer for this exact question, or null to run the live path. */
export function lookupPresetAnswer(query: string): GroundedAnswer | null {
  return ANSWERS[query.trim()] ?? null;
}

export const PRESET_ANSWER_COUNT = Object.keys(ANSWERS).length;
