import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { compareProducts } from "../../../lib/comparison/compare";
import { loadComparisonCatalog } from "../../../lib/comparison/loader";
import type { ComparisonDraft } from "../../../lib/comparison/types";

// Thin presentation boundary over the approved M4-B engine. This route owns
// nothing about comparison semantics: no fact lookup, no source mapping, no
// observations, no missing-info or review rules, no status computation. It
// validates the request, calls compareProducts, attaches code-owned PDF URLs
// to citations, and maps failures to safe responses.
//
// There is deliberately no model call here — the deterministic draft must be
// available immediately, and the optional narrative lives at a separate route.

export const runtime = "nodejs";
export const maxDuration = 30;

const RequestSchema = z
  .object({
    productAId: z.string().regex(/^doc_[a-z0-9_]+$/),
    productBId: z.string().regex(/^doc_[a-z0-9_]+$/),
    clientCaseId: z.string().min(1).nullable().optional(),
  })
  .strict();

export type ComparisonResponse = ComparisonDraft & {
  citationUrls: Record<string, string>; // citationId -> /documents/<file>#page=N
};

/** Attaches the public PDF URL for every citation. URLs are code-owned. */
export function withCitationUrls(
  draft: ComparisonDraft,
  fileByDocumentId: Map<string, string>,
): ComparisonResponse {
  const citationUrls: Record<string, string> = {};
  for (const row of draft.dimensions) {
    for (const cell of row.cells) {
      for (const citation of cell.citations) {
        const file = fileByDocumentId.get(citation.documentId);
        if (file) citationUrls[citation.citationId] = `/documents/${file}#page=${citation.pageStart}`;
      }
    }
  }
  return { ...draft, citationUrls };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: z.infer<typeof RequestSchema>;
  try {
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "请选择两个不同的演示产品。Please select two different demo products.",
        },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    const catalog = await loadComparisonCatalog();
    const productA = catalog.products.find((p) => p.documentId === body.productAId);
    const productB = catalog.products.find((p) => p.documentId === body.productBId);
    if (!productA || !productB) {
      return NextResponse.json(
        { error: "UNKNOWN_PRODUCT", message: "未知的演示产品。Unknown demo product." },
        { status: 400 },
      );
    }
    if (productA.documentId === productB.documentId) {
      return NextResponse.json(
        {
          error: "DUPLICATE_PRODUCT",
          message: "请选择两个不同的产品。Please select two different products.",
        },
        { status: 400 },
      );
    }

    const syntheticCase =
      body.clientCaseId != null ? catalog.cases.find((c) => c.caseId === body.clientCaseId) : null;
    if (body.clientCaseId != null && !syntheticCase) {
      return NextResponse.json(
        { error: "UNKNOWN_CLIENT", message: "未知的演示客户。Unknown demo client." },
        { status: 400 },
      );
    }

    // partial / blocked are legitimate outcomes, not HTTP failures.
    const draft = compareProducts({
      productA,
      productB,
      chunksByDocumentId: catalog.chunksByDocumentId,
      syntheticCase: syntheticCase ?? null,
    });
    return NextResponse.json(withCitationUrls(draft, catalog.fileByDocumentId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const code = message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? "COMPARISON_FAILED";
    console.error(JSON.stringify({ event: "comparison_error", code })); // sanitized: code only
    return NextResponse.json(
      {
        error: code,
        message: "生成比较草稿时出现问题，请重试。Something went wrong while building the comparison.",
      },
      { status: 500 },
    );
  }
}
