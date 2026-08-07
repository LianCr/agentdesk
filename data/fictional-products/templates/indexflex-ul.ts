import type { ProductDefinition } from "../../../lib/schemas";
import { usd } from "../../../lib/format";
import { coverPage, dataTable, esc, kvTable, renderDocument, type Page } from "./layout";

// Demo IndexFlex UL — 8 pages per SPEC §6.4.

interface IulFacts {
  productType: string;
  issueAges: { display: string };
  minimumFaceAmount: { display: string };
  deathBenefitOptions: Array<{ option: string; type: string }>;
  premiums: { display: string };
  noLapseGuarantee: { display: string };
  fixedAccount: { currentRateDisplay: string; guaranteedMinimumRateDisplay: string };
  indexedAccount: { display: string; indexNamingRule: string };
  floor: { display: string };
  cap: { currentRateDisplay: string; guaranteedMinimumRateDisplay: string };
  participation: { currentRateDisplay: string; guaranteedMinimumRateDisplay: string };
  rateChanges: { display: string };
  premiumCharge: { display: string };
  policyFee: { display: string };
  unitCharge: { display: string };
  costOfInsurance: { display: string };
  surrenderCharge: { display: string };
  loans: { display: string };
  withdrawals: { display: string };
  riders: Array<{ name: string; display: string }>;
  nonGuaranteedElements: string[];
  illustration: { display: string };
  disclosures: string[];
  requiredPage8Sentence: string;
  surrenderChargeSchedule: {
    basis: string;
    chargesByYear: number[];
    afterYear10: number;
    tableTitle: string;
  };
}

export function buildIndexFlexHtml(product: ProductDefinition): string {
  const f = product.facts as unknown as IulFacts;

  const overview: Page = {
    title: "Overview and Death Benefit Options",
    body: `
${kvTable([
  ["Product Type", f.productType],
  ["Minimum Face Amount", f.minimumFaceAmount.display],
  ["Premiums", f.premiums.display],
])}
<h3>Death Benefit Options</h3>
<ul>${f.deathBenefitOptions
      .map((o) => `<li>${esc(o.option)} — ${esc(o.type)} death benefit</li>`)
      .join("")}</ul>`,
  };

  const eligibility: Page = {
    title: "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
    body: `
${kvTable([
  ["Issue Ages", f.issueAges.display],
  ["Premiums", f.premiums.display],
])}
<h3>Five-Year No-Lapse Guarantee</h3>
<p>${esc(f.noLapseGuarantee.display)}</p>`,
  };

  const fixedAndCharges: Page = {
    title: "Fixed Account and Charges",
    body: `
<h3>Fixed Account</h3>
${kvTable([
  ["Current Rate", f.fixedAccount.currentRateDisplay],
  ["Guaranteed Minimum Rate", f.fixedAccount.guaranteedMinimumRateDisplay],
])}
<h3>Policy Charges</h3>
${kvTable([
  ["Premium Charge", f.premiumCharge.display],
  ["Policy Fee", f.policyFee.display],
  ["Unit Charge", f.unitCharge.display],
  ["Cost of Insurance", f.costOfInsurance.display],
])}`,
  };

  const indexedMechanics: Page = {
    title: "Indexed Account Mechanics",
    body: `
<p>The indexed account is linked to ${esc(f.indexedAccount.indexNamingRule)}.</p>
<p>${esc(f.indexedAccount.display)}</p>
${kvTable([
  ["Floor", `${f.floor.display} guaranteed`],
  ["Cap", `${f.cap.currentRateDisplay} current; guaranteed minimum cap ${f.cap.guaranteedMinimumRateDisplay}`],
  ["Participation Rate", `${f.participation.currentRateDisplay} current; guaranteed minimum ${f.participation.guaranteedMinimumRateDisplay}`],
])}
<p>${esc(f.rateChanges.display)}</p>`,
  };

  const schedule = f.surrenderChargeSchedule;
  const scheduleTable = dataTable(
    ["Policy Year", ...schedule.chargesByYear.map((_, i) => String(i + 1)), "11+"],
    [["Charge", ...schedule.chargesByYear.map(usd), usd(schedule.afterYear10)]],
    { caption: schedule.tableTitle },
  );

  const surrenderLoans: Page = {
    title: "Surrender Charge Schedule, Loans and Withdrawals",
    body: `
<p>${esc(f.surrenderCharge.display)} The charge is ${esc(schedule.basis)}.</p>
${scheduleTable}
<h3>Loans</h3>
<p>${esc(f.loans.display)}</p>
<h3>Withdrawals</h3>
<p>${esc(f.withdrawals.display)}</p>`,
  };

  const riders: Page = {
    title: "Riders",
    body: f.riders
      .map((r) => `<h3>${esc(r.name)}</h3><p>${esc(r.display)} See policy terms.</p>`)
      .join(""),
  };

  const disclosures: Page = {
    title: "Disclosures",
    body: `
<h3>Personalized Illustration</h3>
<p>${esc(f.illustration.display)}</p>
<p>${esc(f.requiredPage8Sentence)}</p>
<h3>Non-Guaranteed Elements</h3>
<ul>${f.nonGuaranteedElements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
<h3>Exclusions and Limitations</h3>
<p>Suicide within two years results in a refund of premiums paid. A two-year contestability
period applies. Material misrepresentation may affect coverage.</p>
<h3>Important Notes</h3>
<ul>${f.disclosures.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
<p class="fine">This demonstration document describes a fictional product and is not an offer,
an illustration, a suitability determination, tax advice, legal advice, or an insurance
recommendation. For any decision, consult a licensed professional.</p>`,
  };

  return renderDocument(product, [
    coverPage(product, f.productType),
    overview,
    eligibility,
    fixedAndCharges,
    indexedMechanics,
    surrenderLoans,
    riders,
    disclosures,
  ]);
}
