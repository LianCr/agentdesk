import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import {
  ProductCatalogSchema,
  SyntheticCaseSchema,
  ManifestSchema,
  PublicDocumentManifestSchema,
} from "../lib/schemas";

// Validates all M1 data files against their zod schemas plus cross-field
// rules zod cannot express. Run with --self-test to only exercise the
// schemas against inline fixtures (used before data files exist).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_PATH = join(ROOT, "data/fictional-products/products.json");
const MANIFEST_PATH = join(ROOT, "data/fictional-products/manifest.json");
const CASES_DIR = join(ROOT, "data/synthetic-cases");
const PUBLIC_MANIFEST_PATH = join(ROOT, "data/public-documents/manifest.json");

let failures = 0;

function fail(msg: string): void {
  failures++;
  console.error(`FAIL: ${msg}`);
}

function ok(msg: string): void {
  console.log(`  ok: ${msg}`);
}

function parseFile<T>(path: string, schema: z.ZodType<T>, label: string): T | null {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(`${label}: cannot read/parse JSON — ${String(err)}`);
    return null;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    fail(`${label}: schema validation failed`);
    for (const issue of result.error.issues.slice(0, 10)) {
      console.error(`      ${issue.path.join(".")}: ${issue.message}`);
    }
    return null;
  }
  ok(`${label} passes schema`);
  return result.data;
}

function selfTest(): void {
  console.log("Schema self-test:");
  const validCase = {
    schemaVersion: 1,
    caseId: "TEST-1",
    riskTier: "low",
    client: { age: 30 },
    goal: "income_replacement",
    input: {},
    expected: {
      productCategories: ["term_life"],
      missingInformation: [],
      requiredRiskFlags: [],
      workflowDecision: "allow_internal_draft",
      reviewStatus: "standard_approval",
      externalUseRequiresApproval: true,
      allowedOutput: "comparison_draft",
      nextAction: "agent_review",
    },
  };
  if (!SyntheticCaseSchema.safeParse(validCase).success) {
    fail("self-test: valid synthetic case rejected");
  } else ok("valid synthetic case accepted");

  const badCase = structuredClone(validCase) as Record<string, unknown>;
  (badCase.expected as Record<string, unknown>).externalUseRequiresApproval = false;
  if (SyntheticCaseSchema.safeParse(badCase).success) {
    fail("self-test: externalUseRequiresApproval=false must be rejected");
  } else ok("externalUseRequiresApproval=false rejected");

  const validCatalog = {
    schemaVersion: 1,
    products: [
      {
        documentId: "doc_test_v1",
        fileName: "test.pdf",
        documentName: "Test Guide",
        documentType: "product_brochure",
        carrier: {
          id: "test_carrier",
          legalName: "Test Carrier",
          displayName: "Test Carrier (Fictional)",
          isFictional: true,
        },
        productName: "Test Product",
        productCategory: "term_life",
        jurisdiction: "California",
        language: "en",
        effectiveDate: "2026-01-01",
        pages: 1,
        isCurrent: true,
        isFictional: true,
        facts: {},
        pageOutline: [{ page: 1, title: "Cover" }],
        intentionalOmissions: [],
        omissionPatterns: [],
        expectedFactLocations: [
          { factId: "f1", page: 1, mustInclude: ["Test Product"] },
        ],
      },
    ],
  };
  if (!ProductCatalogSchema.safeParse(validCatalog).success) {
    fail("self-test: valid product catalog rejected");
  } else ok("valid product catalog accepted");

  const badCatalog = structuredClone(validCatalog) as { products: Record<string, unknown>[] };
  (badCatalog.products[0]!.carrier as Record<string, unknown>).isFictional = false;
  if (ProductCatalogSchema.safeParse(badCatalog).success) {
    fail("self-test: carrier.isFictional=false must be rejected");
  } else ok("carrier.isFictional=false rejected");
}

function validateProducts(): void {
  console.log("products.json:");
  const catalog = parseFile(PRODUCTS_PATH, ProductCatalogSchema, "products.json");
  if (!catalog) return;

  const ids = new Set<string>();
  for (const p of catalog.products) {
    const label = p.documentId;
    if (ids.has(p.documentId)) fail(`${label}: duplicate documentId`);
    ids.add(p.documentId);

    // Page outline must cover exactly pages 1..N.
    const outlinePages = p.pageOutline.map((d) => d.page).sort((a, b) => a - b);
    const expectedPages = Array.from({ length: p.pages }, (_, i) => i + 1);
    if (JSON.stringify(outlinePages) !== JSON.stringify(expectedPages)) {
      fail(`${label}: pageOutline pages [${outlinePages}] != 1..${p.pages}`);
    }

    for (const loc of p.expectedFactLocations) {
      if (loc.page > p.pages) {
        fail(`${label}: expectedFactLocation ${loc.factId} page ${loc.page} > ${p.pages}`);
      }
    }
    for (const om of p.omissionPatterns) {
      try {
        new RegExp(om.pattern, om.flags);
      } catch {
        fail(`${label}: omission pattern does not compile: ${om.pattern}`);
      }
    }
    if (p.omissionPatterns.length < p.intentionalOmissions.length) {
      fail(`${label}: fewer omissionPatterns than intentionalOmissions`);
    }
  }
  if (failures === 0) ok("cross-field checks pass");
}

function validateCases(): void {
  console.log("synthetic cases:");
  if (!existsSync(CASES_DIR)) {
    fail(`missing directory ${CASES_DIR}`);
    return;
  }
  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith(".json")).sort();
  if (files.length < 3) fail(`expected 3 case files, found ${files.length}`);
  const caseIds = new Set<string>();
  for (const f of files) {
    const c = parseFile(join(CASES_DIR, f), SyntheticCaseSchema, f);
    if (!c) continue;
    if (caseIds.has(c.caseId)) fail(`${f}: duplicate caseId ${c.caseId}`);
    caseIds.add(c.caseId);
    if (c.expected.allowedOutput === "replacement_review_checklist" && !c.expected.requiredChecklistItems?.length) {
      fail(`${f}: replacement_review_checklist requires requiredChecklistItems`);
    }
  }
}

function validateManifests(): void {
  if (existsSync(MANIFEST_PATH)) {
    console.log("manifest.json:");
    parseFile(MANIFEST_PATH, ManifestSchema, "manifest.json");
  } else {
    console.log("manifest.json: not generated yet (skipped)");
  }
  if (existsSync(PUBLIC_MANIFEST_PATH)) {
    console.log("public-documents/manifest.json:");
    parseFile(PUBLIC_MANIFEST_PATH, PublicDocumentManifestSchema, "public-documents/manifest.json");
  } else {
    console.log("public-documents/manifest.json: not created yet (skipped)");
  }
}

const selfTestOnly = process.argv.includes("--self-test");
selfTest();
if (!selfTestOnly) {
  validateProducts();
  validateCases();
  validateManifests();
}

if (failures > 0) {
  console.error(`\n${failures} validation failure(s).`);
  process.exit(1);
}
console.log("\nAll data validation checks passed.");
