import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { ProductCatalogSchema, type ProductDefinition } from "../lib/schemas";
import { buildTermPlusHtml } from "../data/fictional-products/templates/termplus20";
import { buildIndexFlexHtml } from "../data/fictional-products/templates/indexflex-ul";
import { buildSecureRateHtml } from "../data/fictional-products/templates/securerate5";

// Generates HTML and PDFs for all fictional products from products.json.
// Fails if any fixed-size .page container overflows, and records the
// overflow check result for validate-product-pdfs.ts.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data/fictional-products/generated");

const TEMPLATES: Record<string, (p: ProductDefinition) => string> = {
  doc_termplus20_v1: buildTermPlusHtml,
  doc_indexflex_ul_v1: buildIndexFlexHtml,
  doc_securerate5_v1: buildSecureRateHtml,
};

interface OverflowIssue {
  page: number;
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
}

async function main(): Promise<void> {
  const catalog = ProductCatalogSchema.parse(
    JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
  );
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const report: Array<{
    documentId: string;
    file: string;
    declaredPages: number;
    overflowIssues: OverflowIssue[];
  }> = [];
  let failed = false;

  try {
    for (const product of catalog.products) {
      const template = TEMPLATES[product.documentId];
      if (!template) throw new Error(`no template registered for ${product.documentId}`);

      const html = template(product);
      const htmlPath = join(OUT_DIR, product.fileName.replace(/\.pdf$/, ".html"));
      writeFileSync(htmlPath, html);

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });

      const overflowIssues = await page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLElement>(".page"))
          .map((el, i) => ({
            page: i + 1,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          }))
          .filter((m) => m.scrollHeight > m.clientHeight || m.scrollWidth > m.clientWidth);
      });

      const pageCount = await page.evaluate(() => document.querySelectorAll(".page").length);
      if (pageCount !== product.pages) {
        throw new Error(
          `${product.documentId}: rendered ${pageCount} .page containers, declared ${product.pages}`,
        );
      }

      const pdfPath = join(OUT_DIR, product.fileName);
      await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
      await page.close();

      report.push({
        documentId: product.documentId,
        file: product.fileName,
        declaredPages: product.pages,
        overflowIssues,
      });

      if (overflowIssues.length > 0) {
        failed = true;
        console.error(`FAIL ${product.documentId}: page overflow`, overflowIssues);
      } else {
        console.log(`ok ${product.documentId}: ${product.pages} pages -> ${product.fileName}`);
      }
    }
  } finally {
    await browser.close();
  }

  writeFileSync(
    join(OUT_DIR, "generation-report.json"),
    JSON.stringify({ schemaVersion: 1, results: report }, null, 2),
  );

  if (failed) {
    console.error("PDF generation finished with overflow failures.");
    process.exit(1);
  }
  console.log("All PDFs generated without overflow.");
}

await main();
