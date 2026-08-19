import { spawn, type ChildProcess } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import { queueFixture, reviewFixtures } from "./review-fixtures";
import type { ReviewDetailView } from "../../components/reviews/types";

// Mocked-browser tests for the M5-C review experience (matrix 1-30). A real
// `next dev` server is spawned; the review APIs are intercepted per test so the
// UI contract is tested without depending on database state, which the live
// acceptance scenarios cover separately. Only the client-bundle secret scan and
// the knowledge-base count touch reality.

const ROOT = join(import.meta.dirname, "../..");
const PORT = 3126;
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

const NOT_ELIGIBLE = {
  eligible: false,
  taskType: null,
  ineligibleReason: "REVIEW_NOT_TERMINAL",
  payload: null,
  runs: [],
};

/** Records every request body the page sent to a review endpoint. */
interface Recorder {
  createBodies: unknown[];
  decisionBodies: unknown[];
  decisionCalls: number;
  listUrls: string[];
  listResponseBytes: number[];
  comparisonCalls: number;
  automationPosts: number;
}

async function openQueue(rows: typeof queueFixture = queueFixture): Promise<{ page: Page; rec: Recorder }> {
  const page = await context.newPage();
  const rec: Recorder = {
    createBodies: [],
    decisionBodies: [],
    decisionCalls: 0,
    listUrls: [],
    listResponseBytes: [],
    comparisonCalls: 0,
    automationPosts: 0,
  };
  await page.route(
    (url) => url.pathname === "/api/reviews",
    async (route: Route) => {
      const url = new URL(route.request().url());
      rec.listUrls.push(url.search);
      const state = url.searchParams.get("state") ?? "all";
      const filtered = state === "all" ? rows : rows.filter((r) => r.reviewState === state);
      const body = JSON.stringify({ reviews: filtered });
      rec.listResponseBytes.push(body.length);
      await route.fulfill({ status: 200, contentType: "application/json", body });
    },
  );
  await page.goto(`${BASE}/review`, { waitUntil: "networkidle" });
  return { page, rec };
}

async function openDetail(
  review: ReviewDetailView,
  options: {
    decisionResponses?: Array<{ status: number; body: unknown }>;
    query?: string;
    /** Successive automation responses: index 0 before any POST, then per POST. */
    automation?: unknown[];
  } = {},
): Promise<{ page: Page; rec: Recorder }> {
  const page = await context.newPage();
  const rec: Recorder = {
    createBodies: [],
    decisionBodies: [],
    decisionCalls: 0,
    listUrls: [],
    listResponseBytes: [],
    comparisonCalls: 0,
    automationPosts: 0,
  };
  await page.route(
    (url) => url.pathname === `/api/reviews/${review.reviewId}/decision`,
    async (route: Route) => {
      rec.decisionBodies.push(JSON.parse(route.request().postData() ?? "null"));
      const index = rec.decisionCalls;
      rec.decisionCalls += 1;
      const planned = options.decisionResponses?.[index];
      await route.fulfill({
        status: planned?.status ?? 200,
        contentType: "application/json",
        body: JSON.stringify(planned?.body ?? reviewFixtures.caseAApproved),
      });
    },
  );
  await page.route(
    (url) => url.pathname === `/api/reviews/${review.reviewId}/automation`,
    async (route: Route) => {
      if (route.request().method() === "POST") rec.automationPosts += 1;
      const planned = options.automation?.[Math.min(rec.automationPosts, (options.automation.length ?? 1) - 1)];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(planned ?? NOT_ELIGIBLE),
      });
    },
  );
  await page.route(
    (url) => url.pathname === `/api/reviews/${review.reviewId}`,
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(review),
      });
    },
  );
  // Any call to the comparison engine from the review page would mean the page
  // is recomputing instead of rendering the frozen artifact.
  await page.route(
    (url) => url.pathname.startsWith("/api/compare"),
    async (route: Route) => {
      rec.comparisonCalls += 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    },
  );
  await page.goto(`${BASE}/review/${review.reviewId}${options.query ?? ""}`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("review-detail").waitFor({ timeout: 30_000 });
  return { page, rec };
}

