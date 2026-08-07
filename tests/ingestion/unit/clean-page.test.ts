import { describe, expect, it } from "vitest";
import { cleanPage } from "../../../lib/ingestion/clean-page.js";
import type { StructuredPage } from "../../../lib/ingestion/extract-pages.js";

const FOOTER =
  "DEMONSTRATION DOCUMENT — FICTIONAL PRODUCT — NOT FOR SALE | Test Carrier (Fictional) | Page 2 of 6";

function page(lines: Array<[string, number]>): StructuredPage {
  return { page: 2, lines: lines.map(([text, height], i) => ({ text, height, y: 700 - i * 20 })) };
}

const BODY = "This policy does not accumulate cash value and remains in force per policy terms.";
const DISCLOSURE =
  "This demonstration document describes a fictional product and is not an offer or a recommendation.";

describe("cleanPage", () => {
  it("removes exactly the footer and records it in excludedText", () => {
    const cleaned = cleanPage(page([[BODY, 10.5], [DISCLOSURE, 8.5], [FOOTER, 7.5]]), FOOTER);
    expect(cleaned.excludedText).toEqual([FOOTER]);
    expect(cleaned.cleanText).not.toContain("Page 2 of 6");
    expect(cleaned.rawText).toContain("Page 2 of 6");
  });

  it("preserves disclosures and negative facts verbatim", () => {
    const cleaned = cleanPage(page([[BODY, 10.5], [DISCLOSURE, 8.5], [FOOTER, 7.5]]), FOOTER);
    expect(cleaned.cleanText).toContain("does not accumulate cash value");
    expect(cleaned.cleanText).toContain(DISCLOSURE);
  });

  it("fails when no footer line matches", () => {
    expect(() => cleanPage(page([[BODY, 10.5], [DISCLOSURE, 8.5]]), FOOTER)).toThrow(/footer/);
  });

  it("fails when the footer matches more than once", () => {
    expect(() =>
      cleanPage(page([[BODY, 10.5], [FOOTER, 7.5], [FOOTER, 7.5]]), FOOTER),
    ).toThrow(/matched 2/);
  });

  it("fails on empty or near-empty pages", () => {
    expect(() => cleanPage(page([["Short.", 10.5], [FOOTER, 7.5]]), FOOTER)).toThrow(/too short/);
  });

  it("is deterministic for identical input", () => {
    const input = page([[BODY, 10.5], [DISCLOSURE, 8.5], [FOOTER, 7.5]]);
    expect(cleanPage(input, FOOTER)).toEqual(cleanPage(input, FOOTER));
  });
});
