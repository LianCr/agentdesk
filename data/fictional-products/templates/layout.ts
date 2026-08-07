import type { ProductDefinition } from "../../../lib/schemas";

// Shared page shell for all fictional product guides. Fixed 8.5in x 11in
// pages, real <table> markup, selectable text, per-page DEMONSTRATION footer.

export const DEMO_MARK = "DEMONSTRATION DOCUMENT — FICTIONAL PRODUCT — NOT FOR SALE";

export function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function footerText(carrierDisplayName: string, pageNum: number, total: number): string {
  return `${DEMO_MARK} | ${carrierDisplayName} | Page ${pageNum} of ${total}`;
}

const STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 10.5pt; line-height: 1.45; font-variant-ligatures: none; }
  @page { size: 8.5in 11in; margin: 0; }
  .page {
    width: 8.5in;
    height: 11in;
    box-sizing: border-box;
    overflow: hidden;
    page-break-after: always;
    position: relative;
    padding: 0.75in 0.75in 1in 0.75in;
    background: #ffffff;
  }
  .footer {
    position: absolute;
    bottom: 0.45in;
    left: 0.75in;
    right: 0.75in;
    font-size: 7.5pt;
    color: #555;
    border-top: 0.5pt solid #999;
    padding-top: 5pt;
    text-align: center;
  }
  .demo-banner {
    background: #8a1f1f;
    color: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-weight: bold;
    font-size: 11pt;
    letter-spacing: 0.5pt;
    text-align: center;
    padding: 10pt 8pt;
    margin-bottom: 28pt;
  }
  h1 { font-size: 26pt; line-height: 1.2; margin-bottom: 10pt; }
  h2 { font-size: 15pt; border-bottom: 1.5pt solid #8a1f1f; padding-bottom: 4pt; margin-bottom: 12pt; }
  h3 { font-size: 11.5pt; margin: 12pt 0 4pt 0; }
  p { margin-bottom: 8pt; }
  ul { margin: 0 0 8pt 16pt; }
  li { margin-bottom: 4pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 0.5pt solid #666; padding: 5pt 7pt; text-align: left; }
  th { background: #efe9e9; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; }
  td.num, th.num { text-align: right; }
  .table-note { font-size: 8.5pt; color: #444; margin-top: 2pt; }
  .cover-carrier { font-size: 13pt; color: #444; margin-bottom: 6pt; }
  .cover-sub { font-size: 12pt; color: #333; margin-bottom: 20pt; }
  .cover-meta { font-size: 10.5pt; color: #333; margin-top: 30pt; line-height: 1.7; }
  .kv th { width: 30%; background: #f4f1f1; vertical-align: top; }
  .fine { font-size: 8.5pt; color: #444; }
`;

export interface Page {
  title: string | null;
  body: string;
}

export function renderDocument(product: ProductDefinition, pages: Page[]): string {
  const total = product.pages;
  if (pages.length !== total) {
    throw new Error(
      `${product.documentId}: template produced ${pages.length} pages, products.json declares ${total}`,
    );
  }
  const pageHtml = pages
    .map((pg, i) => {
      const n = i + 1;
      const heading = pg.title ? `<h2>${esc(pg.title)}</h2>` : "";
      return `<div class="page" data-page="${n}">
${heading}
${pg.body}
<div class="footer">${esc(footerText(product.carrier.displayName, n, total))}</div>
</div>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(product.documentName)}</title>
<style>${STYLES}</style>
</head>
<body>
${pageHtml}
</body>
</html>`;
}

export function coverPage(product: ProductDefinition, subtitle: string): Page {
  const facts = product.facts as Record<string, unknown>;
  const effectiveDateDisplay = String(facts.effectiveDateDisplay);
  return {
    title: null,
    body: `
<div class="demo-banner">${esc(DEMO_MARK)}</div>
<p class="cover-carrier">${esc(product.carrier.displayName)}</p>
<h1>${esc(product.productName)}</h1>
<p class="cover-sub">${esc(product.documentName)}</p>
<p>${esc(subtitle)}</p>
<div class="cover-meta">
Effective Date: ${esc(effectiveDateDisplay)}<br>
Jurisdiction: ${esc(product.jurisdiction)}<br>
Document ID: ${esc(product.documentId)}
</div>
<p class="cover-meta fine">This demonstration document describes a fictional product. It does not
constitute an offer, a quotation, an illustration, a suitability determination, tax advice,
legal advice, or an insurance recommendation. All products, carriers and figures are fictional.</p>
`,
  };
}

export function dataTable(
  headers: string[],
  rows: string[][],
  opts: { caption?: string; note?: string; numericFromCol?: number } = {},
): string {
  const numFrom = opts.numericFromCol ?? 1;
  const head = headers
    .map((h, i) => `<th${i >= numFrom ? ' class="num"' : ""}>${esc(h)}</th>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => `<td${i >= numFrom ? ' class="num"' : ""}>${esc(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("\n");
  const caption = opts.caption ? `<h3>${esc(opts.caption)}</h3>` : "";
  const note = opts.note ? `<p class="table-note">${esc(opts.note)}</p>` : "";
  return `${caption}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${note}`;
}

export function kvTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("\n");
  return `<table class="kv"><tbody>${body}</tbody></table>`;
}
