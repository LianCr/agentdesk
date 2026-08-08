import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProductCatalogSchema, SyntheticCaseSchema, type SyntheticCase } from "../../lib/schemas";
import { DerivedChunksFileSchema, type ChunkRecord } from "../../lib/ingestion/types";
import { compareProducts } from "../../lib/comparison/compare";
import { computeWorkflowRouting } from "../../lib/guardrails/rules";
import { buildReviewChecklist } from "../../lib/reviews/checklist";
import { buildReviewSnapshot, hashReviewSnapshot } from "../../lib/reviews/snapshot";
import { buildSourceKey } from "../../lib/reviews/create-review";
import { canonicalJson } from "../../lib/reviews/types";

// M5-B offline tests: checklist, snapshot, canonical hashing and source keys.
// No database, no model.

const ROOT = process.cwd();
const catalog = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);
const chunksByDocumentId: Record<string, ChunkRecord[]> = Object.fromEntries(
  catalog.products.map((p) => [
    p.documentId,
    DerivedChunksFileSchema.parse(
      JSON.parse(readFileSync(join(ROOT, `data/derived/chunks/${p.documentId}.chunks.json`), "utf8")),
    ).chunks,
  ]),
);
const cases: Record<string, SyntheticCase> = Object.fromEntries(
  readdirSync(join(ROOT, "data/synthetic-cases"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const parsed = SyntheticCaseSchema.parse(
        JSON.parse(readFileSync(join(ROOT, "data/synthetic-cases", f), "utf8")),
      );
      return [parsed.caseId, parsed];
    }),
);

const TERM = "doc_termplus20_v1";
const IUL = "doc_indexflex_ul_v1";
const ANNUITY = "doc_securerate5_v1";
const product = (id: string) => catalog.products.find((p) => p.documentId === id)!;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Rebuilds an object graph with every object's keys in reverse order. */
function reorderKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reorderKeys) as unknown as T;
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).reverse();
  return Object.fromEntries(entries.map(([k, v]) => [k, reorderKeys(v)])) as T;
}

function build(a: string, b: string, caseId: string | null) {
  const draft = compareProducts({
    productA: product(a),
    productB: product(b),
    chunksByDocumentId,
    syntheticCase: caseId ? cases[caseId]! : null,
    comparisonIdFactory: () => "cmp_test",
    now: () => 0,
  });
  const routing = computeWorkflowRouting({
    reviewReasons: draft.reviewReasons,
    comparisonStatus: draft.comparisonStatus,
    client: draft.clientContext,
  });
  return {
    draft,
    routing,
    checklist: buildReviewChecklist({ draft, workflowDecision: routing.workflowDecision }),
    snapshot: buildReviewSnapshot(draft),
  };
}

describe("Case C replacement checklist (11-12)", () => {
  it("covers every item the Case C fixture requires", () => {
    const { checklist, routing } = build(ANNUITY, IUL, "DEMO-2026-003");
    expect(routing.workflowDecision).toBe("block_client_draft");

    const required = cases["DEMO-2026-003"]!.expected.requiredChecklistItems!;
    expect(required).toHaveLength(8);
    const keys = new Set(checklist.map((c) => c.key));
    for (const item of required) {
      expect(keys.has(item), `missing checklist item "${item}"`).toBe(true);
    }
    // Those eight come from the fixture, not from invented regulation.
    const fixtureItems = checklist.filter((c) => c.sourceKind === "fixture_checklist");
    expect(fixtureItems.map((c) => c.key).sort()).toEqual([...required].sort());
  });

  it("does not duplicate a replacement item as a client-info item", () => {
    const { checklist } = build(ANNUITY, IUL, "DEMO-2026-003");
    const keys = checklist.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    // The missing-info fields that restate a replacement item are folded away.
    expect(keys).not.toContain("currentSurrenderCharge");
    expect(keys).not.toContain("benefitsThatMayBeLost");
    expect(keys).toContain("current contract surrender charge");
  });

  it("every item carries bilingual labels and a declared source", () => {
    const { checklist } = build(ANNUITY, IUL, "DEMO-2026-003");
    for (const item of checklist) {
      expect(item.labelZh.length).toBeGreaterThan(0);
      expect(item.labelEn.length).toBeGreaterThan(0);
      expect(["fixture_checklist", "missing_client_info", "review_flag"]).toContain(item.sourceKind);
    }
  });
});

describe("ordinary checklists come only from what the engine established (12, 14)", () => {
  it("a non-replacement case lists its missing client information and nothing else", () => {
    const { checklist } = build(TERM, IUL, "DEMO-2026-001");
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist.every((c) => c.sourceKind === "missing_client_info")).toBe(true);
    expect(checklist.some((c) => c.key === "tobaccoUse")).toBe(true);
    // No replacement obligations invented for a client who is not replacing.
    expect(checklist.some((c) => c.key === "state replacement forms")).toBe(false);
  });

  it("no client means no client checklist at all", () => {
    const { checklist, draft } = build(TERM, IUL, null);
    expect(draft.clientContext).toBeNull();
    expect(checklist).toEqual([]);
  });
});

