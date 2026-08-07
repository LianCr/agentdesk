import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../../lib/supabase/server";
import {
  deleteTestDocument,
  deleteTestRuns,
  documentRowCounts,
  getActiveDocument,
} from "../../lib/supabase/repository";
import { ingestDocument } from "../../lib/ingestion/ingest-document";
import { buildDocumentRecords } from "../../lib/ingestion/chunk-document";
import { testProduct, structuredPagesFor } from "../../lib/ingestion/test-fixture";
import { createFakeProvider } from "../../lib/embeddings/fake";
import { DEFAULT_FINGERPRINT_VERSIONS } from "../../lib/ingestion/fingerprint";
import type { EmbeddingProvider } from "../../lib/embeddings/provider";

// Gate D resilience: fingerprint-driven rebuilds (via injected versions —
// committed constants are never edited), failed refreshes preserving the old
// active version, and concurrent same-document ingestion.

const DOC = "test_doc_resilience";

let db: SupabaseClient;
const fake = createFakeProvider();

function fixture() {
  const product = testProduct({ documentId: DOC, fileName: "test-doc-resilience.pdf" });
  const { pageRecords, chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
  return { product, pageRecords, chunkRecords };
}

async function activeState() {
  const doc = await getActiveDocument(db, DOC);
  const counts = await documentRowCounts(db, DOC);
  const { data: chunks } = await db
    .from("chunks")
    .select("chunk_id, content_hash")
    .eq("document_id", doc?.id ?? "00000000-0000-4000-8000-000000000000")
    .order("chunk_index");
  return { fingerprint: doc?.ingestion_fingerprint, counts, chunks: chunks ?? [] };
}

async function cleanup(): Promise<void> {
  await deleteTestDocument(db, DOC);
  await deleteTestRuns(db, DOC);
}

beforeAll(async () => {
  db = createServiceClient();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("fingerprint-change rebuild", () => {
  it("skips identical versions, rebuilds on chunking-version change without duplicates", async () => {
    const { product, pageRecords, chunkRecords } = fixture();
    const v1 = await ingestDocument(db, product, pageRecords, chunkRecords, fake, "7".repeat(64));
    expect(v1.status).toBe("completed");
    const before = await activeState();

    const sameAgain = await ingestDocument(db, product, pageRecords, chunkRecords, fake, "7".repeat(64));
    expect(sameAgain.status).toBe("skipped");

    const bumped = { ...DEFAULT_FINGERPRINT_VERSIONS, chunking: DEFAULT_FINGERPRINT_VERSIONS.chunking + 1 };
    const rebuilt = await ingestDocument(
      db, product, pageRecords, chunkRecords, fake, "7".repeat(64), bumped,
    );
    expect(rebuilt.status).toBe("completed");

    const after = await activeState();
    expect(after.counts).toEqual(before.counts); // one document row, exact counts
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(after.chunks.map((c) => c.chunk_id)).toEqual(before.chunks.map((c) => c.chunk_id));

    const { data: runs } = await db
      .from("ingestion_runs").select("status").eq("document_id", DOC)
      .order("started_at", { ascending: false }).limit(1);
    expect(runs![0]!.status).toBe("completed");
  });

  it("rebuilds when embedding model metadata changes; byte-sha changes alone are skipped", async () => {
    const { product, pageRecords, chunkRecords } = fixture();
    const before = await activeState();

    // Different source sha, identical clean text -> semantic fingerprint
    // unchanged -> skip. (The stored fingerprint is from the bumped-version
    // run above, so reuse those versions.)
    const bumped = { ...DEFAULT_FINGERPRINT_VERSIONS, chunking: DEFAULT_FINGERPRINT_VERSIONS.chunking + 1 };
    const byteChange = await ingestDocument(
      db, product, pageRecords, chunkRecords, fake, "8".repeat(64), bumped,
    );
    expect(byteChange.status).toBe("skipped");

    const modelChanged: EmbeddingProvider = { ...fake, modelName: "fake-v2" };
    const rebuilt = await ingestDocument(
      db, product, pageRecords, chunkRecords, modelChanged, "8".repeat(64), bumped,
    );
    expect(rebuilt.status).toBe("completed");
    const after = await activeState();
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(after.counts).toEqual(before.counts);
  });
});

describe("failed refresh preserves the active version", () => {
  it("invalid dimensions, provider failure and RPC rejection all leave old data intact", async () => {
    const { product, pageRecords, chunkRecords } = fixture();
    // Reset to a clean known-good state with default versions.
    await cleanup();
    await ingestDocument(db, product, pageRecords, chunkRecords, fake, "9".repeat(64));
    const before = await activeState();
    expect(before.counts.documents).toBe(1);

    const bumped = { ...DEFAULT_FINGERPRINT_VERSIONS, chunkSchema: 99 }; // force non-skip

    // 1. Invalid embedding dimensions.
    const badDims: EmbeddingProvider = {
      ...fake,
      embedMany: async (inputs) => inputs.map(() => [1, 2, 3]),
    };
    const r1 = await ingestDocument(db, product, pageRecords, chunkRecords, badDims, "9".repeat(64), bumped);
    expect(r1.status).toBe("failed");
    expect(r1.errorCode).toBe("EMBEDDING_DIMENSION_MISMATCH");

    // 2. Provider failure.
    const exploding: EmbeddingProvider = {
      ...fake,
      embedMany: async () => {
        throw new Error("EMBEDDING_PROVIDER_UNAVAILABLE: simulated outage");
      },
    };
    const r2 = await ingestDocument(db, product, pageRecords, chunkRecords, exploding, "9".repeat(64), bumped);
    expect(r2.status).toBe("failed");
    expect(r2.errorCode).toBe("EMBEDDING_PROVIDER_UNAVAILABLE");

    // 3. RPC/database rejection: duplicate chunk_index violates a unique
    // constraint inside the transaction and rolls the whole call back.
    const dupIndex = chunkRecords.map((c, i) => (i === 1 ? { ...c, chunkIndex: 0 } : c));
    const r3 = await ingestDocument(db, product, pageRecords, dupIndex, fake, "9".repeat(64), bumped);
    expect(r3.status).toBe("failed");
    expect(r3.errorCode).toBe("DB_REPLACE_FAILED");

    // Old active version is untouched in every scenario.
    const after = await activeState();
    expect(after.fingerprint).toBe(before.fingerprint);
    expect(after.counts).toEqual(before.counts);
    expect(after.chunks).toEqual(before.chunks); // no mixed old/new chunk sets

    // Failed runs carry sanitized error fields, free of secrets.
    if (existsSync(".env")) process.loadEnvFile(".env");
    const { data: failedRuns } = await db
      .from("ingestion_runs")
      .select("error_code, error_message")
      .eq("document_id", DOC)
      .eq("status", "failed");
    expect(failedRuns!.length).toBeGreaterThanOrEqual(3);
    for (const run of failedRuns!) {
      expect(run.error_code).toBeTruthy();
      expect(run.error_message).toBeTruthy();
      for (const secret of [process.env.SUPABASE_SECRET_KEY, process.env.OPENAI_API_KEY]) {
        if (secret) expect(run.error_message).not.toContain(secret);
      }
    }
  });
});

describe("concurrent same-document ingestion", () => {
  it("resolves to one consistent version via the in-transaction fingerprint recheck", async () => {
    await cleanup();
    const { product, pageRecords, chunkRecords } = fixture();

    const [a, b] = await Promise.all([
      ingestDocument(db, product, pageRecords, chunkRecords, fake, "a1".repeat(32)),
      ingestDocument(db, product, pageRecords, chunkRecords, fake, "a1".repeat(32)),
    ]);

    // Both callers prepare embeddings before the transaction; the advisory
    // lock serializes the RPC and the in-transaction recheck turns the
    // second replacement into a skip.
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["completed", "skipped"]);

    const counts = await documentRowCounts(db, DOC);
    expect(counts.documents).toBe(1);
    expect(counts.pages).toBe(pageRecords.length);
    expect(counts.chunks).toBe(chunkRecords.length);

    const doc = await getActiveDocument(db, DOC);
    const { data: chunks } = await db
      .from("chunks").select("chunk_id").eq("document_id", doc!.id).order("chunk_index");
    expect(chunks!.map((c) => c.chunk_id)).toEqual(chunkRecords.map((c) => c.chunkId)); // no mixed set

    const { data: runs } = await db
      .from("ingestion_runs").select("status").eq("document_id", DOC);
    const byStatus = runs!.map((r) => r.status).sort();
    expect(byStatus).toEqual(["completed", "skipped"]);
  });
});
