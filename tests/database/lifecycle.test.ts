import { execSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../../lib/supabase/server.js";
import {
  deleteTestDocument,
  deleteTestRuns,
  documentRowCounts,
  getActiveDocument,
  detectStaleRuns,
} from "../../lib/supabase/repository.js";
import { ingestDocument } from "../../lib/ingestion/ingest-document.js";
import { buildDocumentRecords } from "../../lib/ingestion/chunk-document.js";
import { testProduct, structuredPagesFor } from "../../lib/ingestion/test-fixture.js";
import { createFakeProvider } from "../../lib/embeddings/fake.js";

// Gate D lifecycle: delete -> re-ingest, delete CLI safety, stale-run
// detection. test_ documents only; the three approved demo documents are
// never targeted.

const ROOT = join(import.meta.dirname, "../..");
const DOC = "test_doc_lifecycle";
const STALE_DOC = "test_doc_stale";

let db: SupabaseClient;
const fake = createFakeProvider();

function fixture(documentId: string) {
  const product = testProduct({ documentId, fileName: `${documentId.replaceAll("_", "-")}.pdf` });
  const { pageRecords, chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
  return { product, pageRecords, chunkRecords };
}

async function cleanup(): Promise<void> {
  for (const id of [DOC, STALE_DOC]) {
    await deleteTestDocument(db, id);
    await deleteTestRuns(db, id);
  }
}

beforeAll(async () => {
  db = createServiceClient();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("delete -> re-ingest lifecycle", () => {
  it("delete cascades pages/chunks, keeps history, and re-ingestion restores counts", async () => {
    const { product, pageRecords, chunkRecords } = fixture(DOC);
    const first = await ingestDocument(db, product, pageRecords, chunkRecords, fake, "5".repeat(64));
    expect(first.status).toBe("completed");
    const original = await documentRowCounts(db, DOC);
    expect(original.documents).toBe(1);
    expect(original.pages).toBe(pageRecords.length);
    expect(original.chunks).toBe(chunkRecords.length);
    const uuidBefore = (await getActiveDocument(db, DOC))!.id;

    await deleteTestDocument(db, DOC);
    expect(await getActiveDocument(db, DOC)).toBeNull();
    const pagesLeft = await db
      .from("document_pages").select("*", { count: "exact", head: true }).eq("document_id", uuidBefore);
    const chunksLeft = await db
      .from("chunks").select("*", { count: "exact", head: true }).eq("document_id", uuidBefore);
    expect(pagesLeft.count).toBe(0);
    expect(chunksLeft.count).toBe(0);

    const { data: runs } = await db.from("ingestion_runs").select("status").eq("document_id", DOC);
    expect(runs!.length).toBeGreaterThan(0); // history survives deletion

    const again = await ingestDocument(db, product, pageRecords, chunkRecords, fake, "5".repeat(64));
    expect(again.status).toBe("completed"); // no active row -> rebuild despite same fingerprint
    expect(await documentRowCounts(db, DOC)).toEqual(original);
  });
});

describe("delete CLI", () => {
  const run = (args: string): { status: number; out: string } => {
    try {
      const out = execSync(`npx tsx scripts/delete-document.ts ${args} 2>&1`, { cwd: ROOT });
      return { status: 0, out: out.toString() };
    } catch (err) {
      const e = err as { status: number; stdout: Buffer };
      return { status: e.status, out: e.stdout?.toString() ?? "" };
    }
  };

  it("rejects a missing document id", () => {
    const r = run("");
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/Usage/);
  });

  it("refuses non-test document ids", () => {
    const r = run("--document-id=doc_termplus20_v1");
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/refusing to delete non-test/);
  });

  it("treats a missing test document as an idempotent no-op", () => {
    const r = run("--document-id=test_doc_never_existed");
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/idempotent no-op/);
  });

  it("deletes an existing test document and reports cascade counts", async () => {
    const { product, pageRecords, chunkRecords } = fixture(DOC);
    await ingestDocument(db, product, pageRecords, chunkRecords, fake, "5".repeat(64));
    const r = run(`--document-id=${DOC}`);
    expect(r.status).toBe(0);
    expect(r.out).toContain(`target document: ${DOC}`);
    expect(r.out).toMatch(/deleted: 1 document/);
    expect(r.out).toMatch(/history retained/);
    expect(await getActiveDocument(db, DOC)).toBeNull();
  });
});

describe("stale running-run detection", () => {
  it("detects an old running run, which does not block a successful retry", async () => {
    const staleStart = new Date(Date.now() - 45 * 60_000).toISOString();
    const { error } = await db.from("ingestion_runs").insert({
      document_id: STALE_DOC,
      fingerprint: "a".repeat(64),
      status: "running",
      started_at: staleStart,
      embedding_provider: "fake-deterministic",
      embedding_model: "fake",
      embedding_dimensions: 1536,
    });
    expect(error).toBeNull();

    const stale = await detectStaleRuns(db, 30);
    const mine = stale.find((r) => r.document_id === STALE_DOC);
    expect(mine).toBeDefined();
    expect(mine!.ageMinutes).toBeGreaterThanOrEqual(44);
    expect(mine!.id).toBeTruthy();

    // Fresh runs are not reported.
    expect((await detectStaleRuns(db, 60)).find((r) => r.document_id === STALE_DOC)).toBeUndefined();

    // The stale run does not block a new ingestion of the same document.
    const { product, pageRecords, chunkRecords } = fixture(STALE_DOC);
    const retry = await ingestDocument(db, product, pageRecords, chunkRecords, fake, "6".repeat(64));
    expect(retry.status).toBe("completed");
    expect((await documentRowCounts(db, STALE_DOC)).documents).toBe(1);

    // Detection is report-only: the stale audit row is still there.
    const { data: runs } = await db
      .from("ingestion_runs")
      .select("status")
      .eq("document_id", STALE_DOC);
    expect(runs!.filter((r) => r.status === "running")).toHaveLength(1);
  });
});
