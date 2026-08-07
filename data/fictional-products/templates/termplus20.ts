import type { ProductDefinition } from "../../../lib/schemas";
import { usd } from "../../../lib/format";
import { coverPage, dataTable, esc, kvTable, renderDocument, type Page } from "./layout";

// Demo TermPlus 20 — 6 pages per SPEC §5.4. All facts come from
// products.json; this file only arranges them with transitional wording.

interface TermFacts {
  productType: string;
  issueAges: { display: string };
  faceAmounts: { display: string };
  premiums: { display: string };
  underwritingClasses: string[];
  cashValue: { display: string };
  conversion: { display: string };
  riders: Array<{ name: string; display: string }>;
  exclusions: string[];
  samplePremiums: {
    underwritingClass: string;
    faceAmounts: number[];
    rows: Array<{ issueAge: number; monthlyPremiums: number[] }>;
    note: string;
    tableTitle: string;
  };
}

export function buildTermPlusHtml(product: ProductDefinition): string {
  const f = product.facts as unknown as TermFacts;

  const atAGlance: Page = {
    title: "At a Glance",
    body: kvTable([
      ["Product Type", f.productType],
      ["Issue Ages", f.issueAges.display],
      ["Face Amounts", f.faceAmounts.display],
      ["Premiums", f.premiums.display],
      ["Cash Value", f.cashValue.display],
    ]),
  };

  const eligibility: Page = {
    title: "Eligibility and Underwriting Classes",
    body: `
<p>${esc(product.productName)} is available at issue ages ${esc(f.issueAges.display)}, subject to the
carrier's underwriting process and policy terms.</p>
<h3>Underwriting Classes</h3>
<ul>${f.underwritingClasses.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<p>The underwriting class is determined by the carrier during underwriting; see policy terms.</p>`,
  };

  const premiumTable = dataTable(
    ["Issue Age", ...f.samplePremiums.faceAmounts.map(usd)],
    f.samplePremiums.rows.map((r) => [String(r.issueAge), ...r.monthlyPremiums.map(usd)]),
    { caption: f.samplePremiums.tableTitle, note: f.samplePremiums.note },
  );

  const premiumStructure: Page = {
    title: "Premium Structure",
    body: `
<p>${esc(f.premiums.display)}</p>
<p>The table below shows sample monthly premiums for the ${esc(f.samplePremiums.underwritingClass)} class
of this fictional demonstration product.</p>
${premiumTable}`,
  };

  const conversionAndRiders: Page = {
    title: "Conversion Privilege and Riders",
    body: `
<h3>Conversion Privilege</h3>
<p>${esc(f.conversion.display)}</p>
<h3>Riders</h3>
${f.riders.map((r) => `<h3>${esc(r.name)}</h3><p>${esc(r.display)}</p>`).join("")}`,
  };

  const exclusions: Page = {
    title: "Exclusions, Limitations and Disclosures",
    body: `
<ul>${f.exclusions.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
<p class="fine">This demonstration document describes a fictional product and is not an offer,
an illustration, a suitability determination, tax advice, legal advice, or an insurance
recommendation. For any decision, consult a licensed professional. All coverage is subject
to policy terms.</p>`,
  };

  return renderDocument(product, [
    coverPage(product, f.productType),
    atAGlance,
    eligibility,
    premiumStructure,
    conversionAndRiders,
    exclusions,
  ]);
}
