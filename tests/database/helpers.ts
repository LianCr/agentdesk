import type { SupabaseClient } from "@supabase/supabase-js";

// Integration tests operate exclusively on test_-prefixed business document
// ids. Every destructive helper hard-fails on anything else so a bug in a
// test can never touch real ingested data.

export const TEST_PREFIX = "test_";

export function assertTestDocumentId(documentId: string): void {
  if (!documentId.startsWith(TEST_PREFIX)) {
    throw new Error(
      `refusing destructive operation on non-test document id "${documentId}" ` +
        `(must start with "${TEST_PREFIX}")`,
    );
  }
}

export async function deleteTestDocument(client: SupabaseClient, documentId: string): Promise<void> {
  assertTestDocumentId(documentId);
  const { error } = await client.from("documents").delete().eq("document_id", documentId);
  if (error) throw new Error(`cleanup failed for ${documentId}: ${error.message}`);
}

export async function deleteTestRuns(client: SupabaseClient, documentId: string): Promise<void> {
  assertTestDocumentId(documentId);
  const { error } = await client.from("ingestion_runs").delete().eq("document_id", documentId);
  if (error) throw new Error(`run cleanup failed for ${documentId}: ${error.message}`);
}

export function validDocumentRow(documentId: string): Record<string, unknown> {
  assertTestDocumentId(documentId);
  return {
    document_id: documentId,
    document_name: "Test Document Guide",
    document_type: "product_brochure",
    product_name: "Test Product",
    product_category: "term_life",
    carrier_id: "test_carrier",
    carrier_name: "Test Carrier Company",
    jurisdiction: "California",
    language: "en",
    effective_date: "2026-01-01",
    source_file: "test.pdf",
    source_sha256: "a".repeat(64),
    page_count: 2,
    is_current: true,
    is_fictional: true,
    ingestion_fingerprint: "f".repeat(64),
    embedding_provider: "fake-deterministic",
    embedding_model: "none",
    embedding_dimensions: 1536,
  };
}

export function validChunkRow(
  documentUuid: string,
  chunkId: string,
  chunkIndex: number,
): Record<string, unknown> {
  return {
    chunk_id: chunkId,
    document_id: documentUuid,
    page_start: 1,
    page_end: 1,
    section: "Test Section",
    chunk_index: chunkIndex,
    chunk_type: "text",
    content: "Test chunk content for schema validation.",
    content_hash: "b".repeat(64),
    embedding: Array.from({ length: 1536 }, () => 0),
    metadata: {},
  };
}
