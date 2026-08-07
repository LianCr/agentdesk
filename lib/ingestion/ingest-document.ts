import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductDefinition } from "../schemas.js";
import type { EmbeddingProvider } from "../embeddings/provider.js";
import { validateEmbeddings } from "../embeddings/provider.js";
import { FAKE_PROVIDER_NAME } from "../embeddings/fake.js";
import {
  createRun,
  finishRun,
  getActiveDocument,
  replaceDocument,
} from "../supabase/repository.js";
import { fingerprintFor, type FingerprintVersions } from "./fingerprint.js";
import { computeCoverage, assertFullCoverage } from "./coverage.js";
import { PageRecordSchema, ChunkRecordSchema, type ChunkRecord, type PageRecord } from "./types.js";

// One document through the transactional ingestion flow:
//   fingerprint -> skip | (running run -> validate -> embed -> validate
//   vectors -> single atomic RPC -> run completed).
// Everything expensive happens outside the database transaction; a failure
// at any point leaves the previous active version untouched.

export interface IngestResult {
  documentId: string;
  status: "completed" | "skipped" | "failed";
  pages: number;
  chunks: number;
  vectors: number;
  errorCode?: string;
  errorMessage?: string;
}

function errorCodeOf(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/^([A-Z][A-Z0-9_]+):/);
  return { code: match?.[1] ?? "INGEST_FAILED", message: message.slice(0, 500) };
}

export async function ingestDocument(
  db: SupabaseClient,
  product: ProductDefinition,
  pages: PageRecord[],
  chunks: ChunkRecord[],
  provider: EmbeddingProvider,
  sourceSha256: string,
  // Test-only injection point for fingerprint version bumps; production
  // callers omit it and get the committed constants.
  versions?: FingerprintVersions,
): Promise<IngestResult> {
  const documentId = product.documentId;

  // The fake provider must never write real documents.
  if (provider.providerName === FAKE_PROVIDER_NAME && !documentId.startsWith("test_")) {
    throw new Error(
      `FAKE_PROVIDER_FORBIDDEN: refusing to ingest non-test document "${documentId}" with the fake provider`,
    );
  }

  const fingerprint = fingerprintFor(product, pages, provider, versions);
  const active = await getActiveDocument(db, documentId);

  if (active && active.ingestion_fingerprint === fingerprint) {
    await createRun(db, {
      document_id: documentId,
      fingerprint,
      status: "skipped",
      source_sha256: sourceSha256,
      embedding_provider: provider.providerName,
      embedding_model: provider.modelName,
      embedding_dimensions: provider.dimensions,
    });
    return { documentId, status: "skipped", pages: 0, chunks: 0, vectors: 0 };
  }

  const runId = await createRun(db, {
    document_id: documentId,
    fingerprint,
    status: "running",
    source_sha256: sourceSha256,
    embedding_provider: provider.providerName,
    embedding_model: provider.modelName,
    embedding_dimensions: provider.dimensions,
  });

  try {
    // Validate records before spending on embeddings or touching the DB.
    for (const p of pages) PageRecordSchema.parse(p);
    for (const c of chunks) ChunkRecordSchema.parse(c);
    if (pages.length !== product.pages) {
      throw new Error(`INGEST_PAGE_COUNT_MISMATCH: ${pages.length} pages != declared ${product.pages}`);
    }
    for (const c of chunks) {
      if (c.documentId !== documentId) {
        throw new Error(`INGEST_CROSS_DOCUMENT: chunk ${c.chunkId} belongs to ${c.documentId}`);
      }
    }
    assertFullCoverage(computeCoverage(documentId, pages, chunks));

    const vectors = await provider.embedMany(chunks.map((c) => c.content));
    validateEmbeddings(provider, chunks.length, vectors);

    const replaced = await replaceDocument(
      db, product, pages, chunks, vectors, provider, fingerprint, sourceSha256,
    );

    if (replaced.action === "skipped") {
      // A concurrent caller installed the same fingerprint first; the RPC's
      // in-transaction recheck made this call a no-op.
      await finishRun(db, runId, { status: "skipped", completed_at: new Date().toISOString() });
      return { documentId, status: "skipped", pages: 0, chunks: 0, vectors: 0 };
    }

    await finishRun(db, runId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      pages_extracted: pages.length,
      chunks_created: chunks.length,
    });
    return {
      documentId,
      status: "completed",
      pages: pages.length,
      chunks: chunks.length,
      vectors: vectors.length,
    };
  } catch (err) {
    const { code, message } = errorCodeOf(err);
    try {
      await finishRun(db, runId, {
        status: "failed",
        failed_at: new Date().toISOString(),
        error_code: code,
        error_message: message,
      });
    } catch {
      // The document table remains the source of truth; validate:ingestion
      // reconciles stale runs.
    }
    return { documentId, status: "failed", pages: 0, chunks: 0, vectors: 0, errorCode: code, errorMessage: message };
  }
}
