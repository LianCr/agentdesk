import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SyntheticCaseSchema, type SyntheticCase } from "../../lib/schemas";
import { buildClientRosterEntry } from "../../lib/comparison/client-roster";

// The /compare client roster. Everything here is derived from the committed
// fixtures; these tests guard the two ways it could start lying: leaking the
// evaluation ground truth onto the page, and showing an untranslated source
// string on a bilingual card.

const CASE_DIR = join(process.cwd(), "data/synthetic-cases");
const cases: SyntheticCase[] = readdirSync(CASE_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => SyntheticCaseSchema.parse(JSON.parse(readFileSync(join(CASE_DIR, f), "utf8"))));

const roster = cases.map(buildClientRosterEntry);
const byId = new Map(roster.map((entry) => [entry.caseId, entry]));

/** The ClientContext fields carrying an UNKNOWN sentinel — the only ones split. */
const PARTITIONABLE = [
  "age",
  "dependents",
  "budgetMonthly",
  "coverageHorizon",
  "existingCoverageNote",
  "riskTolerance",
  "tobaccoUse",
  "desiredCoverageAmount",
];
const DESCRIPTOR_KEYS = ["maritalStatus", "occupation", "status"];

describe("client roster", () => {
  it("covers exactly the three demo clients", () => {
    expect(roster.map((e) => e.caseId)).toEqual(["DEMO-2026-001", "DEMO-2026-002", "DEMO-2026-003"]);
    expect(roster.map((e) => e.displayName)).toEqual([
      "Demo Client A",
      "Demo Client B",
      "Demo Client C",
    ]);
  });

  it("marks replacement only where it was actually derived", () => {
    // Client B has employer group term coverage, which is coverage the client
    // HAS — not a contract being given up.
    expect(byId.get("DEMO-2026-001")!.replacementContext).toBe(false);
    expect(byId.get("DEMO-2026-002")!.replacementContext).toBe(false);
    expect(byId.get("DEMO-2026-003")!.replacementContext).toBe(true);
  });

  it("partitions the sentinel-bearing fields with no gaps and no overlap", () => {
    for (const entry of roster) {
      const stated = entry.stated.map((f) => f.key).filter((k) => !DESCRIPTOR_KEYS.includes(k));
      const gaps = entry.notStated.map((g) => g.key);
      expect(stated.filter((k) => gaps.includes(k)), entry.caseId).toEqual([]);
      expect([...stated, ...gaps].sort(), entry.caseId).toEqual([...PARTITIONABLE].sort());
    }
  });

  it("reports what each fixture leaves out", () => {
    const c = byId.get("DEMO-2026-003")!.notStated.map((g) => g.key);
    expect(c).toContain("dependents");
    expect(c).toContain("budgetMonthly");
    expect(c).toContain("riskTolerance");
    expect(byId.get("DEMO-2026-001")!.stated.map((f) => f.key)).toContain("budgetMonthly");
  });

  it("treats \"no existing coverage\" as a stated fact, not a blank", () => {
    // "The client has none" and "we do not know whether they have any" are
    // different answers, and the second is what a replacement review must chase.
    const a = byId.get("DEMO-2026-001")!;
    expect(a.notStated.map((g) => g.key)).not.toContain("existingCoverageNote");
    const field = a.stated.find((f) => f.key === "existingCoverageNote")!;
    expect(field.valueZh).toBe("无");
    expect(field.valueEn).toBe("None");
  });

  it("never carries the evaluation ground truth", () => {
    // riskTier and `expected` are frozen answers the runtime never reads.
    // Rendering them would imply the risk flags and workflow decision were
    // looked up rather than computed by lib/guardrails/rules.ts.
    const serialized = JSON.stringify(roster);
    for (const banned of [
      "riskTier",
      "expected",
      "requiredRiskFlags",
      "workflowDecision",
      "reviewStatus",
      "requiredChecklistItems",
      "allowedOutput",
      "nextAction",
      "age_65_plus",
      "block_client_draft",
      "licensed_agent_required",
    ]) {
      expect(serialized.includes(banned), `roster leaks "${banned}"`).toBe(false);
    }
    // And the tiers themselves, in case a future field carries them under
    // another name.
    for (const entry of roster) {
      const keys = Object.keys(entry as object);
      expect(keys, entry.caseId).not.toContain("riskTier");
      expect(keys, entry.caseId).not.toContain("expected");
    }
  });

  it("is bilingual in every label and every value", () => {
    for (const entry of roster) {
      for (const field of entry.stated) {
        for (const part of [field.labelZh, field.labelEn, field.valueZh, field.valueEn]) {
          expect(part.trim().length, `${entry.caseId}/${field.key}`).toBeGreaterThan(0);
        }
      }
      for (const gap of entry.notStated) {
        expect(gap.labelZh.trim().length, `${entry.caseId}/${gap.key}`).toBeGreaterThan(0);
        expect(gap.labelEn.trim().length, `${entry.caseId}/${gap.key}`).toBeGreaterThan(0);
      }
    }
  });

  it("never shows an untranslated source string on a Chinese card", () => {
    // Descriptor and risk-tolerance VALUES are English in the fixtures. Anything
    // without an approved bilingual pair must be absent, not passed through —
    // the only exception is free text explicitly marked as verbatim English.
    for (const [index, entry] of roster.entries()) {
      const raw = cases[index]!.client as Record<string, unknown>;
      for (const key of DESCRIPTOR_KEYS) {
        const value = raw[key];
        if (typeof value !== "string") continue;
        const rendered = entry.stated.find((f) => f.key === key);
        if (!rendered) continue; // omitted rather than guessed — allowed
        expect(rendered.valueZh, `${entry.caseId}/${key}`).not.toBe(value);
        expect(/^[\x20-\x7e]+$/.test(rendered.valueZh), `${entry.caseId}/${key} is ASCII`).toBe(false);
      }
      for (const field of entry.stated) {
        if (field.verbatimEnglish) continue;
        expect(/^[\x20-\x7e]+$/.test(field.valueZh), `${entry.caseId}/${field.key} untranslated`).toBe(
          false,
        );
      }
    }
  });

  it("keeps the client's own words in the client's own language", () => {
    expect(byId.get("DEMO-2026-001")!.clientQuestions).toEqual([]);
    expect(byId.get("DEMO-2026-002")!.clientQuestions).toHaveLength(2);
    expect(byId.get("DEMO-2026-003")!.clientQuestions[0]).toContain("年金利率太低");
  });
});
