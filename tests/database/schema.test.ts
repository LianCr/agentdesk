import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, supabaseUrl } from "../../lib/supabase/server.js";
import {
  assertTestDocumentId,
  deleteTestDocument,
  deleteTestRuns,
  validChunkRow,
  validDocumentRow,
} from "./helpers.js";

// Gate B schema tests. All rows use test_-prefixed business document ids and
// are cleaned up afterward. No product data is ingested here.

const ROOT = join(import.meta.dirname, "../..");
const DOC_A = "test_doc_schema_a";
const DOC_B = "test_doc_schema_b";
const RPC_DOC = "test_doc_rpc";

let db: SupabaseClient;

async function cleanupAll(): Promise<void> {
  for (const id of [DOC_A, DOC_B, RPC_DOC]) {
    await deleteTestDocument(db, id);
    await deleteTestRuns(db, id);
  }
}

beforeAll(async () => {
  db = createServiceClient();
  await cleanupAll();
});

afterAll(async () => {
  await cleanupAll();
});

async function insertDocument(id: string): Promise<string> {
  const { data, error } = await db.from("documents").insert(validDocumentRow(id)).select("id").single();
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

describe("schema diagnostics (migrations applied)", () => {
  it("vector extension enabled, four tables present, RLS on, vector(1536)", async () => {
    const { data, error } = await db.rpc("schema_diagnostics");
    expect(error).toBeNull();
    const diag = data as {
      rls: Record<string, boolean>;
      vector_extension: boolean;
      chunk_embedding_dimensions: number;
    };
    expect(diag.vector_extension).toBe(true);
    for (const t of ["documents", "document_pages", "chunks", "ingestion_runs"]) {
      expect(diag.rls, `table ${t} missing`).toHaveProperty(t);
      expect(diag.rls[t], `RLS disabled on ${t}`).toBe(true);
    }
    expect(diag.chunk_embedding_dimensions).toBe(1536);
  });

  it("no prohibited business tables exist", async () => {
    const { data } = await db.rpc("schema_diagnostics");
    const tables = Object.keys((data as { rls: Record<string, boolean> }).rls);
    for (const banned of [
      "users", "cases", "comparisons", "reviews", "followup_tasks",
      "audit_log", "chat_messages", "conversations",
    ]) {
      expect(tables).not.toContain(banned);
    }
    const { error } = await db.from("users").select("*").limit(1);
    expect(error).not.toBeNull();
  });
});

describe("constraints", () => {
  it("rejects invalid product_category, sha256 and page_count", async () => {
    for (const patch of [
      { product_category: "crypto_fund" },
      { source_sha256: "not-a-sha" },
      { page_count: 0 },
    ]) {
      const { error } = await db.from("documents").insert({ ...validDocumentRow(DOC_A), ...patch });
      expect(error, `expected rejection for ${JSON.stringify(patch)}`).not.toBeNull();
    }
  });

  it("enforces unique business document ids", async () => {
    await insertDocument(DOC_A);
    const { error } = await db.from("documents").insert(validDocumentRow(DOC_A));
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505");
    await deleteTestDocument(db, DOC_A);
  });

  it("rejects invalid pages and enforces FK + unique chunk ids", async () => {
    const uuid = await insertDocument(DOC_A);

    const badPage = await db.from("document_pages").insert({
      document_id: uuid, page_number: 0, raw_text: "x", clean_text: "x",
      clean_text_hash: "c".repeat(64),
    });
    expect(badPage.error).not.toBeNull();

    const badRange = await db
      .from("chunks")
      .insert({ ...validChunkRow(uuid, `${DOC_A}:c000`, 0), page_start: 3, page_end: 2 });
    expect(badRange.error).not.toBeNull();

    const orphan = await db
      .from("chunks")
      .insert(validChunkRow("00000000-0000-4000-8000-000000000000", `${DOC_A}:c001`, 1));
    expect(orphan.error).not.toBeNull();
    expect(orphan.error!.code).toBe("23503");

    const ok = await db.from("chunks").insert(validChunkRow(uuid, `${DOC_A}:c000`, 0));
    expect(ok.error).toBeNull();
    const dup = await db.from("chunks").insert(validChunkRow(uuid, `${DOC_A}:c000`, 1));
    expect(dup.error).not.toBeNull();
    expect(dup.error!.code).toBe("23505");

    await deleteTestDocument(db, DOC_A);
  });

  it("rejects wrong embedding dimensions before storage", async () => {
    const uuid = await insertDocument(DOC_A);
    const { error } = await db.from("chunks").insert({
      ...validChunkRow(uuid, `${DOC_A}:c009`, 9),
      embedding: Array.from({ length: 8 }, () => 0),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/1536|dimensions/i);
    await deleteTestDocument(db, DOC_A);
  });

  it("rejects invalid ingestion_runs status and keeps error fields separate", async () => {
    const bad = await db.from("ingestion_runs").insert({
      document_id: DOC_B, fingerprint: "f".repeat(64), status: "exploded",
    });
    expect(bad.error).not.toBeNull();
    const ok = await db.from("ingestion_runs").insert({
      document_id: DOC_B, fingerprint: "f".repeat(64), status: "failed",
      error_code: "EMBEDDING_DIMENSION_MISMATCH",
      error_message: "embedding response had wrong dimensions",
    });
    expect(ok.error).toBeNull();
    await deleteTestRuns(db, DOC_B);
  });
});

describe("cascade and history", () => {
  it("deleting a document cascades pages and chunks but keeps ingestion history", async () => {
    const uuid = await insertDocument(DOC_B);
    await db.from("document_pages").insert({
      document_id: uuid, page_number: 1, raw_text: "raw", clean_text: "clean",
      clean_text_hash: "d".repeat(64),
    });
    await db.from("chunks").insert(validChunkRow(uuid, `${DOC_B}:c000`, 0));
    await db.from("ingestion_runs").insert({
      document_id: DOC_B, fingerprint: "f".repeat(64), status: "completed",
    });

    await deleteTestDocument(db, DOC_B);

    const pages = await db.from("document_pages").select("id").eq("document_id", uuid);
    const chunks = await db.from("chunks").select("id").eq("document_id", uuid);
    const runs = await db.from("ingestion_runs").select("id").eq("document_id", DOC_B);
    expect(pages.data).toHaveLength(0);
    expect(chunks.data).toHaveLength(0);
    expect(runs.data!.length).toBeGreaterThan(0);
    await deleteTestRuns(db, DOC_B);
  });
});

describe("atomic replacement RPC contract", () => {
  const payload = () => ({
    p_document: { ...validDocumentRow(RPC_DOC) },
    p_pages: [
      { page_number: 1, raw_text: "raw text", clean_text: "clean text", clean_text_hash: "e".repeat(64), detected_heading: null },
    ],
    p_chunks: [
      {
        chunk_id: `${RPC_DOC}:c000`, page_start: 1, page_end: 1, section: "Test",
        chunk_index: 0, chunk_type: "text", content: "clean text",
        content_hash: "b".repeat(64), embedding: Array.from({ length: 1536 }, () => 0), metadata: {},
      },
    ],
  });

  it("creates, then skips an identical-fingerprint call inside the transaction", async () => {
    const first = await db.rpc("ingest_replace_document", payload());
    expect(first.error).toBeNull();
    const firstResult = first.data as { document_id: string; action: string };
    expect(firstResult.action).toBe("replaced");

    // Same fingerprint again: the in-transaction recheck makes it a no-op.
    const second = await db.rpc("ingest_replace_document", payload());
    expect(second.error).toBeNull();
    const secondResult = second.data as { document_id: string; action: string };
    expect(secondResult.action).toBe("skipped");
    expect(secondResult.document_id).toBe(firstResult.document_id);

    // A different fingerprint replaces in place without duplicate rows.
    const changed = payload();
    (changed.p_document as Record<string, unknown>).ingestion_fingerprint = "e".repeat(64);
    const third = await db.rpc("ingest_replace_document", changed);
    expect(third.error).toBeNull();
    expect((third.data as { action: string }).action).toBe("replaced");

    const docs = await db.from("documents").select("id").eq("document_id", RPC_DOC);
    const chunks = await db.from("chunks").select("id").eq("document_id", firstResult.document_id);
    expect(docs.data).toHaveLength(1);
    expect(chunks.data).toHaveLength(1);
    await deleteTestDocument(db, RPC_DOC);
  });

  it("rejects payloads without a document_id and rolls back entirely", async () => {
    const bad = payload();
    delete (bad.p_document as Record<string, unknown>).document_id;
    const { error } = await db.rpc("ingest_replace_document", bad);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/INGEST_INVALID_PAYLOAD/);
  });
});

describe("security boundaries", () => {
  it("denies unauthenticated REST access", async () => {
    const res = await fetch(`${supabaseUrl()}/rest/v1/documents?select=id&limit=1`);
    expect(res.status).toBe(401);
  });

  it("secret-key server access works", async () => {
    const { error } = await db.from("documents").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("cleanup helpers refuse non-test document ids", async () => {
    expect(() => assertTestDocumentId("doc_termplus20_v1")).toThrow(/refusing destructive/);
    await expect(deleteTestDocument(db, "doc_termplus20_v1")).rejects.toThrow(/refusing/);
  });

  it(".env stays ignored and untracked", () => {
    expect(execSync("git check-ignore .env", { cwd: ROOT }).toString().trim()).toBe(".env");
    expect(execSync("git ls-files .env", { cwd: ROOT }).toString().trim()).toBe("");
  });

  it("no chat-model dependency or chat calls exist (AI SDK is embeddings-only)", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const banned of ["openai", "@anthropic-ai/sdk", "langchain", "@google/generative-ai"]) {
      expect(deps).not.toContain(banned);
    }
    const grep = execSync(
      "grep -rE 'generateText|streamText|generateObject|streamObject' lib scripts || true",
      { cwd: ROOT },
    ).toString().trim();
    expect(grep).toBe("");
  });
});