describe("canonical snapshot hashing (3-4, 6)", () => {
  it("key order does not change the hash", () => {
    const { snapshot } = build(TERM, IUL, "DEMO-2026-001");
    const reordered = reorderKeys(snapshot);
    // Different insertion order, same content.
    expect(Object.keys(reordered)).not.toEqual(Object.keys(snapshot));
    expect(reordered).toEqual(snapshot);
    expect(canonicalJson(reordered)).toBe(canonicalJson(snapshot));
    expect(hashReviewSnapshot(reordered)).toBe(hashReviewSnapshot(snapshot));
  });

  it("a changed factual value changes the hash", () => {
    const { snapshot } = build(TERM, IUL, "DEMO-2026-001");
    const tampered = clone(snapshot);
    tampered.dimensions[0]!.cells[0]!.displayValue = "Something else entirely";
    expect(hashReviewSnapshot(tampered)).not.toBe(hashReviewSnapshot(snapshot));
  });

  it("a changed citation page changes the hash", () => {
    const { snapshot } = build(TERM, IUL, "DEMO-2026-001");
    const tampered = clone(snapshot);
    const cell = tampered.dimensions.flatMap((r) => r.cells).find((c) => c.citations.length > 0)!;
    cell.citations[0]!.pageStart = 99;
    expect(hashReviewSnapshot(tampered)).not.toBe(hashReviewSnapshot(snapshot));
  });

  it("a different client changes the hash", () => {
    expect(hashReviewSnapshot(build(TERM, IUL, "DEMO-2026-001").snapshot)).not.toBe(
      hashReviewSnapshot(build(TERM, IUL, "DEMO-2026-002").snapshot),
    );
  });

  it("reversing the columns changes the hash, because the reviewed presentation differs", () => {
    expect(hashReviewSnapshot(build(TERM, IUL, null).snapshot)).not.toBe(
      hashReviewSnapshot(build(IUL, TERM, null).snapshot),
    );
  });

  it("the same comparison hashes identically across runs", () => {
    expect(hashReviewSnapshot(build(ANNUITY, IUL, "DEMO-2026-003").snapshot)).toBe(
      hashReviewSnapshot(build(ANNUITY, IUL, "DEMO-2026-003").snapshot),
    );
  });
});

describe("what the snapshot freezes (5, 16-17)", () => {
  it("keeps the facts, citations, provenance and observations a reviewer needs", () => {
    const { snapshot } = build(ANNUITY, IUL, "DEMO-2026-003");
    expect(snapshot.dimensions).toHaveLength(13);
    expect(snapshot.comparisonStatus).toBe("complete");
    expect(snapshot.observations.length).toBeGreaterThan(0);
    expect(snapshot.clientContext?.caseId).toBe("DEMO-2026-003");

    const cited = snapshot.dimensions.flatMap((r) => r.cells).filter((c) => c.citations.length > 0);
    expect(cited.length).toBeGreaterThan(0);
    for (const citation of cited[0]!.citations) {
      expect(citation.documentId).toBeTruthy();
      expect(citation.pageStart).toBeGreaterThan(0);
      expect(citation.quote.length).toBeGreaterThan(0);
    }
    // Derived provenance survives, so the reviewer can see which values were
    // computed from a table rather than quoted from prose.
    const derived = snapshot.dimensions
      .flatMap((r) => r.cells)
      .find((c) => c.sourceKind === "derived");
    expect(derived?.derivation?.ruleId).toBe("LAST_NONZERO_SURRENDER_CHARGE_YEAR");
  });

  it("excludes the optional narrative entirely", () => {
    const { snapshot } = build(TERM, IUL, null);
    expect(snapshot).not.toHaveProperty("narrativeSections");
    expect(snapshot).not.toHaveProperty("narrativeStatus");
    expect(canonicalJson(snapshot)).not.toContain("narrative");
  });

  it("excludes per-run values that are not properties of the artifact", () => {
    const { snapshot } = build(TERM, IUL, null);
    expect(snapshot.meta).toEqual({ comparisonEngineVersion: 1, factRegistryVersion: 1 });
    expect(snapshot.meta).not.toHaveProperty("latencyMs");
    expect(snapshot.meta).not.toHaveProperty("narrativeModel");
  });
});

describe("source keys identify open work, not artifacts (5-6)", () => {
  it("is deterministic for the same request", () => {
    const key = { productAId: TERM, productBId: IUL, clientCaseId: "DEMO-2026-001" };
    expect(buildSourceKey(key)).toBe(buildSourceKey(key));
  });

  it("normalizes product order, so reversing columns is not new work", () => {
    expect(buildSourceKey({ productAId: TERM, productBId: IUL, clientCaseId: null })).toBe(
      buildSourceKey({ productAId: IUL, productBId: TERM, clientCaseId: null }),
    );
  });

  it("separates clients, and separates a client from no client", () => {
    const a = buildSourceKey({ productAId: TERM, productBId: IUL, clientCaseId: "DEMO-2026-001" });
    const b = buildSourceKey({ productAId: TERM, productBId: IUL, clientCaseId: "DEMO-2026-002" });
    const none = buildSourceKey({ productAId: TERM, productBId: IUL, clientCaseId: null });
    expect(new Set([a, b, none]).size).toBe(3);
  });

  it("separates product pairs", () => {
    expect(buildSourceKey({ productAId: TERM, productBId: IUL, clientCaseId: null })).not.toBe(
      buildSourceKey({ productAId: TERM, productBId: ANNUITY, clientCaseId: null }),
    );
  });
});