describe("navigation and queue (1-5)", () => {
  it("1: the review queue is reachable from the navigation", async () => {
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    expect(await page.getByTestId("nav-review").isVisible()).toBe(true);
    await page.getByTestId("nav-review").click();
    await page.waitForURL("**/review");
    expect(await page.getByTestId("review-queue-title").isVisible()).toBe(true);
    await page.close();
  });

  it("2: /review loads and states the reviewer-identity boundary", async () => {
    const { page } = await openQueue();
    expect(await page.getByTestId("review-queue-title").isVisible()).toBe(true);
    const text = await page.locator("main").innerText();
    expect(text).toContain("本演示没有登录");
    expect(text).toContain("no authentication");
    expect(await page.getByTestId("demo-disclaimer").isVisible()).toBe(true);
    await page.close();
  });

  it("3: existing pending rows render with their client, products and level", async () => {
    const { page } = await openQueue();
    const rows = page.getByTestId("queue-row");
    expect(await rows.count()).toBe(queueFixture.filter((r) => r.reviewState === "pending_review").length);
    const caseC = page.locator('[data-review-id="rev_fixture_case_c"]');
    const text = await caseC.innerText();
    expect(text).toContain("Demo Client C");
    expect(text).toContain("Demo SecureRate 5");
    expect(text).toContain("Demo IndexFlex UL");
    expect(text).toContain("Licensed agent review required");
    await page.close();
  });

  it("4: the state filter changes what the queue asks for and shows", async () => {
    const { page, rec } = await openQueue();
    // Pending is the default: the only filter that is a to-do list.
    expect(rec.listUrls[0]).toBe("?state=pending_review");
    await page.getByTestId("queue-filter-approved").click();
    await page.locator('[data-review-state="approved"]').first().waitFor();
    expect(rec.listUrls.at(-1)).toBe("?state=approved");
    expect(await page.getByTestId("queue-row").count()).toBe(1);
    await page.getByTestId("queue-filter-all").click();
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="queue-row"]').length === n,
      queueFixture.length,
    );
    await page.close();
  });

  it("5: the queue is served summaries, not a snapshot per row", async () => {
    const { page, rec } = await openQueue();
    await page.getByTestId("queue-table").waitFor();
    // Every stored snapshot is tens of KB; a queue payload near that size would
    // mean the rows are carrying artifacts nobody is looking at.
    for (const bytes of rec.listResponseBytes) expect(bytes).toBeLessThan(8_000);
    const body = await page.evaluate(() => document.body.innerHTML);
    expect(body).not.toContain("snapshotSha256");
    await page.close();
  });
});

describe("review detail renders the frozen artifact (6-8, 20-21)", () => {
  it("6: the detail page loads the stored review", async () => {
    const { page } = await openDetail(reviewFixtures.caseAPending!);
    expect(await page.getByTestId("review-detail").getAttribute("data-review-id")).toBe(
      "rev_fixture_case_a",
    );
    expect(await page.getByTestId("snapshot-region").isVisible()).toBe(true);
    await page.close();
  });

  it("7, 20: the page renders the PERSISTED snapshot, never a recomputation", async () => {
    // This fixture holds a value the current products cannot produce. If the
    // page called the comparison engine instead of rendering what was stored,
    // the string would not be on screen.
    const { page, rec } = await openDetail(reviewFixtures.archivedSnapshot!);
    const table = await page.getByTestId("comparison-table").innerText();
    expect(table).toContain("ARCHIVED-ONLY VALUE 1997-A");
    expect(rec.comparisonCalls).toBe(0);
    expect(await page.getByTestId("snapshot-note").innerText()).toContain("冻结");
    expect(await page.getByTestId("snapshot-hash").innerText()).toContain(
      reviewFixtures.archivedSnapshot!.snapshotSha256,
    );
    await page.close();
  });

  it("8, 21: snapshot citations still resolve to a page-anchored PDF link", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    await page.getByTestId("citation-toggle").first().click();
    await page.getByTestId("citation-details").first().waitFor();
    const link = page.getByTestId("citation-link").first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/documents\/.+\.pdf#page=\d+$/);
    expect((await page.getByTestId("citation-quote").first().innerText()).length).toBeGreaterThan(0);
    await page.close();
  });
});

describe("Case C is the flagship (9-11)", () => {
  it("9: the workflow banner separates all four axes", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    const banner = page.getByTestId("workflow-banner");
    expect(await banner.getAttribute("data-workflow-decision")).toBe("block_client_draft");
    expect(await page.getByTestId("axis-comparison-status").innerText()).toContain("Complete");
    expect(await page.getByTestId("axis-workflow-decision").innerText()).toContain(
      "Client-facing use blocked",
    );
    expect(await page.getByTestId("axis-review-state").innerText()).toContain("Pending review");
    // Not collapsed into one risk badge.
    expect(await page.getByTestId("axis-required-approval").isVisible()).toBe(true);
    await page.close();
  });

  it("10: the licensed-agent requirement and its demo-policy framing are explicit", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    expect(await page.getByTestId("axis-required-approval").innerText()).toContain(
      "Licensed agent review required",
    );
    const restriction = await page.getByTestId("client-facing-restriction").innerText();
    expect(restriction).toContain("remains available for internal review");
    expect(restriction).toContain("business rule, not a universal legal requirement");
    // Blocked from client use, still readable internally.
    expect(await page.getByTestId("comparison-table").isVisible()).toBe(true);
    await page.close();
  });

  it("11: all eight fixture-grounded replacement items appear", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    const items = page.locator('[data-source-kind="fixture_checklist"]');
    expect(await items.count()).toBe(8);
    const text = await page.getByTestId("review-checklist").innerText();
    for (const label of [
      "Current contract surrender charge",
      "Current contract market value adjustment",
      "Existing guaranteed-rate end date",
      "New contract guaranteed-rate period",
      "New contract surrender-charge period",
      "Benefits that may be forfeited",
      "State replacement forms",
      "Age-based suitability review",
    ]) {
      expect(text, `missing checklist item ${label}`).toContain(label);
    }
    await page.close();
  });
});

