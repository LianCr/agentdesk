import { spawn, type ChildProcess } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import {
  annuityVsIulClientC,
  iulVsAnnuityClientC,
  termVsIulClientA,
  termVsIulNoClient,
} from "./comparison-fixtures";
import type { ComparisonDraftView } from "../../components/comparison/types";

// Mocked-browser tests for the M4-C comparison experience (matrix 1-34). A
// real `next dev` server is spawned; /api/compare is intercepted per test so
// the UI contract is tested without depending on model or timing. Only the
// PDF fetch, the client-bundle secret scan and the database count touch
// reality.

const ROOT = join(import.meta.dirname, "../..");
const PORT = 3124;
const BASE = `http://localhost:${PORT}`;

let server: ChildProcess;
let browser: Browser;
let context: BrowserContext;

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("next dev did not become ready");
}

beforeAll(async () => {
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: ROOT,
    stdio: "pipe",
    detached: true,
    env: process.env,
  });
  await waitForServer();
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
});

afterAll(async () => {
  await browser?.close();
  try {
    server?.kill("SIGTERM");
  } catch {
    // already gone
  }
  try {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
});

async function openCompare(
  mock?: ComparisonDraftView | { status: number; body: unknown },
): Promise<Page> {
  const page = await context.newPage();
  if (mock) {
    await page.route((url) => url.pathname === "/api/compare", async (route: Route) => {
      const isError = mock !== null && typeof mock === "object" && "status" in mock;
      await route.fulfill({
        status: isError ? (mock as { status: number }).status : 200,
        contentType: "application/json",
        body: JSON.stringify(isError ? (mock as { body: unknown }).body : mock),
      });
    });
  }
  await page.goto(`${BASE}/compare`, { waitUntil: "networkidle" });
  return page;
}

async function generate(page: Page): Promise<void> {
  await page.getByTestId("generate-comparison").click();
  await page.getByTestId("comparison-result").waitFor({ timeout: 30_000 });
}

describe("navigation and page shell (1-2)", () => {
  it("1: navigation offers both work surfaces from either page", async () => {
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    expect(await page.getByTestId("site-nav").isVisible()).toBe(true);
    expect(await page.getByTestId("nav-assistant").isVisible()).toBe(true);
    expect(await page.getByTestId("nav-compare").isVisible()).toBe(true);
    // The Knowledge Assistant keeps working and keeps its name.
    expect((await page.getByTestId("hero-title").innerText()).trim()).toBe("AgentDesk");
    await page.getByTestId("nav-compare").click();
    await page.waitForURL("**/compare");
    expect(await page.getByTestId("compare-title").isVisible()).toBe(true);
    await page.close();
  });

  it("2: /compare loads with its purpose and boundary stated", async () => {
    const page = await openCompare();
    expect(await page.getByTestId("compare-title").isVisible()).toBe(true);
    const tagline = await page.getByTestId("compare-tagline").innerText();
    expect(tagline).toContain("仅供经纪人内部审核");
    expect(tagline).toContain("not a recommendation");
    expect(await page.getByTestId("demo-disclaimer").isVisible()).toBe(true);
    await page.close();
  });
});

describe("selection controls (3-6)", () => {
  it("3: all three fictional products are selectable on both sides", async () => {
    const page = await openCompare();
    for (const testId of ["select-product-a", "select-product-b"]) {
      const options = await page.getByTestId(testId).locator("option").allInnerTexts();
      expect(options).toHaveLength(3);
      expect(options.join(" ")).toContain("Demo TermPlus 20");
      expect(options.join(" ")).toContain("Demo IndexFlex UL");
      expect(options.join(" ")).toContain("Demo SecureRate 5");
    }
    await page.close();
  });

  it("4: client selector offers no-client plus the three demo clients", async () => {
    const page = await openCompare();
    const options = await page.getByTestId("select-client").locator("option").allInnerTexts();
    expect(options).toHaveLength(4);
    expect(options[0]).toContain("不绑定客户");
    expect(options.join(" ")).toContain("Demo Client A");
    expect(options.join(" ")).toContain("Demo Client C");
    await page.close();
  });

  it("5: selecting the same product twice blocks generation", async () => {
    const page = await openCompare();
    await page.getByTestId("select-product-b").selectOption("doc_termplus20_v1");
    await page.getByTestId("select-product-a").selectOption("doc_termplus20_v1");
    expect(await page.getByTestId("duplicate-product-warning").isVisible()).toBe(true);
    expect(await page.getByTestId("generate-comparison").isDisabled()).toBe(true);
    await page.close();
  });

  it("6: the demo default is never labelled recommended or best", async () => {
    const page = await openCompare();
    const controls = await page.getByTestId("comparison-controls").innerText();
    expect(controls.toLowerCase()).not.toMatch(/recommend|best|suggested|推荐|最佳|建议选择/);
    await page.close();
  });
});

describe("deterministic result rendering (7-13)", () => {
  it("7-9: core dimensions render by default; one click shows all 13 rows", async () => {
    const page = await openCompare(termVsIulNoClient);
    await generate(page);
    expect(await page.getByTestId("comparison-status").getAttribute("data-status")).toBe("complete");
    // Default is the registry's own core set -- a code-owned flag, not a model
    // choice or a UI invention.
    const coreCount = termVsIulNoClient.dimensions.filter((row) => row.core).length;
    expect(await page.getByTestId("comparison-row").count()).toBe(coreCount);
    await page.getByTestId("table-expand").click();
    // The complete 13-row table is one click away, nothing dropped.
    expect(await page.getByTestId("comparison-row").count()).toBe(13);
    await page.getByTestId("table-collapse").click();
    expect(await page.getByTestId("comparison-row").count()).toBe(coreCount);
    await page.close();
  });

  it("10: both product columns are present and named", async () => {
    const page = await openCompare(termVsIulNoClient);
    await generate(page);
    expect((await page.getByTestId("column-a").innerText()).trim()).toBe("Demo TermPlus 20");
    expect((await page.getByTestId("column-b").innerText()).trim()).toBe("Demo IndexFlex UL");
    await page.close();
  });

  it("11-13: available, not-applicable and not-provided render distinctly", async () => {
    const page = await openCompare(termVsIulNoClient);
    await generate(page);
    // The only not_provided cell in this fixture lives in a non-core row.
    await page.getByTestId("table-expand").click();

    const productType = page.locator('[data-dimension="product_type"]');
    expect(await productType.innerText()).toContain("20-Year Level Term Life Insurance");

    const naCell = page.locator('[data-testid="comparison-cell"][data-availability="not_applicable"]').first();
    expect(await naCell.innerText()).toContain("不适用");
    expect(await naCell.innerText()).toContain("Not applicable");

    const npCell = page.locator('[data-testid="comparison-cell"][data-availability="not_provided"]').first();
    expect(await npCell.innerText()).toContain("演示资料未提供");
    expect(await npCell.innerText()).toContain("Not provided in demo materials");

    // A documented negative is a fact, not an absence.
    const cashValueRow = page.locator('[data-dimension="cash_value"]');
    expect(await cashValueRow.innerText()).toContain("does not accumulate cash value");
    expect(await cashValueRow.innerText()).not.toContain("Not provided");
    await page.close();
  });
});

describe("citations (14-17)", () => {
  it("14-16: a citation shows document, page, section and the exact quote", async () => {
    const page = await openCompare(termVsIulNoClient);
    await generate(page);
    // Scoped to the table: the observation cards above it have their own
    // citation popovers now.
    await page.locator('[data-testid="comparison-table"] [data-testid="citation-toggle"]').first().click();
    const detail = page.getByTestId("citation-detail").first();
    expect(await detail.innerText()).toContain("Demo TermPlus 20 Product Guide");
    expect(await detail.innerText()).toContain("第 2 页");
    expect(await detail.innerText()).toContain("At a Glance");
    expect((await page.getByTestId("citation-quote").first().innerText()).trim()).toBe("20-Year Level Term Life Insurance");
    await page.close();
  });

  it("17: the PDF link targets the right document and page, and resolves", async () => {
    const page = await openCompare(termVsIulNoClient);
    await generate(page);
    await page.locator('[data-testid="comparison-table"] [data-testid="citation-toggle"]').first().click();
    const href = await page.getByTestId("citation-link").first().getAttribute("href");
    expect(href).toBe("/documents/demo-termplus-20.pdf#page=2");
    const res = await page.request.get(`${BASE}${href!.split("#")[0]}`);
    expect(res.status()).toBe(200);
    await page.close();
  });

  it("no chunk ids, similarity or diagnostics leak into the page", async () => {
    const page = await openCompare(annuityVsIulClientC);
    await generate(page);
    for (const toggle of await page.getByTestId("citation-toggle").all()) await toggle.click();
    const body = await page.innerText("body");
    expect(body).not.toMatch(/chunkId|:c\d{3}|similarity|candidateChunkCount|anchorPages/i);
    await page.close();
  });
});

describe("derived facts and observations (18-19)", () => {
  it("18: a derived fact is labelled as derived from the table, not AI-inferred", async () => {
    const page = await openCompare(annuityVsIulClientC);
    await generate(page);
    const derived = page.getByTestId("derived-label").first();
    expect(await derived.innerText()).toContain("按资料表格计算");
    expect(await derived.innerText()).toContain("Calculated from the documented table");
    const body = await page.innerText("body");
    expect(body).not.toMatch(/AI inferred|AI 推断/i);
    // The wording never claims the document states a seven-year period.
    const liquidity = await page.locator('[data-dimension="surrender_liquidity"]').innerText();
    expect(liquidity).toContain("退保费用表");
    expect(liquidity).not.toContain("七年退保期");
    await page.close();
  });

  it("19: the SecureRate 5/7 observation renders with both cited sources", async () => {
    const page = await openCompare(annuityVsIulClientC);
    await generate(page);
    const card = page.locator('[data-observation-type="RATE_GUARANTEE_SHORTER_THAN_SURRENDER"]');
    expect(await card.isVisible()).toBe(true);
    expect(await card.innerText()).toContain("初始利率保证期为 5 个合同年");
    expect(await card.innerText()).toContain("contract year 7");
    // Sources moved into the same quiet popover the table cells use: one
    // trigger on the card, quotes and page deep-links inside.
    expect(await card.getByTestId("citation-toggle").count()).toBe(1);
    await card.getByTestId("citation-toggle").click();
    await card.getByTestId("citation-details").waitFor();
    const details = await card.getByTestId("citation-detail").count();
    expect(details).toBeGreaterThanOrEqual(2);
    expect(await card.getByTestId("citation-link").count()).toBe(details);
    // No judgement, no advice.
    const text = await card.innerText();
    expect(text).not.toMatch(/风险|不划算|建议|should|avoid|worse/i);
    await page.close();
  });
});

describe("client context, missing information and review (20-23)", () => {
  it("20: the client summary shows only known synthetic fields", async () => {
    const page = await openCompare(termVsIulClientA);
    await generate(page);
    const summary = page.getByTestId("client-summary");
    expect(await summary.innerText()).toContain("Demo Client A");
    expect(await summary.innerText()).toContain("38");
    // Tobacco use is unknown in the fixture and must not be invented here.
    expect(await summary.innerText()).not.toMatch(/tobacco|吸烟/i);
    await page.close();
  });

  it("21: no-client mode works and says so instead of inventing gaps", async () => {
    const page = await openCompare(termVsIulNoClient);
    await generate(page);
    expect(await page.getByTestId("client-summary").count()).toBe(0);
    expect(await page.getByTestId("missing-info").getAttribute("data-mode")).toBe("no-client");
    expect(await page.getByTestId("missing-info-item").count()).toBe(0);
    await page.close();
  });

  it("22: missing information renders as a checklist with reasons", async () => {
    const page = await openCompare(termVsIulClientA);
    await generate(page);
    expect(await page.getByTestId("missing-info-item").count()).toBeGreaterThan(0);
    const tobacco = page.locator('[data-field="tobaccoUse"]');
    expect(await tobacco.innerText()).toContain("吸烟状况");
    expect(await tobacco.innerText()).toContain("影响 Affects");
    // A gap is not a verdict.
    const text = await page.getByTestId("missing-info").innerText();
    expect(text).not.toMatch(/unsuitable|high risk|低风险|高风险|不适合/i);
    await page.close();
  });

  it("23: the review banner lists reasons and separates demo rules from facts", async () => {
    const page = await openCompare(annuityVsIulClientC);
    await generate(page);
    const banner = page.getByTestId("review-banner");
    expect(await banner.innerText()).toContain("需要经纪人审核");
    expect(await banner.locator('[data-flag="AGE_65_PLUS"]').innerText()).toContain("本 Demo 规则");
    expect(await banner.locator('[data-flag="NON_GUARANTEED_ELEMENTS"]').innerText()).toContain("文档事实");
    expect(await banner.innerText()).toContain("not universal legal requirements");
    await page.close();
  });
});

describe("narrative is optional and subordinate (24-25)", () => {
  it("24: the narrative loads separately, after the table is already usable", async () => {
    const page = await openCompare(termVsIulNoClient);
    await page.route("**/api/compare/narrative", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          narrativeStatus: "available",
          narrativeSections: [
            {
              headingZh: "已记录的差异",
              headingEn: "Documented differences",
              text: "Only one of the products documents a personalized-illustration requirement.",
            },
          ],
        }),
      });
    });
    await generate(page);
    // Table first.
    expect(await page.getByTestId("comparison-table").isVisible()).toBe(true);
    expect(await page.getByTestId("narrative-section").count()).toBe(0);
    await page.getByTestId("load-narrative").click();
    expect(await page.getByTestId("narrative-section").count()).toBe(1);
    const panel = await page.getByTestId("narrative-panel").innerText();
    expect(panel).toContain("基于已核验事实的说明");
    expect(panel.toLowerCase()).not.toMatch(/ai recommendation|advisor recommendation|best option/);
    await page.close();
  });

  it("25: a narrative failure leaves the table and every deterministic block intact", async () => {
    const page = await openCompare(annuityVsIulClientC);
    await page.route("**/api/compare/narrative", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ narrativeStatus: "unavailable", narrativeSections: [] }),
      });
    });
    await generate(page);
    const rowsBefore = await page.getByTestId("comparison-row").count();
    await page.getByTestId("load-narrative").click();
    expect(await page.getByTestId("narrative-unavailable").isVisible()).toBe(true);
    expect(await page.getByTestId("narrative-unavailable").innerText()).toContain("可选说明暂不可用");
    expect(await page.getByTestId("comparison-row").count()).toBe(rowsBefore);
    expect(await page.getByTestId("observation-list").isVisible()).toBe(true);
    expect(await page.getByTestId("review-banner").isVisible()).toBe(true);
    // No error page.
    expect(await page.getByTestId("comparison-error").count()).toBe(0);
    await page.close();
  });
});

