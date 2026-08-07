import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ProductCatalogSchema,
  ManifestSchema,
  type ProductDefinition,
} from "../lib/schemas";
import { extractPdf, normalizeText } from "../lib/pdf-text";
import { usd, intPercent } from "../lib/format";
import { footerText } from "../data/fictional-products/templates/layout";

// Validates the generated PDFs against products.json per SPEC §12.
// Every check failure is reported; the script exits non-zero if any fails.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = join(ROOT, "data/fictional-products");
const GENERATED_DIR = join(PRODUCTS_DIR, "generated");
const DIGEST_PATH = join(GENERATED_DIR, "text-digest.json");

// Real carrier and index names that must never appear (SPEC §2.1, §2.4).
// Multi-word forms avoid false positives on common adjectives.
const BANNED_NAMES = [
  "s&p", "standard & poor", "nasdaq", "dow jones", "russell 2000", "russell 3000",
  "euro stoxx", "msci", "ftse", "wilshire",
  "prudential", "metlife", "new york life", "northwestern mutual", "massmutual",
  "pacific life", "lincoln financial", "john hancock", "transamerica", "nationwide",
  "allianz", "athene", "corebridge", "guardian life", "principal financial",
  "securian", "symetra", "global atlantic", "brighthouse", "midland national",
  "north american company", "jackson national", "protective life", "ameritas",
  "penn mutual", "ohio national", "mutual of omaha", "thrivent", "state farm",
  "allstate", "usaa", "fidelity & guaranty",
];

