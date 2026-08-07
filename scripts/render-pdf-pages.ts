import { mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { ProductCatalogSchema } from "../lib/schemas.js";

// Renders every page of the generated product HTML to PNG screenshots in
// tmp/visual-qa/ (git-ignored) for human visual acceptance of the M1 PDFs.
// Read-only with respect to all tracked files.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_DIR = join(ROOT, "data/fictional-products/generated");
const OUT_DIR = join(ROOT, "tmp/visual-qa");

const catalog = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
try {
  for (const product of catalog.products) {
    const htmlPath = join(GENERATED_DIR, product.fileName.replace(/\.pdf$/, ".html"));
    const page = await browser.newPage({ viewport: { width: 850, height: 1100 } });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
    const pageEls = await page.locator(".page").all();
    for (let i = 0; i < pageEls.length; i++) {
      const out = join(OUT_DIR, `${product.documentId}-p${i + 1}.png`);
      await pageEls[i]!.screenshot({ path: out });
    }
    console.log(`ok ${product.documentId}: ${pageEls.length} page screenshots`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Screenshots written to ${OUT_DIR}`);