describe("neutrality and symmetry (26-28)", () => {
  it("26-27: no winner, ranking, score, confidence or similarity anywhere", async () => {
    const page = await openCompare(annuityVsIulClientC);
    await generate(page);
    const body = (await page.innerText("body")).toLowerCase();
    for (const word of ["winner", "best choice", "recommended product", "score", "confidence", "similarity", "★", "更优", "胜出"]) {
      expect(body, `found "${word}"`).not.toContain(word.toLowerCase());
    }
    // Both product columns get identical styling hooks.
    const classes = await page
      .locator('[data-testid="column-a"], [data-testid="column-b"]')
      .evaluateAll((els) => els.map((e) => e.className));
    expect(new Set(classes).size).toBe(1);
    await page.close();
  });

  it("28: reversing the products swaps columns without changing the facts", async () => {
    const forward = await openCompare(annuityVsIulClientC);
    await generate(forward);
    await forward.getByTestId("table-expand").click();
    const forwardCells = await forward
      .locator('[data-testid="comparison-cell"]')
      .evaluateAll((els) => els.map((e) => `${e.getAttribute("data-product")}|${e.textContent?.trim().slice(0, 60)}`));
    await forward.close();

    const reverse = await openCompare(iulVsAnnuityClientC);
    await generate(reverse);
    await reverse.getByTestId("table-expand").click();
    const reverseCells = await reverse
      .locator('[data-testid="comparison-cell"]')
      .evaluateAll((els) => els.map((e) => `${e.getAttribute("data-product")}|${e.textContent?.trim().slice(0, 60)}`));
    expect((await reverse.getByTestId("column-a").innerText()).trim()).toBe("Demo IndexFlex UL");
    await reverse.close();

    // Same set of (product, value) pairs; only the order differs.
    expect([...reverseCells].sort()).toEqual([...forwardCells].sort());
  });
});