let failures = 0;
function fail(msg: string): void {
  failures++;
  console.error(`FAIL: ${msg}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Numeric-looking cells ("$13", "7%", "30", "11+") are matched with digit
// boundaries so "$1" cannot be satisfied by "$18" or "$1,000".
function cellMatches(normalizedPageText: string, cell: string): boolean {
  const c = normalizeText(cell);
  if (/^[$\d][\d,.%+]*$/.test(c)) {
    // Suffix: no digit or % directly after, and no ",digit"/".digit"
    // continuation — so "$1" is not satisfied by "$18" or "$1,000", while
    // ordinary punctuation like "4.25%," still matches.
    const re = new RegExp(`(?<![\\d$.,])${escapeRegex(c)}(?!\\d)(?!%)(?![.,]\\d)`);
    return re.test(normalizedPageText);
  }
  return normalizedPageText.includes(c);
}

interface ExpectedTable {
  page: number;
  label: string;
  headers: string[];
  cells: string[];
}

// Expected table content is derived from the structured facts through the
// same formatters the templates use — cells are never maintained twice.
function expectedTables(product: ProductDefinition): ExpectedTable[] {
  const f = product.facts as Record<string, any>;
  switch (product.documentId) {
    case "doc_termplus20_v1": {
      const sp = f.samplePremiums;
      return [
        {
          page: sp.tablePage,
          label: "sample monthly premium table",
          headers: ["Issue Age", ...sp.faceAmounts.map((a: number) => usd(a))],
          cells: sp.rows.flatMap((r: { issueAge: number; monthlyPremiums: number[] }) => [
            String(r.issueAge),
            ...r.monthlyPremiums.map((p) => usd(p)),
          ]),
        },
      ];
    }
    case "doc_indexflex_ul_v1": {
      const s = f.surrenderChargeSchedule;
      return [
        {
          page: s.tablePage,
          label: "IUL surrender charge schedule",
          headers: ["Policy Year", ...s.chargesByYear.map((_: number, i: number) => String(i + 1)), "11+"],
          cells: ["Charge", ...s.chargesByYear.map((c: number) => usd(c)), usd(s.afterYear10)],
        },
      ];
    }
    case "doc_securerate5_v1": {
      const s = f.surrenderChargeSchedule;
      return [
        {
          page: s.tablePage,
          label: "annuity surrender charge schedule",
          headers: ["Contract Year", ...s.chargesByYearPercent.map((_: number, i: number) => String(i + 1)), "8+"],
          cells: [
            "Charge",
            ...s.chargesByYearPercent.map((c: number) => intPercent(c)),
            intPercent(s.afterYear7Percent),
          ],
        },
      ];
    }
    default:
      throw new Error(`no expected tables defined for ${product.documentId}`);
  }
}

async function main(): Promise<void> {
  const catalog = ProductCatalogSchema.parse(
    JSON.parse(readFileSync(join(PRODUCTS_DIR, "products.json"), "utf8")),
  );

  const manifestPath = join(PRODUCTS_DIR, "manifest.json");
  const manifest = existsSync(manifestPath)
    ? ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")))
    : null;
  if (!manifest) fail("manifest.json missing — run generate-manifest first");

  const reportPath = join(GENERATED_DIR, "generation-report.json");
  const generationReport = existsSync(reportPath)
    ? (JSON.parse(readFileSync(reportPath, "utf8")) as {
        results: Array<{ documentId: string; overflowIssues: unknown[] }>;
      })
    : null;
  if (!generationReport) fail("generation-report.json missing — run generate-product-pdfs first");

  const previousDigest = existsSync(DIGEST_PATH)
    ? (JSON.parse(readFileSync(DIGEST_PATH, "utf8")) as Record<string, string[]>)
    : null;
  const currentDigest: Record<string, string[]> = {};

  for (const product of catalog.products) {
    const id = product.documentId;
    const pdfPath = join(GENERATED_DIR, product.fileName);

    // 1. Declared PDF exists.
    if (!existsSync(pdfPath)) {
      fail(`${id}: declared PDF missing at ${pdfPath}`);
      continue;
    }

    const bytes = readFileSync(pdfPath);
    const { numPages, pageTexts } = await extractPdf(pdfPath);
    const normalizedPages = pageTexts.map(normalizeText);
    const fullText = normalizedPages.join("\n");
    currentDigest[product.fileName] = normalizedPages.map((t) =>
      createHash("sha256").update(t).digest("hex"),
    );

    // 2. Actual page count equals declared page count.
    if (numPages !== product.pages) {
      fail(`${id}: actual page count ${numPages} != declared ${product.pages}`);
    }

    // 3–5. Footer with correct Page N of M, and meaningful text, on every page.
    normalizedPages.forEach((text, i) => {
      const expectedFooter = normalizeText(
        footerText(product.carrier.displayName, i + 1, product.pages),
      );
      if (!text.includes(expectedFooter)) {
        fail(`${id} page ${i + 1}: DEMONSTRATION footer with "Page ${i + 1} of ${product.pages}" not found`);
      }
      if (text.length < 80) {
        fail(`${id} page ${i + 1}: extracted text too short (${text.length} chars)`);
      }
    });

    // 6. Required facts appear on their expected pages.
    for (const loc of product.expectedFactLocations) {
      const pageText = normalizedPages[loc.page - 1];
      if (pageText === undefined) {
        fail(`${id}: expected fact ${loc.factId} on page ${loc.page}, which does not exist`);
        continue;
      }
      for (const needle of loc.mustInclude) {
        if (!cellMatches(pageText, needle)) {
          fail(`${id} page ${loc.page} (${loc.factId}): missing "${needle}"`);
        }
      }
    }

    // 7. Intentional omissions appear nowhere (contextual regex patterns).
    for (const om of product.omissionPatterns) {
      const flags = om.flags ?? "";
      const re = new RegExp(om.pattern, flags.includes("g") ? flags : flags + "g");
      const hit = fullText.match(re);
      if (hit) {
        fail(`${id}: omission violated (${om.description}) — matched "${hit[0]}"`);
      }
    }

    // 8. Tables contain all expected headers and cells (derived from facts).
    for (const table of expectedTables(product)) {
      const pageText = normalizedPages[table.page - 1] ?? "";
      for (const header of table.headers) {
        if (!cellMatches(pageText, header)) {
          fail(`${id} page ${table.page}: ${table.label} header "${header}" not found`);
        }
      }
      for (const cell of table.cells) {
        if (!cellMatches(pageText, cell)) {
          fail(`${id} page ${table.page}: ${table.label} cell "${cell}" not found`);
        }
      }
    }

    // 9. No page-container overflow during HTML generation.
    if (generationReport) {
      const entry = generationReport.results.find((r) => r.documentId === id);
      if (!entry) fail(`${id}: missing from generation-report.json`);
      else if (entry.overflowIssues.length > 0) {
        fail(`${id}: generation reported page overflow`);
      }
    }

    // 10. No banned real carrier or index name.
    for (const banned of BANNED_NAMES) {
      if (fullText.includes(banned)) {
        fail(`${id}: banned real-world name "${banned}" found`);
      }
    }

    // Every page must carry the fictional-product marking (SPEC §2.1).
    normalizedPages.forEach((text, i) => {
      if (!text.includes("fictional")) {
        fail(`${id} page ${i + 1}: fictional-product marking missing`);
      }
    });

    // 11. sha256 present in manifest and matching the actual PDF bytes.
    if (manifest) {
      const entry = manifest.find((m) => m.documentId === id);
      if (!entry) {
        fail(`${id}: missing from manifest.json`);
      } else {
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        if (entry.sha256 !== sha256) {
          fail(`${id}: manifest sha256 does not match PDF bytes — regenerate manifest`);
        }
        if (entry.pages !== numPages) {
          fail(`${id}: manifest pages ${entry.pages} != actual ${numPages}`);
        }
      }
    }

    console.log(`checked ${id} (${numPages} pages)`);
  }

  // 12. Re-running generation with unchanged data yields equivalent semantic
  // content: per-page normalized-text digests must be stable across runs.
  if (previousDigest) {
    for (const [file, digests] of Object.entries(currentDigest)) {
      const prev = previousDigest[file];
      if (!prev || JSON.stringify(prev) !== JSON.stringify(digests)) {
        fail(
          `${file}: extracted text differs from recorded baseline (text-digest.json). ` +
            `If the content change is intentional, delete text-digest.json and re-run.`,
        );
      }
    }
  } else {
    writeFileSync(DIGEST_PATH, JSON.stringify(currentDigest, null, 2) + "\n");
    console.log("Recorded text-digest.json baseline for semantic-stability checks.");
  }

  if (failures > 0) {
    console.error(`\n${failures} PDF validation failure(s).`);
    process.exit(1);
  }
  console.log("\nAll PDF validation checks passed.");
}

await main();