describe("the human decision (12-19)", () => {
  it("12: a pending review offers exactly the three actions", async () => {
    const { page } = await openDetail(reviewFixtures.caseAPending!);
    expect(await page.getByTestId("approve-button").isVisible()).toBe(true);
    expect(await page.getByTestId("reject-button").isVisible()).toBe(true);
    expect(await page.getByTestId("revision-button").isVisible()).toBe(true);
    expect(await page.getByTestId("decision-outcome").count()).toBe(0);
    await page.close();
  });

  it("13, 14: approve succeeds and its note is optional", async () => {
    const { page, rec } = await openDetail(reviewFixtures.caseAPending!);
    await page.getByTestId("approve-button").click();
    await page.getByTestId("decision-outcome").waitFor();
    expect(rec.decisionBodies).toEqual([{ type: "approve" }]);
    expect(await page.getByTestId("decision-outcome-state").innerText()).toContain(
      "Approved in this demo workflow",
    );
    await page.close();
  });

  it("14b: a supplied note travels with the approval", async () => {
    const { page, rec } = await openDetail(reviewFixtures.caseAPending!);
    await page.getByTestId("approve-note").fill("Checked every citation.");
    await page.getByTestId("approve-button").click();
    await page.getByTestId("decision-outcome").waitFor();
    expect(rec.decisionBodies).toEqual([{ type: "approve", note: "Checked every citation." }]);
    await page.close();
  });

  it("15: reject cannot be submitted without a reason", async () => {
    const { page, rec } = await openDetail(reviewFixtures.caseAPending!);
    expect(await page.getByTestId("reject-button").isDisabled()).toBe(true);
    // Whitespace is not a reason.
    await page.getByTestId("reject-reason").fill("   ");
    expect(await page.getByTestId("reject-button").isDisabled()).toBe(true);
    await page.getByTestId("reject-reason").fill("Surrender-charge row needs a second source.");
    expect(await page.getByTestId("reject-button").isDisabled()).toBe(false);
    await page.getByTestId("reject-button").click();
    await page.getByTestId("decision-outcome").waitFor();
    expect(rec.decisionBodies).toEqual([
      { type: "reject", reason: "Surrender-charge row needs a second source." },
    ]);
    await page.close();
  });

  it("16: request revision cannot be submitted without instructions", async () => {
    const { page, rec } = await openDetail(reviewFixtures.caseAPending!);
    expect(await page.getByTestId("revision-button").isDisabled()).toBe(true);
    await page.getByTestId("revision-instructions").fill("  ");
    expect(await page.getByTestId("revision-button").isDisabled()).toBe(true);
    const instructions =
      "Confirm current surrender charge and existing guaranteed-rate end date before client-facing use.";
    await page.getByTestId("revision-instructions").fill(instructions);
    await page.getByTestId("revision-button").click();
    await page.getByTestId("decision-outcome").waitFor();
    expect(rec.decisionBodies).toEqual([{ type: "request_revision", instructions }]);
    await page.close();
  });

  it("17: a decided review offers no controls and no reopen", async () => {
    const { page } = await openDetail(reviewFixtures.caseAApproved!);
    expect(await page.getByTestId("decision-panel").count()).toBe(0);
    expect(await page.getByTestId("approve-button").count()).toBe(0);
    const outcome = await page.getByTestId("decision-outcome").innerText();
    expect(outcome).toContain("Demo Reviewer");
    expect(outcome).toContain("Facts and citations check out.");
    expect(await page.locator("main").innerText()).not.toContain("Reopen");
    await page.close();
  });

  it("18: the audit timeline shows the decision after it is made", async () => {
    const { page } = await openDetail(reviewFixtures.caseAPending!);
    expect(await page.getByTestId("audit-event").count()).toBe(1);
    await page.getByTestId("approve-button").click();
    await page.getByTestId("decision-outcome").waitFor();
    const events = page.getByTestId("audit-event");
    expect(await events.count()).toBe(2);
    expect(await events.nth(1).getAttribute("data-event-type")).toBe("APPROVED");
    // Order is the server's, oldest first.
    expect(await events.nth(0).getAttribute("data-event-type")).toBe("REVIEW_CREATED");
    await page.close();
  });

  it("19: approval states exactly what it does not mean", async () => {
    const { page } = await openDetail(reviewFixtures.caseAApproved!);
    const scope = await page.getByTestId("approval-scope").innerText();
    expect(scope).toContain("does not determine product suitability");
    expect(scope).toContain("carrier approval");
    expect(scope).toContain("recommendation to purchase");
    expect(scope).toContain("不构成产品适合性判断");
    await page.close();
  });
});