describe("responsive and keyboard (29-30)", () => {
  it("29: mobile has no page-level horizontal overflow", async () => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route((url) => url.pathname === "/api/compare", async (route: Route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(termVsIulClientA) });
    });
    await page.goto(`${BASE}/compare`, { waitUntil: "networkidle" });
    await generate(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
    await page.close();
  });

  it("30: the form is keyboard operable and every control is labelled", async () => {
    const page = await openCompare(termVsIulNoClient);
    const labelled = await page.evaluate(() =>
      ["select-client", "select-product-a", "select-product-b"].every((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        return el?.closest("label") !== null;
      }),
    );
    expect(labelled).toBe(true);
    await page.getByTestId("generate-comparison").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("comparison-result").waitFor({ timeout: 30_000 });
    await page.close();
  });
});

describe("error handling (31-32)", () => {
  it("31: a 400 shows a safe bilingual message and no stack trace", async () => {
    const page = await openCompare({
      status: 400,
      body: { error: "DUPLICATE_PRODUCT", message: "请选择两个不同的产品。Please select two different products." },
    });
    await page.getByTestId("generate-comparison").click();
    const error = page.getByTestId("comparison-error");
    // Wait for the render rather than assuming it beat the assertion: the
    // original form flaked whenever the machine was busy, which said nothing
    // about the error path itself.
    await error.waitFor({ timeout: 30_000 });
    expect(await error.isVisible()).toBe(true);
    expect(await error.innerText()).toContain("Please select two different products");
    expect(await error.innerText()).not.toMatch(/at \w+ \(|node_modules|Error:/);
    await page.close();
  });

  it("32: a 500 shows a generic message and never leaks internals", async () => {
    const page = await openCompare({
      status: 500,
      body: { error: "COMPARISON_FAILED", message: "生成比较草稿时出现问题，请重试。Something went wrong while building the comparison." },
    });
    await page.getByTestId("generate-comparison").click();
    const error = page.getByTestId("comparison-error");
    // Wait for the render rather than assuming it beat the assertion: the
    // original form flaked whenever the machine was busy, which said nothing
    // about the error path itself.
    await error.waitFor({ timeout: 30_000 });
    expect(await error.isVisible()).toBe(true);
    expect(await error.innerText()).not.toMatch(/stack|node_modules|SUPABASE|OPENAI|sk-/i);
    await page.close();
  });
});

describe("reality checks (33-34)", () => {
  it("33: no secret reaches the client bundle", async () => {
    const page = await openCompare(termVsIulNoClient);
    await generate(page);
    await page.close();

    const chunkDir = join(ROOT, ".next/static/chunks");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".js")) files.push(full);
      }
    };
    try {
      walk(chunkDir);
    } catch {
      // dev server may not have emitted static chunks yet
    }
    const secretNames = ["SUPABASE_SECRET_KEY", "OPENAI_API_KEY", "SUPABASE_DB_URL"];
    const secretValues = [process.env.SUPABASE_SECRET_KEY, process.env.OPENAI_API_KEY, process.env.SUPABASE_DB_URL]
      .filter((v): v is string => typeof v === "string" && v.length > 8);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const name of secretNames) expect(content.includes(name), `${name} in ${file}`).toBe(false);
      for (const value of secretValues) expect(content.includes(value), `secret value in ${file}`).toBe(false);
    }
  });

  it("34: the knowledge base is untouched by the comparison UI", async () => {
    const { createServiceClient } = await import("../../lib/supabase/server");
    const db = createServiceClient();
    const counts: number[] = [];
    for (const table of ["documents", "document_pages", "chunks"]) {
      const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
      expect(error).toBeNull();
      counts.push(count ?? -1);
    }
    expect(counts).toEqual([3, 20, 45]);
  });
});

