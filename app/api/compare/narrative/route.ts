import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnswerModel, answerModelId } from "../../../../lib/ai/client";
import { compareProducts } from "../../../../lib/comparison/compare";
import { loadComparisonCatalog } from "../../../../lib/comparison/loader";
import { attachNarrative } from "../../../../lib/comparison/narrative";

// Optional narrative enhancement.
//
// The browser sends identifiers only. The server REBUILDS the deterministic
// draft from committed data and narrates that — a client can never hand us
// factual cells, citations, observations or review flags to explain, because
// then the "explanation" would be describing whatever the caller invented.
//
// Failure here is never a comparison failure: the response is always 200 with
// a narrativeStatus the page can render calmly.

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z
  .object({
    productAId: z.string().regex(/^doc_[a-z0-9_]+$/),
    productBId: z.string().regex(/^doc_[a-z0-9_]+$/),
    clientCaseId: z.string().min(1).nullable().optional(),
    language: z.enum(["zh", "en"]).optional(),
  })
  .strict();

const UNAVAILABLE = {
  narrativeSections: [],
  narrativeStatus: "unavailable" as const,
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: z.infer<typeof RequestSchema>;
  try {
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Invalid narrative request." },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "INVALID_BODY", message: "Invalid request body." }, { status: 400 });
  }

  try {
    const catalog = await loadComparisonCatalog();
    const productA = catalog.products.find((p) => p.documentId === body.productAId);
    const productB = catalog.products.find((p) => p.documentId === body.productBId);
    if (!productA || !productB || productA.documentId === productB.documentId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Invalid product selection." },
        { status: 400 },
      );
    }
    const syntheticCase =
      body.clientCaseId != null ? catalog.cases.find((c) => c.caseId === body.clientCaseId) ?? null : null;

    const draft = compareProducts({
      productA,
      productB,
      chunksByDocumentId: catalog.chunksByDocumentId,
      syntheticCase,
    });
    const language = body.language ?? draft.clientContext?.language ?? "zh";
    // The answer model's measured p95 in M3 was ~53s, so a 60s bound sits
    // right on the edge; 90s keeps a slow-but-valid explanation from being
    // discarded while still failing fast enough for an optional enhancement.
    const narrated = await attachNarrative(
      draft,
      [productA, productB],
      { model: createAnswerModel(), timeoutMs: 90_000 },
      language,
    );

    return NextResponse.json({
      narrativeSections: narrated.narrativeSections,
      narrativeStatus: narrated.narrativeStatus,
      narrativeModel: narrated.narrativeStatus === "available" ? answerModelId() : null,
    });
  } catch (err) {
    // An optional enhancement failing must never look like a broken product.
    const message = err instanceof Error ? err.message : "";
    const code = message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? "NARRATIVE_FAILED";
    console.error(JSON.stringify({ event: "narrative_error", code })); // sanitized: code only
    return NextResponse.json({ ...UNAVAILABLE, narrativeModel: null });
  }
}