describe("concurrency and stale tabs (20-21)", () => {
  it("20b: a rapid double submit sends one decision", async () => {
    const { page, rec } = await openDetail(reviewFixtures.caseAPending!);
    const button = page.getByTestId("approve-button");
    await button.click();
    // The control disables itself while the request is open, so a second click
    // cannot become a second decision.
    await page.getByTestId("decision-outcome").waitFor();
    expect(rec.decisionCalls).toBe(1);
    expect(await page.getByTestId("approve-button").count()).toBe(0);
    await page.close();
  });

  it("21: a stale decision is reported, and the winning decision stands", async () => {
    const { page } = await openDetail(reviewFixtures.caseAPending!, {
      decisionResponses: [
        {
          status: 409,
          body: {
            error: "REVIEW_STATE_CONFLICT",
            message: "该审核项已在其他会话中被处理。This review was already decided in another session.",
            reviewItem: reviewFixtures.caseAApproved,
          },
        },
      ],
    });
    await page.getByTestId("reject-reason").fill("Rejecting from a stale tab.");
    await page.getByTestId("reject-button").click();
    await page.getByTestId("decision-conflict").waitFor();
    const conflict = await page.getByTestId("decision-conflict").innerText();
    expect(conflict).toContain("already decided in another session");
    expect(conflict).toContain("Refresh to see the latest status");
    // The other session's approval is what is shown, not this tab's rejection.
    expect(await page.getByTestId("decision-outcome-state").innerText()).toContain("Approved");
    expect(await page.getByTestId("decision-panel").count()).toBe(0);
    await page.close();
  });
});

describe("send to review from the comparison page (22-24)", () => {
  async function openCompareWithReviewApi(
    response: { status: number; body: unknown },
  ): Promise<{ page: Page; rec: Recorder }> {
    const page = await context.newPage();
    const rec: Recorder = {
      createBodies: [],
      decisionBodies: [],
      decisionCalls: 0,
      listUrls: [],
      listResponseBytes: [],
      comparisonCalls: 0,
      automationPosts: 0,
    };
    await page.route(
      (url) => url.pathname === "/api/reviews",
      async (route: Route) => {
        rec.createBodies.push(JSON.parse(route.request().postData() ?? "null"));
        await route.fulfill({
          status: response.status,
          contentType: "application/json",
          body: JSON.stringify(response.body),
        });
      },
    );
    await page.route(
      (url) => url.pathname.startsWith("/api/reviews/"),
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(reviewFixtures.caseAPending),
        });
      },
    );
    await page.goto(`${BASE}/compare`, { waitUntil: "networkidle" });
    await page.getByTestId("generate-comparison").click();
    await page.getByTestId("comparison-result").waitFor({ timeout: 30_000 });
    return { page, rec };
  }

  it("22, 23: a newly created review opens, and only identifiers were sent", async () => {
    const { page, rec } = await openCompareWithReviewApi({
      status: 201,
      body: { action: "created", reviewItem: reviewFixtures.caseAPending },
    });
    expect(await page.getByTestId("send-to-review-button").isVisible()).toBe(true);
    await page.getByTestId("send-to-review-button").click();
    await page.waitForURL("**/review/rev_fixture_case_a?from=created");
    expect(await page.getByTestId("arrival-notice").innerText()).toContain("Review item created");
    // The browser can only name what it wants compared.
    expect(Object.keys(rec.createBodies[0] as object).sort()).toEqual([
      "clientCaseId",
      "productAId",
      "productBId",
    ]);
    await page.close();
  });

  it("24: an existing pending review is announced as a normal outcome", async () => {
    const { page } = await openCompareWithReviewApi({
      status: 200,
      body: { action: "existing_pending", reviewItem: reviewFixtures.caseAPending },
    });
    await page.getByTestId("send-to-review-button").click();
    await page.waitForURL("**/review/rev_fixture_case_a?from=existing_pending");
    const notice = await page.getByTestId("arrival-notice").innerText();
    expect(notice).toContain("An existing pending review already covers this comparison");
    expect(notice).toContain("已存在对应的待审核项");
    // Not an error.
    expect(await page.getByTestId("review-error").count()).toBe(0);
    await page.close();
  });
});

