import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductDefinition } from "../schemas.js";
import type { ChunkRecord, PageRecord } from "../ingestion/types.js";
import type { EmbeddingProvider } from "../embeddings/provider.js";

// Thin server-side wrapper around the ingestion tables and the atomic
// replacement RPC. Every error surfaces the Supabase message only — secret
// values never appear in Supabase error payloads or in ours.

export interface ActiveDocument {
  id: string;
  ingestion_fingerprint: string;
}

export async function getActiveDocument(
  db: SupabaseClient,
  documentId: string,
): Promise<ActiveDocument | null> {
  const { data, error } = await db
    .from("documents")
    .select("id, ingestion_fingerprint")
    .eq("document_id", documentId)
    .maybeSingle();
  if (error) throw new Error(`DB_READ_FAILED: ${error.message}`);
  return (data as ActiveDocument | null) ?? null;
}

export async function createRun(
  db: SupabaseClient,
  fields: {
    document_id: string;
    fingerprint: string;
    status: "running" | "skipped";
    source_sha256?: string;
    embedding_provider: string;
    embedding_model: string;
    embedding_dimensions: number;
  },
): Promise<string> {
  const { data, error } = await db.from("ingestion_runs").insert(fields).select("id").single();
  if (error) throw new Error(`DB_RUN_CREATE_FAILED: ${error.message}`);
  return (data as { id: string }).id;
}

export async function finishRun(
  db: SupabaseClient,
  runId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from("ingestion_runs").update(patch).eq("id", runId);
  if (error) throw new Error(`DB_RUN_UPDATE_FAILED: ${error.message}`);
}

export async function replaceDocument(
  db: SupabaseClient,
  product: ProductDefinition,
  pages: PageRecord[],
  chunks: ChunkRecord[],
  vectors: number[][],
  provider: EmbeddingProvider,
  fingerprint: string,
  sourceSha256: string,
): Promise<string> {
  const payload = {
    p_document: {
      document_id: product.documentId,
      document_name: product.documentName,
      document_type: product.documentType,
      product_name: product.productName,
      product_category: product.productCategory,
      carrier_id: product.carrier.id,
      carrier_name: product.carrier.legalName,
      jurisdiction: product.jurisdiction,
      language: product.language,
      effective_date: product.effectiveDate,
      source_file: product.fileName,
      source_sha256: sourceSha256,
      page_count: product.pages,
      is_current: product.isCurrent,
      is_fictional: product.isFictional,
      ingestion_fingerprint: fingerprint,
      embedding_provider: provider.providerName,
      embedding_model: provider.modelName,
      embedding_dimensions: provider.dimensions,
    },
    p_pages: pages.map((p) => ({
      page_number: p.page,
      raw_text: p.rawText,
      clean_text: p.cleanText,
      clean_text_hash: p.cleanTextHash,
      detected_heading: p.detectedHeading,
    })),
    p_chunks: chunks.map((c, i) => ({
      chunk_id: c.chunkId,
      page_start: c.pageStart,
      page_end: c.pageEnd,
      section: c.section,
      chunk_index: c.chunkIndex,
      chunk_type: c.chunkType,
      content: c.content,
      content_hash: c.contentHash,
      embedding: vectors[i],
      metadata: {},
    })),
  };
  const { data, error } = await db.rpc("ingest_replace_document", payload);
  if (error) throw new Error(`DB_REPLACE_FAILED: ${error.message}`);
  return data as string;
}

export interface DocumentRowCounts {
  documents: number;
  pages: number;
  chunks: number;
}

export async function documentRowCounts(
  db: SupabaseClient,
  documentId: string,
): Promise<DocumentRowCounts> {
  const doc = await getActiveDocument(db, documentId);
  if (!doc) return { documents: 0, pages: 0, chunks: 0 };
  const pages = await db
    .from("document_pages")
    .select("*", { count: "exact", head: true })
    .eq("document_id", doc.id);
  const chunks = await db
    .from("chunks")
    .select("*", { count: "exact", head: true })
    .eq("document_id", doc.id);
  if (pages.error || chunks.error) {
    throw new Error(`DB_READ_FAILED: ${(pages.error ?? chunks.error)!.message}`);
  }
  return { documents: 1, pages: pages.count ?? 0, chunks: chunks.count ?? 0 };
}

// Destructive cleanup for test data only — hard-fails on non-test_ ids.
export function assertTestDocumentId(documentId: string): void {
  if (!documentId.startsWith("test_")) {
    throw new Error(
      `refusing destructive operation on non-test document id "${documentId}" (must start with "test_")`,
    );
  }
}

export async function deleteTestDocument(db: SupabaseClient, documentId: string): Promise<void> {
  assertTestDocumentId(documentId);
  const { error } = await db.from("documents").delete().eq("document_id", documentId);
  if (error) throw new Error(`cleanup failed for ${documentId}: ${error.message}`);
}

export async function deleteTestRuns(db: SupabaseClient, documentId: string): Promise<void> {
  assertTestDocumentId(documentId);
  const { error } = await db.from("ingestion_runs").delete().eq("document_id", documentId);
  if (error) throw new Error(`run cleanup failed for ${documentId}: ${error.message}`);
}