describe("the client background roster (35-44)", () => {
  const roster = (page: Page) => page.getByTestId("roster-client");
  const card = (page: Page, caseId: string) => page.locator(`[data-case-id="${caseId}"]`);

  async function openRoster(mock?: ComparisonDraftView): Promise<Page> {
    const page = await openCompare(mock);
    await page.getByTestId("roster-toggle").click();
    await page.getByTestId("roster-list").waitFor();
    return page;
  }

  it("35: the roster is collapsed until asked for, like the knowledge base", async () => {
    const page = await openCompare();
    expect(await page.getByTestId("client-roster").isVisible()).toBe(true);
    expect(await page.getByTestId("roster-summary").innerText()).toContain("3 位演示客户");
    expect(await page.getByTestId("roster-list").count()).toBe(0);
    expect(await page.getByTestId("roster-toggle").getAttribute("aria-expanded")).toBe("false");
    await page.getByTestId("roster-toggle").click();
    expect(await page.getByTestId("roster-toggle").getAttribute("aria-expanded")).toBe("true");
    expect(await page.getByTestId("roster-list").count()).toBe(1);
    await page.close();
  });

  it("36: every demo client is listed with their stated background", async () => {
    const page = await openRoster();
    expect(await roster(page).count()).toBe(3);
    const text = await page.getByTestId("roster-list").innerText();
    for (const name of ["Demo Client A", "Demo Client B", "Demo Client C"]) {
      expect(text).toContain(name);
    }
    const a = await card(page, "DEMO-2026-001").innerText();
    expect(a).toContain("38 岁");
    expect(a).toContain("已婚");
    // "none" is a stated fact, not a blank.
    expect(a).toContain("无 None");
    await page.close();
  });

  it("37: only the replacement case carries the replacement badge", async () => {
    const page = await openRoster();
    expect(await page.getByTestId("roster-replacement-badge").count()).toBe(1);
    expect(await card(page, "DEMO-2026-003").getByTestId("roster-replacement-badge").count()).toBe(1);
    // Employer group coverage is coverage the client HAS, not one being given up.
    expect(await card(page, "DEMO-2026-002").getByTestId("roster-replacement-badge").count()).toBe(0);
    await page.close();
  });

  it("38: the client's own words appear only where the case states them", async () => {
    const page = await openRoster();
    const c = card(page, "DEMO-2026-003");
    expect(await c.getByTestId("roster-questions").count()).toBe(1);
    expect(await c.innerText()).toContain("现在的年金利率太低");
    expect(await card(page, "DEMO-2026-001").getByTestId("roster-questions").count()).toBe(0);
    await page.close();
  });

  it("39: what the case leaves out is named, not hidden", async () => {
    const page = await openRoster();
    const gaps = await card(page, "DEMO-2026-001").getByTestId("roster-not-stated").innerText();
    expect(gaps).toContain("吸烟状况");
    expect(gaps).toContain("期望身故保额");
    await page.close();
  });

  it("40: clicking a card selects that client", async () => {
    const page = await openRoster();
    await card(page, "DEMO-2026-003").click();
    expect(await page.getByTestId("select-client").inputValue()).toBe("DEMO-2026-003");
    expect(await card(page, "DEMO-2026-003").getAttribute("data-selected")).toBe("true");
    expect(await card(page, "DEMO-2026-003").getAttribute("aria-pressed")).toBe("true");
    expect(await card(page, "DEMO-2026-001").getAttribute("data-selected")).toBe("false");
    await page.close();
  });

  it("41: a card selection is what the comparison request carries", async () => {
    const bodies: unknown[] = [];
    const page = await context.newPage();
    await page.route((url) => url.pathname === "/api/compare", async (route: Route) => {
      bodies.push(JSON.parse(route.request().postData() ?? "null"));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(annuityVsIulClientC),
      });
    });
    await page.goto(`${BASE}/compare`, { waitUntil: "networkidle" });
    await page.getByTestId("roster-toggle").click();
    await card(page, "DEMO-2026-003").click();
    await generate(page);
    expect((bodies[0] as { clientCaseId?: string }).clientCaseId).toBe("DEMO-2026-003");
    await page.close();
  });

  it("42: the roster adds to the dropdown, it does not replace it", async () => {
    const page = await openRoster();
    // Re-pins test 4's contract: the select is still how you clear a client.
    const options = await page.getByTestId("select-client").locator("option").allInnerTexts();
    expect(options).toHaveLength(4);
    await card(page, "DEMO-2026-003").click();
    await page.getByTestId("select-client").selectOption("");
    expect(await card(page, "DEMO-2026-003").getAttribute("data-selected")).toBe("false");
    await page.close();
  });

  it("43: the roster shows no fixture ground truth and no untranslated source strings", async () => {
    const page = await openRoster();
    const text = await page.getByTestId("roster-list").innerText();
    // riskTier and `expected` are frozen evaluation answers the runtime never
    // reads; showing them would imply the flags were looked up, not computed.
    expect(text).not.toMatch(/高风险|低风险|中等风险/);
    expect(text).not.toMatch(/age_65_plus|block_client_draft|licensed_agent_required|enhanced_review/);
    // Source values are English in the fixtures and must arrive PAIRED, never
    // bare. (The ASCII-only negative is asserted properly against the data in
    // tests/comparison/client-roster.test.ts; at this level the pairing is what
    // is observable.)
    for (const pair of ["已婚 Married", "小企业主 Small business owner", "已退休 Retired"]) {
      expect(text, `missing bilingual pair ${pair}`).toContain(pair);
    }
    expect(text).not.toMatch(/(?<![\u4e00-\u9fff]\s)\bsmall business owner\b/i);
    await page.close();
  });

  it("44: the expanded roster does not push a phone screen sideways", async () => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/compare`, { waitUntil: "networkidle" });
    await page.getByTestId("roster-toggle").click();
    await page.getByTestId("roster-list").waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
    await page.close();
  });
});