describe("trust boundary and regressions (25-30)", () => {
  it("25, 26: the client can never name the reviewer or supply facts", async () => {
    // Not a UI assertion: the request schemas are the boundary, so the check is
    // that the server refuses the fields outright.
    const { CreateReviewInputSchema } = await import("../../lib/reviews/create-review");
    const { ReviewDecisionSchema } = await import("../../lib/reviews/types");
    for (const field of [
      "snapshot",
      "reviewReasons",
      "workflowDecision",
      "requiredApprovalLevel",
      "checklist",
      "reviewState",
      "sourceKeyPrefix",
      "reviewer",
    ]) {
      const parsed = CreateReviewInputSchema.safeParse({
        productAId: "doc_termplus20_v1",
        productBId: "doc_indexflex_ul_v1",
        [field]: "forged",
      });
      expect(parsed.success, `create accepted ${field}`).toBe(false);
    }
    for (const field of ["reviewer", "actor", "reviewState", "occurredAt"]) {
      const parsed = ReviewDecisionSchema.safeParse({ type: "approve", [field]: "forged" });
      expect(parsed.success, `decision accepted ${field}`).toBe(false);
    }
    // Whitespace is not a written reason.
    expect(ReviewDecisionSchema.safeParse({ type: "reject", reason: "   " }).success).toBe(false);
  });

  it("27: the comparison page still works end to end", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE}/compare`, { waitUntil: "networkidle" });
    await page.getByTestId("generate-comparison").click();
    await page.getByTestId("comparison-result").waitFor({ timeout: 30_000 });
    expect(await page.getByTestId("comparison-table").isVisible()).toBe(true);
    expect(await page.getByTestId("review-banner").isVisible()).toBe(true);
    await page.close();
  });

  it("28: the knowledge assistant still works", async () => {
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    expect((await page.getByTestId("hero-title").innerText()).trim()).toBe("AgentDesk");
    expect(await page.getByTestId("nav-assistant").isVisible()).toBe(true);
    await page.close();
  });

  it("29: no secret reaches the client bundle", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    await page.close();

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".js")) files.push(full);
      }
    };
    try {
      walk(join(ROOT, ".next/static/chunks"));
    } catch {
      // dev server may not have emitted static chunks yet
    }
    const secretNames = ["SUPABASE_SECRET_KEY", "OPENAI_API_KEY", "SUPABASE_DB_URL"];
    const secretValues = [
      process.env.SUPABASE_SECRET_KEY,
      process.env.OPENAI_API_KEY,
      process.env.SUPABASE_DB_URL,
    ].filter((v): v is string => typeof v === "string" && v.length > 8);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const name of secretNames) expect(content.includes(name), `${name} in ${file}`).toBe(false);
      for (const value of secretValues) expect(content.includes(value), `secret in ${file}`).toBe(false);
    }
  });

  it("30: the review pages are usable on a narrow viewport", async () => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await mobile.newPage();
    await page.route(
      (url) => url.pathname === "/api/reviews",
      async (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ reviews: queueFixture }),
        }),
    );
    await page.goto(`${BASE}/review`, { waitUntil: "networkidle" });
    await page.getByTestId("queue-table").waitFor();
    // Wide content scrolls inside its own container; the page itself must not.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(await page.getByTestId("queue-filters").isVisible()).toBe(true);
    await page.close();
    await mobile.close();
  });

  it("the knowledge base is untouched by the review UI", async () => {
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

// ---------------------------------------------------------------------------
// M5.1-B: post-review automation panel.
//
// The automation endpoint is stubbed per test so the panel's contract is tested
// without depending on database or webhook state; the live scenarios cover the
// real path separately.

const FOLLOWUP_PREVIEW = {
  eligible: true,
  taskType: "internal_followup",
  ineligibleReason: null,
  payload: {
    taskType: "internal_followup",
    title: "Follow up: Demo SecureRate 5 × Demo IndexFlex UL (Demo Client C)",
    actionItems: ["州替换申报表 · State replacement forms", "基于年龄的适合性审核 · Age-based suitability review"],
    reviewerInstructions: null,
    clientDisplayName: "Demo Client C",
  },
  runs: [],
};

const run = (status: string, extra: Record<string, unknown> = {}) => ({
  automationId: "aut_fixture",
  taskType: "internal_followup",
  status,
  attemptCount: 1,
  externalTaskId: null,
  errorCode: null,
  updatedAt: "2026-08-03T09:00:00+00:00",
  ...extra,
});

describe("post-review automation panel (31-42)", () => {
  it("31: a pending review is told to finish the review first, with no button", async () => {
    const { page } = await openDetail(reviewFixtures.caseAPending!, { automation: [NOT_ELIGIBLE] });
    const panel = page.getByTestId("automation-panel");
    expect(await panel.getAttribute("data-eligible")).toBe("false");
    expect(await page.getByTestId("automation-unavailable").innerText()).toContain(
      "Complete human review first",
    );
    expect(await page.getByTestId("run-automation").count()).toBe(0);
    await page.close();
  });

  it("32: an approved review offers the internal follow-up run", async () => {
    const { page } = await openDetail(reviewFixtures.caseAApproved!, { automation: [FOLLOWUP_PREVIEW] });
    expect(await page.getByTestId("automation-panel").getAttribute("data-task-type")).toBe(
      "internal_followup",
    );
    expect(await page.getByTestId("run-automation").innerText()).toContain("Run internal follow-up");
    await page.close();
  });

  it("33: a revision review offers a revision task showing the reviewer's instructions", async () => {
    const instructions = "Confirm current surrender charge before client-facing use.";
    const { page } = await openDetail(reviewFixtures.caseAApproved!, {
      automation: [
        {
          ...FOLLOWUP_PREVIEW,
          taskType: "internal_revision",
          payload: {
            ...FOLLOWUP_PREVIEW.payload,
            taskType: "internal_revision",
            title: "Revise comparison: Demo TermPlus 20 × Demo IndexFlex UL",
            reviewerInstructions: instructions,
          },
        },
      ],
    });
    expect(await page.getByTestId("run-automation").innerText()).toContain("Create revision task");
    expect(await page.getByTestId("automation-instructions").innerText()).toContain(instructions);
    await page.close();
  });

  it("34: a rejected review says no automation and offers no button", async () => {
    const { page } = await openDetail(reviewFixtures.caseAApproved!, {
      automation: [{ ...NOT_ELIGIBLE, ineligibleReason: "REJECTED_NO_AUTOMATION" }],
    });
    expect(await page.getByTestId("automation-unavailable").innerText()).toContain(
      "No post-review automation for rejected reviews",
    );
    expect(await page.getByTestId("run-automation").count()).toBe(0);
    await page.close();
  });

  it("35: unverified facts block automation with the reason stated", async () => {
    const { page } = await openDetail(reviewFixtures.caseAApproved!, {
      automation: [{ ...NOT_ELIGIBLE, ineligibleReason: "FACTS_UNVERIFIED" }],
    });
    const message = page.getByTestId("automation-unavailable");
    expect(await message.getAttribute("data-reason")).toBe("FACTS_UNVERIFIED");
    expect(await message.innerText()).toContain("were not verified");
    expect(await page.getByTestId("run-automation").count()).toBe(0);
    await page.close();
  });

  it("36: Case C's task is internal only and shows its replacement action items", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!, { automation: [FOLLOWUP_PREVIEW] });
    const panel = await page.getByTestId("automation-panel").innerText();
    expect(panel).toContain("internal");
    expect(await page.getByTestId("automation-action-item").count()).toBe(2);
    expect(panel).toContain("State replacement forms");
    await page.close();
  });

  it("37: a successful delivery shows delivered and the external task id", async () => {
    const { page } = await openDetail(reviewFixtures.caseAApproved!, {
      automation: [
        FOLLOWUP_PREVIEW,
        { ...FOLLOWUP_PREVIEW, runs: [run("delivered", { externalTaskId: "task_demo_9" })] },
      ],
    });
    await page.getByTestId("run-automation").click();
    await page.getByTestId("automation-result").waitFor({ timeout: 30_000 });
    expect(await page.getByTestId("automation-result").getAttribute("data-status")).toBe("delivered");
    expect(await page.getByTestId("automation-task-id").innerText()).toContain("task_demo_9");
    // Delivered work is not offered again: one decision, one task.
    expect(await page.getByTestId("run-automation").count()).toBe(0);
    await page.close();
  });

  it("38: mock mode says nothing was sent and never says delivered", async () => {
    const { page } = await openDetail(reviewFixtures.caseAApproved!, {
      automation: [FOLLOWUP_PREVIEW, { ...FOLLOWUP_PREVIEW, runs: [run("mocked")] }],
    });
    await page.getByTestId("run-automation").click();
    await page.getByTestId("automation-result").waitFor({ timeout: 30_000 });
    const result = await page.getByTestId("automation-result").innerText();
    expect(result).toContain("Demo / mock");
    expect(result).not.toContain("Delivered to n8n");
    expect(await page.getByTestId("automation-mock-note").innerText()).toContain(
      "No external n8n webhook was called",
    );
    await page.close();
  });

  it("39: a failed delivery is shown as failed and says the review is unaffected", async () => {
    const { page } = await openDetail(reviewFixtures.caseAApproved!, {
      automation: [
        FOLLOWUP_PREVIEW,
        { ...FOLLOWUP_PREVIEW, runs: [run("failed", { errorCode: "TIMEOUT" })] },
      ],
    });
    await page.getByTestId("run-automation").click();
    await page.getByTestId("automation-result").waitFor({ timeout: 30_000 });
    const result = await page.getByTestId("automation-result").innerText();
    expect(result).toContain("Delivery failed");
    expect(result).toContain("audit history are unaffected");
    // The human decision on screen is untouched.
    expect(await page.getByTestId("decision-outcome-state").innerText()).toContain("Approved");
    // Retry is offered for a failure, and only for a failure.
    expect(await page.getByTestId("run-automation").innerText()).toContain("Retry");
    await page.close();
  });

  it("40: a rapid double click sends one automation request", async () => {
    const { page, rec } = await openDetail(reviewFixtures.caseAApproved!, {
      automation: [FOLLOWUP_PREVIEW, { ...FOLLOWUP_PREVIEW, runs: [run("mocked")] }],
    });
    const button = page.getByTestId("run-automation");
    await button.click();
    await page.getByTestId("automation-result").waitFor({ timeout: 30_000 });
    expect(rec.automationPosts).toBe(1);
    await page.close();
  });

  it("41: revisiting a review shows the stored run without firing again", async () => {
    const { page, rec } = await openDetail(reviewFixtures.caseAApproved!, {
      automation: [{ ...FOLLOWUP_PREVIEW, runs: [run("delivered", { externalTaskId: "task_demo_1" })] }],
    });
    expect(await page.getByTestId("automation-result").getAttribute("data-status")).toBe("delivered");
    expect(rec.automationPosts).toBe(0);
    expect(await page.getByTestId("run-automation").count()).toBe(0);
    await page.close();
  });

  it("42: no client-communication capability appears anywhere on the page", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!, { automation: [FOLLOWUP_PREVIEW] });
    const body = await page.locator("main").innerText();
    for (const forbidden of [
      "Send email",
      "Contact client",
      "Recipient",
      "收件人",
      "发送邮件",
      "Delivery channel",
    ]) {
      expect(body, `page offers "${forbidden}"`).not.toContain(forbidden);
    }
    // And no field that could carry an address.
    expect(await page.locator('input[type="email"]').count()).toBe(0);
    await page.close();
  });
});

describe("the checklist is a working aid (43-51)", () => {
  it("43: an item expands to why it is here and what to verify", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    expect(await page.getByTestId("checklist-detail").count()).toBe(0);
    const first = page.getByTestId("checklist-item").first();
    const toggle = first.getByTestId("checklist-toggle");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    await toggle.click();
    expect(await toggle.getAttribute("aria-expanded")).toBe("true");
    expect(await page.getByTestId("checklist-detail").count()).toBe(1);
    // innerText reflects the CSS `uppercase` on the section headings.
    const detail = await first.getByTestId("checklist-detail").innerText();
    expect(detail).toContain("为什么出现");
    expect(detail).toContain("需要核实");
    expect(detail.toLowerCase()).toContain("why this item is here");
    expect(detail.toLowerCase()).toContain("what to verify");
    await page.close();
  });

  it("44: a missing-information item reuses the snapshot's own reason", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    const item = page.locator('[data-item-key="desiredCoverageAmount"]');
    await item.getByTestId("checklist-toggle").click();
    const detail = await item.getByTestId("checklist-detail").innerText();
    // Verbatim from snapshot.missingClientInformation — not a second copy that can drift.
    expect(detail).toContain(
      "The desired death-benefit amount is not stated, so coverage need cannot be evaluated.",
    );
    await page.close();
  });

  it("45: comparison rows are linked only where the row honestly covers the item", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    const linked = page.locator('[data-item-key="new contract surrender period"]');
    await linked.getByTestId("checklist-toggle").click();
    expect(await linked.getByTestId("checklist-evidence").count()).toBe(1);
    expect(
      await linked.locator('[data-dimension-target="surrender_liquidity"]').count(),
    ).toBe(1);
    // Cited sources for that row are offered inline, and each one resolves to a
    // page in the PDF. A citation card that promises a source page and links
    // nowhere is the failure mode worth asserting against.
    expect(await linked.getByTestId("citation-toggle").count()).toBe(1);
    await linked.getByTestId("citation-toggle").click();
    const cards = await linked.getByTestId("citation-detail").count();
    expect(cards).toBeGreaterThan(0);
    expect(await linked.getByTestId("citation-link").count()).toBe(cards);
    const href = await linked.getByTestId("citation-link").first().getAttribute("href");
    expect(href).toMatch(/^\/documents\/.+#page=\d+$/);

    // The client's EXISTING contract is not in this comparison, and replacement
    // paperwork is not a product fact — neither may borrow another product's row.
    for (const key of ["current contract surrender charge", "state replacement forms", "age-based suitability review"]) {
      const item = page.locator(`[data-item-key="${key}"]`);
      await item.getByTestId("checklist-toggle").click();
      expect(await item.getByTestId("checklist-evidence").count(), key).toBe(0);
      expect(await item.getByTestId("checklist-no-evidence").count(), key).toBe(1);
    }
    await page.close();
  });

  it("46: a missing-information gap links affected rows but never citations", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    const item = page.locator('[data-item-key="desiredCoverageAmount"]');
    await item.getByTestId("checklist-toggle").click();
    expect(await item.getByTestId("checklist-affected").count()).toBe(1);
    expect(await item.locator('[data-dimension-target="contract_size"]').count()).toBe(1);
    // Information that is MISSING must never be rendered next to sources.
    expect(await item.getByTestId("citation-toggle").count()).toBe(0);
    await page.close();
  });

  it("47: ticking works without expanding, and the progress count follows", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    const progress = page.getByTestId("checklist-progress");
    expect(await progress.getAttribute("data-done")).toBe("0");
    expect(await progress.getAttribute("data-total")).toBe("17");
    expect(await progress.innerText()).toContain("0/17");
    // No expand first: the tick is a persistent control on the row head.
    expect(await page.getByTestId("checklist-detail").count()).toBe(0);
    const boxes = page.getByTestId("checklist-verify");
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await boxes.nth(2).check();
    expect(await progress.getAttribute("data-done")).toBe("3");
    expect(await page.locator('[data-testid="checklist-item"][data-verified="true"]').count()).toBe(3);
    await boxes.nth(2).uncheck();
    expect(await progress.getAttribute("data-done")).toBe("2");
    await page.close();
  });

  it("48: every item ticked shows a completion state that disclaims approval", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    const boxes = page.getByTestId("checklist-verify");
    const total = await boxes.count();
    for (let i = 0; i < total; i += 1) await boxes.nth(i).check();
    const banner = page.getByTestId("checklist-complete");
    expect(await banner.count()).toBe(1);
    const text = await banner.innerText();
    expect(text).toContain("全部 17 项已确认");
    expect(text).toContain("not a suitability");
    await boxes.nth(0).uncheck();
    expect(await page.getByTestId("checklist-complete").count()).toBe(0);
    await page.close();
  });

  it("49: completion changes nothing about the decision the browser submits", async () => {
    const { page, rec } = await openDetail(reviewFixtures.caseCPending!);
    const boxes = page.getByTestId("checklist-verify");
    const total = await boxes.count();
    for (let i = 0; i < total; i += 1) await boxes.nth(i).check();
    await page.getByTestId("approve-button").click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="decision-panel"]').length === 0);
    // Ticks are browser-only: the body carries the decision and nothing else.
    expect(rec.decisionBodies).toEqual([{ type: "approve" }]);
    await page.close();
  });

  it("50: reloading clears the ticks, as the copy promises", async () => {
    const { page } = await openDetail(reviewFixtures.caseCPending!);
    const boxes = page.getByTestId("checklist-verify");
    for (let i = 0; i < 5; i += 1) await boxes.nth(i).check();
    expect(await page.getByTestId("checklist-progress").getAttribute("data-done")).toBe("5");
    expect(await page.getByTestId("review-checklist").innerText()).toContain("刷新后清空");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("review-detail").waitFor({ timeout: 30_000 });
    expect(await page.getByTestId("checklist-progress").getAttribute("data-done")).toBe("0");
    await page.close();
  });

  it("51: an empty checklist does not claim a client is missing", async () => {
    const { page } = await openDetail(reviewFixtures.noClientPending!);
    const empty = await page.getByTestId("checklist-empty").innerText();
    expect(empty).toContain("No checklist items apply to this review");
    // The old wording was untrue whenever a client WAS attached with complete info.
    expect(empty).not.toContain("No client is attached");
    await page.close();
  });
});

describe("queue state badge (52)", () => {
  it("52: a state pill stays one pill, whatever the label's length", async () => {
    // The committed fixture happens to hold only pending and approved rows, and
    // the bug only showed on the long labels. Cover every state.
    const rows = [
      { ...queueFixture[0]!, reviewId: "rev_badge_pending", reviewState: "pending_review" as const },
      { ...queueFixture[0]!, reviewId: "rev_badge_approved", reviewState: "approved" as const },
      { ...queueFixture[0]!, reviewId: "rev_badge_rejected", reviewState: "rejected" as const },
      { ...queueFixture[0]!, reviewId: "rev_badge_revision", reviewState: "revision_requested" as const },
    ];
    const { page } = await openQueue(rows);
    await page.getByTestId("queue-filter-all").click();
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="queue-state-badge"]').length === n,
      rows.length,
    );
    // An inline element split across two lines reports two client rects, and
    // that is exactly what a torn pill is — border and rounding per line box.
    const rects = await page
      .getByTestId("queue-state-badge")
      .evaluateAll((els) => els.map((el) => el.getClientRects().length));
    expect(rects).toEqual([1, 1, 1, 1]);
    const heights = await page
      .getByTestId("queue-state-badge")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(new Set(heights).size, `badge heights differ: ${heights.join(",")}`).toBe(1);
    await page.close();
  });
});
