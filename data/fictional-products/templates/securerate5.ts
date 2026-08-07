import type { ProductDefinition } from "../../../lib/schemas";
import { intPercent } from "../../../lib/format";
import { coverPage, dataTable, esc, kvTable, renderDocument, type Page } from "./layout";

// Demo SecureRate 5 Fixed Annuity — 6 pages per SPEC §7.4.

interface AnnuityFacts {
  productType: string;
  issueAges: { display: string };
  minimumPremium: { display: string };
  maximumPremium: { display: string };
  initialRate: { display: string; guaranteeDisplay: string };
  renewalRates: { display: string };
  guaranteedMinimumRate: { display: string };
  freeWithdrawal: { display: string };
  marketValueAdjustment: { display: string };
  deathBenefit: { display: string };
  annuitizationOptions: string[];
  optionalRiders: { display: string };
  taxNote: { display: string };
  replacement: { display: string };
  suitability: { display: string };
  surrenderChargeSchedule: {
    basis: string;
    chargesByYearPercent: number[];
    afterYear7Percent: number;
    tableTitle: string;
  };
}

export function buildSecureRateHtml(product: ProductDefinition): string {
  const f = product.facts as unknown as AnnuityFacts;

  const overview: Page = {
    title: "Overview, Issue Ages and Premium Limits",
    body: kvTable([
      ["Product Type", f.productType],
      ["Issue Ages", f.issueAges.display],
      ["Minimum Premium", f.minimumPremium.display],
      ["Maximum Premium", f.maximumPremium.display],
    ]),
  };

  const rates: Page = {
    title: "Interest Rates",
    body: `
${kvTable([
  ["Initial Rate", `${f.initialRate.display}, ${f.initialRate.guaranteeDisplay}`],
  ["Renewal Rates", f.renewalRates.display],
  ["Guaranteed Minimum Rate", f.guaranteedMinimumRate.display],
])}
<p>Renewal rates are declared by the carrier and are subject to the guaranteed minimum;
see the contract for details.</p>`,
  };

  const schedule = f.surrenderChargeSchedule;
  const scheduleTable = dataTable(
    ["Contract Year", ...schedule.chargesByYearPercent.map((_, i) => String(i + 1)), "8+"],
    [["Charge", ...schedule.chargesByYearPercent.map(intPercent), intPercent(schedule.afterYear7Percent)]],
    { caption: schedule.tableTitle, note: `Charge basis: ${schedule.basis}.` },
  );

  const access: Page = {
    title: "Accessing Money",
    body: `
<h3>Free Withdrawal</h3>
<p>${esc(f.freeWithdrawal.display)}</p>
${scheduleTable}
<h3>Market Value Adjustment</h3>
<p>${esc(f.marketValueAdjustment.display)}</p>
<h3>Death Benefit</h3>
<p>${esc(f.deathBenefit.display)}</p>`,
  };

  const annuitization: Page = {
    title: "Annuitization Options",
    body: `
<ul>${f.annuitizationOptions.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
<h3>Optional Riders</h3>
<p>${esc(f.optionalRiders.display)}</p>`,
  };

  const taxAndReplacement: Page = {
    title: "Tax Notes, Replacement Disclosure and 65+ Suitability Review",
    body: `
<h3>Tax Notes</h3>
<p>${esc(f.taxNote.display)}</p>
<h3>Replacement Disclosure</h3>
<p>${esc(f.replacement.display)}</p>
<h3>Suitability Review</h3>
<p>${esc(f.suitability.display)}</p>
<p class="fine">This demonstration document describes a fictional product and is not an offer,
a suitability determination, tax advice, legal advice, or an insurance recommendation.
For any decision, consult a licensed professional.</p>`,
  };

  return renderDocument(product, [
    coverPage(product, f.productType),
    overview,
    rates,
    access,
    annuitization,
    taxAndReplacement,
  ]);
}
