import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../../lib/supabase/server.js";
import {
  deleteTestDocument as repoDeleteTestDocument,
  deleteTestRuns,
  documentRowCounts,
  getActiveDocument,
  assertTestDocumentId,
} from "../../lib/supabase/repository.js";
import { ingestDocument } from "../../lib/ingestion/ingest-document.js";
import { buildDocumentRecords } from "../../lib/ingestion/chunk-document.js";
import { testProduct, structuredPagesFor } from "../../lib/ingestion/test-fixture.js";
import { createFakeProvider } from "../../lib/embeddings/fake.js";
import type { EmbeddingProvider } from "../../lib/embeddings/provider.js";

// Fake-provider database integration for the full ingestion pipeline.
// All business ids are test_-prefixed and removed afterward.

const DOC = "test_doc_ingest_a";
const DOC_FAIL = "test_doc_ingest_fail";

let db: SupabaseClient;
const fake = createFakeProvider();

function fixture(documentId: string) {
  const product = testProduct({ documentId, fileName: `${documentId.replaceAll("_", "-")}.pdf` });
  const { pageRecords, chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
  return { product, pageRecords, chunkRecords };
}

async function cleanup(): Promise<void> {
  for (const id of [DOC, DOC_FAIL]) {
    await repoDeleteTestDocument(db, id);
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

describe("fake-provider ingestion integration", () => {
  it("ingests a test document with exact page/chunk counts and 1536-dim vectors", async () => {
    const { product, pageRecords, chunkRecords } = fixture(DOC);
    const result = await ingestDocument(db, product, pageRecords, chunkRecords, fake, "1".repeat(64));
    expect(result.status).toBe("completed");
    expect(result.pages).toBe(pageRecords.length);
    expect(result.chunks).toBe(chunkRecords.length);

    const counts = await documentRowCounts(db, DOC);
    expect(counts).toEqual({ documents: 1, pages: pageRecords.length, chunks: chunkRecords.length });

    const doc = await getActiveDocument(db, DOC);
    const { data: rows } = await db
      .from("chunks")
      .select("chunk_id, embedding, page_start, page_end, section, chunk_type, content_hash")
      .eq("document_id", doc!.id)
      .order("chunk_index");
    expect(rows).toHaveLength(chunkRecords.length);
    rows!.forEach((row, i) => {
      expect(row.chunk_id).toBe(chunkRecords[i]!.chunkId);
      expect(row.content_hash).toBe(chunkRecords[i]!.contentHash);
      expect(row.section).toBe(chunkRecords[i]!.section);
      expect(row.chunk_type).toBe(chunkRecords[i]!.chunkType);
      expect(row.page_start).toBe(chunkRecords[i]!.pageStart);
      expect(JSON.parse(row.embedding as unknown as string)).toHaveLength(1536);
    });

    const { data: run } = await db
      .from("ingestion_runs")
      .select("status, embedding_provider, embedding_model, embedding_dimensions")
      .eq("document_id", DOC)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();
    expect(run!.status).toBe("completed");
    expect(run!.embedding_provider).toBe("fake-deterministic");
    expect(run!.embedding_dimensions).toBe(1536);
  });

  it("skips an identical re-ingestion without changing row counts", async () => {
    const { product, pageRecords, chunkRecords } = fixture(DOC);
    const before = await documentRowCounts(db, DOC);
    const result = await ingestDocument(db, product, pageRecords, chunkRecords, fake, "1".repeat(64));
    expect(result.status).toBe("skipped");
    const after = await documentRowCounts(db, DOC);
    expect(after).toEqual(before);

    const { data: runs } = await db
      .from("ingestion_runs")
      .select("status")
      .eq("document_id", DOC);
    expect(runs!.some((r) => r.status === "skipped")).toBe(true);
  });

  it("fails pre-transaction validation without creating an active document", async () => {
    const { product, pageRecords, chunkRecords } = fixture(DOC_FAIL);
    const missingChunk = chunkRecords.slice(0, -1); // breaks the coverage partition
    const result = await ingestDocument(db, product, pageRecords, missingChunk, fake, "2".repeat(64));
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBeDefined();
    expect(await getActiveDocument(db, DOC_FAIL)).toBeNull();

    const { data: run } = await db
      .from("ingestion_runs")
      .select("status, error_code, error_message")
      .eq("document_id", DOC_FAIL)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();
    expect(run!.status).toBe("failed");
    expect(run!.error_code).toBeTruthy();
    expect(run!.error_message).toBeTruthy();
  });

  it("writes nothing when embedding dimensions are invalid", async () => {
    const { product, pageRecords, chunkRecords } = fixture(DOC_FAIL);
    const badProvider: EmbeddingProvider = {
      providerName: "fake-deterministic",
      modelName: "fake",
      dimensions: 1536,
      embedMany: async (inputs) => inputs.map(() => [0.1, 0.2]),
    };
    const result = await ingestDocument(db, product, pageRecords, chunkRecords, badProvider, "3".repeat(64));
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("EMBEDDING_DIMENSION_MISMATCH");
    expect(await getActiveDocument(db, DOC_FAIL)).toBeNull();
  });

  it("refuses the fake provider for non-test document ids", async () => {
    const { pageRecords, chunkRecords } = fixture(DOC);
    const realProduct = testProduct({ documentId: "doc_termplus20_v1" });
    await expect(
      ingestDocument(db, realProduct, pageRecords, chunkRecords, fake, "4".repeat(64)),
    ).rejects.toThrow(/FAKE_PROVIDER_FORBIDDEN/);
  });

  it("cleanup helpers delete only test_ records and refuse others", async () => {
    expect(() => assertTestDocumentId("doc_termplus20_v1")).toThrow(/refusing destructive/);
    await expect(repoDeleteTestDocument(db, "doc_indexflex_ul_v1")).rejects.toThrow(/refusing/);
    await repoDeleteTestDocument(db, DOC); // allowed
    expect(await getActiveDocument(db, DOC)).toBeNull();
  });
});
