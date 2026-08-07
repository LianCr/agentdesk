import type { ProductDefinition } from "../../lib/schemas.js";
import { footerText } from "../../data/fictional-products/templates/layout.js";
import type { StructuredPage } from "../../lib/ingestion/extract-pages.js";

// Synthetic single-table product used by chunking unit tests. Heights mirror
// the measured font ladder of the real generated PDFs.

export function testProduct(overrides: Partial<ProductDefinition> = {}): ProductDefinition {
  return {
    documentId: "doc_test_v1",
    fileName: "doc-test.pdf",
    documentName: "Test Product Guide",
    documentType: "product_brochure",
    carrier: {
      id: "test_carrier",
      legalName: "Test Carrier Company",
      displayName: "Test Carrier Company (Fictional)",
      isFictional: true,
    },
    productName: "Test Product",
    productCategory: "term_life",
    jurisdiction: "California",
    language: "en",
    effectiveDate: "2026-01-01",
    pages: 2,
    isCurrent: true,
    isFictional: true,
    facts: { surrenderChargeSchedule: { tablePage: 2 } },
    pageOutline: [
      { page: 1, title: "Cover" },
      { page: 2, title: "Charges and Sections" },
    ],
    intentionalOmissions: [],
    omissionPatterns: [],
    expectedFactLocations: [{ factId: "f1", page: 1, mustInclude: ["Test Product"] }],
    ...overrides,
  };
}

export function structuredPagesFor(product: ProductDefinition): StructuredPage[] {
  const footer = (n: number): [string, number] => [
    footerText(product.carrier.displayName, n, product.pages),
    7.5,
  ];
  const mk = (page: number, lines: Array<[string, number]>): StructuredPage => ({
    page,
    lines: lines.map(([text, height], i) => ({ text, height, y: 720 - i * 20 })),
  });
  return [
    mk(1, [
      ["DEMONSTRATION DOCUMENT — FICTIONAL PRODUCT — NOT FOR SALE", 11],
      [product.carrier.displayName, 13],
      [product.productName, 26],
      [product.documentName, 12],
      ["Effective Date: January 1, 2026 for this fictional demonstration document.", 10.5],
      footer(1),
    ]),
    mk(2, [
      ["Charges and Sections", 15],
      ["This opening paragraph explains the charges of this fictional test product in detail.", 10.5],
      ["Charge Schedule", 11.5],
      ["Year 1 2 3", 10.5],
      ["Charge 7% 6% 5%", 10.5],
      ["Schedule note: percentages apply to this fictional demonstration product only.", 8.5],
      ["Another Section", 11.5],
      ["This closing paragraph describes another self-contained section of the test product.", 10.5],
      ["This demonstration document is fictional and is not an offer or an insurance recommendation.", 8.5],
      footer(2),
    ]),
  ];
}
