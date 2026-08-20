import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import { strongAnswer, insufficientAnswer, reviewAnswer, type UiGroundedAnswer } from "./fixtures";

// Mocked-browser UI tests for the M3-C demo (matrix 1-27). A real `next dev`
// server is spawned; /api/answer is intercepted per test for determinism.
// Only test 13 (static PDF) and 26/27 (secret scan, DB counts) touch reality.

const ROOT = join(import.meta.dirname, "../..");
const PORT = 3123;
const BASE = `http://localhost:${PORT}`;
const PRESETS = [
  "定期寿险有现金价值吗？",
  "IUL 的 current cap 和 guaranteed minimum cap 是多少？",
  "SecureRate 有 optional rider 吗？",
  "TermPlus level period 结束以后 premium 怎么变化？",
  "TermPlus 61 岁续保费是多少？",
];

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
  context = await browser.newContext();
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
    // group already gone
  }
});

function fulfill(fixture: UiGroundedAnswer, delayMs = 0) {
  return async (route: Route): Promise<void> => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) });
  };
}

async function openPage(): Promise<Page> {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  return page;
}

async function submitQuery(page: Page, query: string): Promise<void> {
  await page.getByTestId("question-input").fill(query);
  await page.getByTestId("ask-button").click();
}

describe("page shell (1-3, 19)", () => {
  it("1: page loads with the hero title", async () => {
    const page = await openPage();
    await expect(page.getByTestId("hero-title").innerText()).resolves.toBe("AgentDesk");
    await page.close();
  });

  it("2: bilingual hero tagline is visible", async () => {
    const page = await openPage();
    const tagline = await page.getByTestId("hero-tagline").innerText();
    expect(tagline).toContain("中文提问，检索英文保险资料，并返回可验证的原文引用与页码。");
    expect(tagline).toContain("Ask in Chinese. Get answers grounded in English insurance documents.");
    await page.close();
  });

  it("2b: the opening steps describe ask, search, and cite", async () => {
    const page = await openPage();
    const steps = await page.getByTestId("hero-steps").innerText();
    expect(steps).toContain("中文提问");
    expect(steps).toContain("检索英文 PDF");
    expect(steps).toContain("原文 + 页码");
    await page.close();
  });

  it("3: exactly five preset questions with the exact texts", async () => {
    const page = await openPage();
    const texts = await page.getByTestId("preset-question").allInnerTexts();
    expect(texts.map((t) => t.trim())).toEqual(PRESETS);
    await page.close();
  });

  it("19: bilingual disclaimer is visible", async () => {
    const page = await openPage();
    const disclaimer = await page.getByTestId("demo-disclaimer").innerText();
    expect(disclaimer).toContain("fictional insurance products");
    expect(disclaimer).toContain("虚构保险产品");
    await page.close();
  });
});

describe("submission paths (4-6, 20, 22, 23, 25)", () => {
  it("4: preset click uses its exact question, unmangled", async () => {
    // This asserted that the preset's exact text was POSTed. Presets now
    // resolve to a pre-verified saved answer keyed by that exact string, so
    // the same invariant is checked where it now lives: the input shows the
    // preset verbatim, and an answer keyed by that exact text comes back.
    const page = await openPage();
    let posted = false;
    await page.route("**/api/answer", async (route) => {
      posted = true;
      await fulfill(strongAnswer)(route);
    });
    await page.getByTestId("preset-question").first().click();
    await page.getByTestId("answer-view").waitFor();
    expect(await page.getByTestId("question-input").inputValue()).toBe(PRESETS[0]);
    expect(posted).toBe(false);
    await page.close();
  });

  it("5/25: focused keyboard typing + Enter submits", async () => {
    const page = await openPage();
    let body = "";
    await page.route("**/api/answer", async (route) => {
      body = route.request().postData() ?? "";
      await fulfill(strongAnswer)(route);
    });
    await page.getByTestId("question-input").focus();
    await page.keyboard.type("Does TermPlus have riders?");
    await page.keyboard.press("Enter");
    await page.getByTestId("answer-view").waitFor();
    expect(JSON.parse(body).query).toBe("Does TermPlus have riders?");
    await page.close();
  });

  it("6: loading stages show while pending and disappear after", async () => {
    const page = await openPage();
    await page.route("**/api/answer", fulfill(strongAnswer, 1200));
    await submitQuery(page, "加载状态测试");
    await page.getByTestId("loading-stages").waitFor({ state: "visible" });
    expect(await page.getByTestId("question-input").isDisabled()).toBe(true);
    expect(await page.getByTestId("ask-button").isDisabled()).toBe(true);
    await page.getByTestId("answer-view").waitFor();
    await page.getByTestId("loading-stages").waitFor({ state: "hidden" });
    await page.close();
  });

  it("20: empty query cannot submit", async () => {
    const page = await openPage();
    let calls = 0;
    await page.route("**/api/answer", async (route) => {
      calls++;
      await fulfill(strongAnswer)(route);
    });
    expect(await page.getByTestId("ask-button").isDisabled()).toBe(true);
    await page.getByTestId("question-input").press("Enter");
    await page.waitForTimeout(400);
    expect(calls).toBe(0);
    await page.close();
  });

  it("22/23: input reusable after a response; new answer replaces the old one", async () => {
    const page = await openPage();
    await page.route("**/api/answer", fulfill(strongAnswer));
    await submitQuery(page, "第一问");
    await page.getByTestId("answer-view").waitFor();
    expect(await page.getByTestId("answer-content").innerText()).toContain("不积累现金价值");

    await page.unroute("**/api/answer");
    await page.route("**/api/answer", fulfill(reviewAnswer));
    expect(await page.getByTestId("question-input").isEnabled()).toBe(true);
    await submitQuery(page, "第二问");
    await page.getByTestId("review-banner").waitFor();
    const content = await page.getByTestId("answer-content").innerText();
    expect(content).not.toContain("不积累现金价值");
    expect(content).toContain("只能提供有出处的产品事实");
    await page.close();
  });
});

describe("result states (7-9, 16-18)", () => {
  it("7: strong response renders badge and answer", async () => {
    const page = await openPage();
    await page.route("**/api/answer", fulfill(strongAnswer));
    await submitQuery(page, "现金价值");
    await page.getByTestId("answer-view").waitFor();
    expect(await page.getByTestId("evidence-badge").getAttribute("data-status")).toBe("strong");
    expect(await page.getByTestId("evidence-badge").innerText()).toContain("证据充分");
    expect(await page.getByTestId("answer-content").innerText()).toContain("不积累现金价值");
    await page.close();
  });

  it("8: insufficient renders as calm evidence state, not an app error", async () => {
    const page = await openPage();
    await page.route("**/api/answer", fulfill(insufficientAnswer));
    await submitQuery(page, "61 岁续保费");
    await page.getByTestId("answer-view").waitFor();
    expect(await page.getByTestId("evidence-badge").getAttribute("data-status")).toBe("insufficient");
    expect(await page.getByTestId("error-message").count()).toBe(0);
    expect(await page.getByTestId("refusal-reason").innerText()).toContain("INSUFFICIENT_EVIDENCE");
    const missing = await page.getByTestId("missing-info").innerText();
    expect(missing).toContain("61 岁时的续保保费金额");
    expect(await page.getByTestId("next-step").innerText()).toContain("policy schedule");
    await page.close();
  });

  it("9: review-required banner renders bilingually with reason", async () => {
    const page = await openPage();
    await page.route("**/api/answer", fulfill(reviewAnswer));
    await submitQuery(page, "哪个最好");
    await page.getByTestId("review-banner").waitFor();
    const banner = await page.getByTestId("review-banner").innerText();
    expect(banner).toContain("需要持牌保险经纪人审核");
    expect(banner).toContain("Licensed-agent review required");
    expect(banner).toContain("Final recommendation requested");
    await page.close();
  });

  it("16: evidence metrics match the response", async () => {
    const page = await openPage();
    await page.route("**/api/answer", fulfill(strongAnswer));
    await submitQuery(page, "指标");
    await page.getByTestId("evidence-summary").waitFor();
    expect(await page.getByTestId("metric-sources").innerText()).toContain("1");
    expect(await page.getByTestId("metric-claims").innerText()).toContain("1 / 1");
    expect(await page.getByTestId("metric-coverage").innerText()).toContain("100%");
    expect(await page.getByTestId("metric-review").innerText()).toMatch(/无需|No/);

    await page.unroute("**/api/answer");
    await page.route("**/api/answer", fulfill(reviewAnswer));
    await submitQuery(page, "审核指标");
    await page.getByTestId("review-banner").waitFor();
    expect(await page.getByTestId("metric-review").innerText()).toMatch(/需要|Yes/);
    await page.close();
  });

  it("17/18: no similarity score or model-confidence appears", async () => {
    const page = await openPage();
    await page.route("**/api/answer", fulfill(strongAnswer));
    await submitQuery(page, "分数检查");
    await page.getByTestId("answer-view").waitFor();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/similarity/i);
    expect(body).not.toMatch(/confidence/i);
    expect(body).not.toContain("0.61");
    await page.close();
  });
});

describe("citations (10-15)", () => {
  it("10/11/12/14/15: citation card fields, page number, link and exact quote", async () => {
    const page = await openPage();
    await page.route("**/api/answer", fulfill(strongAnswer));
    await submitQuery(page, "引用");
    await page.getByTestId("citation-card").first().waitFor();
    expect(await page.getByTestId("citation-product").innerText()).toContain("Demo TermPlus 20");
    expect(await page.getByTestId("citation-document").innerText()).toContain("Demo TermPlus 20 Product Guide");
    expect(await page.getByTestId("citation-page").innerText()).toContain("2");
    expect(await page.getByTestId("citation-section").innerText()).toContain("At a Glance");
    expect((await page.getByTestId("citation-quote").innerText()).trim()).toBe(
      strongAnswer.citations[0]!.quote,
    );
    const link = page.getByTestId("citation-link");
    expect(await link.getAttribute("href")).toBe("/documents/demo-termplus-20.pdf#page=2");
    expect(await link.getAttribute("target")).toBe("_blank");
    await page.close();
  });

  it("13: the linked PDF resolves on the real server", async () => {
    const res = await fetch(`${BASE}/documents/demo-termplus-20.pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("pdf");
  });
});

describe("responsive (24)", () => {
  it("24: mobile 390x844 has no horizontal overflow", async () => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await mobile.newPage();
    await page.route("**/api/answer", fulfill(strongAnswer));
    await page.goto(BASE, { waitUntil: "networkidle" });
    await submitQuery(page, "移动端");
    await page.getByTestId("answer-view").waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await mobile.close();
  });
});

describe("errors and boundaries (21, 26, 27)", () => {
  it("21: upstream failure shows the safe message, no answer view", async () => {
    const page = await openPage();
    await page.route("**/api/answer", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "ANSWER_FAILED",
          message: "Something went wrong while answering. Please try again. 回答过程中出现问题，请重试。",
        }),
      }),
    );
    await submitQuery(page, "错误处理");
    await page.getByTestId("error-message").waitFor();
    expect(await page.getByTestId("error-message").innerText()).toContain("Please try again");
    expect(await page.getByTestId("answer-view").count()).toBe(0);
    await page.close();
  });

  it("26: no secret name or value appears in served client chunks", async () => {
    if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));
    const files: string[] = [];
    const walk = (dir: string, jsOnly: boolean): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, jsOnly);
        else if (!jsOnly || full.endsWith(".js")) files.push(full);
      }
    };
    const chunksDir = join(ROOT, ".next/static/chunks");
    const nextDir = join(ROOT, ".next");
    if (existsSync(chunksDir)) walk(chunksDir, false);
    else if (existsSync(nextDir)) walk(nextDir, true);
    expect(files.length, ".next output missing — dev server should have produced it").toBeGreaterThan(0);
    const forbidden = [
      "sb_secret_",
      "OPENAI_API_KEY",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_DB_URL",
      process.env.OPENAI_API_KEY,
      process.env.SUPABASE_SECRET_KEY,
      process.env.SUPABASE_DB_URL,
    ].filter((v): v is string => Boolean(v && v.length > 6));
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        expect(content.includes(needle), `secret material in ${file}`).toBe(false);
      }
    }
  });

  it("27: database counts remain 3/20/45 after all UI tests", async () => {
    if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      console.warn("SUPABASE env unset — skipping DB count check");
      return;
    }
    const counts: number[] = [];
    for (const table of ["documents", "document_pages", "chunks"]) {
      const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
        method: "HEAD",
        headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
      });
      counts.push(Number(res.headers.get("content-range")?.split("/")[1] ?? -1));
    }
    expect(counts).toEqual([3, 20, 45]);
  });
});

// ---------------------------------------------------------------------------
// Voice input (speech-to-text into the existing question box).
//
// MediaRecorder and getUserMedia are stubbed in the page: a headless browser
// has no microphone, and the behaviour worth testing is what the component
// does with the audio, not whether Chromium can capture it.

const VOICE_STUB = `
  window.__voice = { started: 0, stopped: 0, tracksStopped: 0 };
  class FakeRecorder {
    constructor(stream, opts) { this.stream = stream; this.mimeType = (opts && opts.mimeType) || 'audio/webm'; }
    static isTypeSupported() { return true; }
    start() { window.__voice.started++; }
    stop() {
      window.__voice.stopped++;
      if (this.ondataavailable) this.ondataavailable({ data: new Blob([window.__voiceBytes ?? 'x'], { type: this.mimeType }) });
      if (this.onstop) this.onstop();
    }
  }
  window.MediaRecorder = FakeRecorder;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        if (window.__denyMic) throw new DOMException('Permission denied', 'NotAllowedError');
        return { getTracks: () => [{ stop: () => { window.__voice.tracksStopped++; } }] };
      },
    },
  });
`;

async function openVoicePage(
  transcribe?: { status: number; body: unknown },
): Promise<{ page: Page; posts: Array<{ hasAudio: boolean; type: string }>; answerCalls: number }> {
  const page = await context.newPage();
  const posts: Array<{ hasAudio: boolean; type: string }> = [];
  const counter = { answerCalls: 0 };
  await page.addInitScript(VOICE_STUB);
  await page.route(
    (url) => url.pathname === "/api/transcribe",
    async (route: Route) => {
      const body = route.request().postData() ?? "";
      posts.push({ hasAudio: body.includes("name=\"audio\""), type: body.includes("webm") ? "webm" : "other" });
      await route.fulfill({
        status: transcribe?.status ?? 200,
        contentType: "application/json",
        body: JSON.stringify(transcribe?.body ?? { text: "TermPlus 有现金价值吗？" }),
      });
    },
  );
  // Any call here would mean voice submitted the question by itself.
  await page.route(
    (url) => url.pathname === "/api/answer",
    async (route: Route) => {
      counter.answerCalls += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(strongAnswer) });
    },
  );
  await page.goto(BASE, { waitUntil: "networkidle" });
  return { page, posts, get answerCalls() { return counter.answerCalls; } } as never;
}

describe("voice input (28-35)", () => {
  it("28: the microphone button is offered beside the question box", async () => {
    const { page } = await openVoicePage();
    expect(await page.getByTestId("voice-button").isVisible()).toBe(true);
    expect(await page.getByTestId("voice-input").getAttribute("data-state")).toBe("idle");
    expect(await page.getByTestId("question-input").isVisible()).toBe(true);
    await page.close();
  });

  it("29: clicking starts recording and says so", async () => {
    const { page } = await openVoicePage();
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-recording").waitFor();
    expect(await page.getByTestId("voice-input").getAttribute("data-state")).toBe("recording");
    expect(await page.evaluate(() => (window as never as { __voice: { started: number } }).__voice.started)).toBe(1);
    await page.close();
  });

  it("30: stopping posts the audio to /api/transcribe and releases the microphone", async () => {
    const { page, posts } = await openVoicePage();
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-recording").waitFor();
    await page.getByTestId("voice-button").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="voice-input"]')?.getAttribute("data-state") === "idle");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.hasAudio).toBe(true);
    // The browser's recording indicator must go away when recording ends.
    expect(await page.evaluate(() => (window as never as { __voice: { tracksStopped: number } }).__voice.tracksStopped)).toBe(1);
    await page.close();
  });

  it("31: the transcript lands in the question box", async () => {
    const { page } = await openVoicePage();
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-recording").waitFor();
    await page.getByTestId("voice-button").click();
    await page.waitForFunction(() => (document.querySelector('[data-testid="question-input"]') as HTMLTextAreaElement)?.value.length > 0);
    expect(await page.getByTestId("question-input").inputValue()).toBe("TermPlus 有现金价值吗？");
    await page.close();
  });

  it("32: an English transcript works the same way", async () => {
    const { page } = await openVoicePage({ status: 200, body: { text: "Does SecureRate have surrender charges?" } });
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-recording").waitFor();
    await page.getByTestId("voice-button").click();
    await page.waitForFunction(() => (document.querySelector('[data-testid="question-input"]') as HTMLTextAreaElement)?.value.length > 0);
    expect(await page.getByTestId("question-input").inputValue()).toBe("Does SecureRate have surrender charges?");
    await page.close();
  });

  it("33: text the user already typed is kept, not overwritten", async () => {
    const { page } = await openVoicePage();
    await page.getByTestId("question-input").fill("SecureRate");
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-recording").waitFor();
    await page.getByTestId("voice-button").click();
    await page.waitForFunction(() => (document.querySelector('[data-testid="question-input"]') as HTMLTextAreaElement)?.value.includes("现金价值"));
    expect(await page.getByTestId("question-input").inputValue()).toBe("SecureRate TermPlus 有现金价值吗？");
    await page.close();
  });

  it("34: a transcription failure shows an inline error and keeps the page working", async () => {
    const { page } = await openVoicePage({
      status: 502,
      body: { error: "PROVIDER_ERROR", message: "语音转写失败,请重试。Couldn't transcribe audio. Please try again." },
    });
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-recording").waitFor();
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-error").waitFor();
    expect(await page.getByTestId("voice-error").innerText()).toContain("Couldn't transcribe audio");
    expect(await page.getByTestId("question-input").inputValue()).toBe("");
    // Typing still works.
    await page.getByTestId("question-input").fill("typed instead");
    expect(await page.getByTestId("ask-button").isDisabled()).toBe(false);
    await page.close();
  });

  it("35: a denied microphone shows an error and never crashes the page", async () => {
    const { page } = await openVoicePage();
    await page.evaluate(() => { (window as never as { __denyMic: boolean }).__denyMic = true; });
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-error").waitFor();
    expect(await page.getByTestId("voice-error").innerText()).toContain("Microphone unavailable");
    expect(await page.getByTestId("voice-input").getAttribute("data-state")).toBe("idle");
    expect(await page.getByTestId("question-input").isVisible()).toBe(true);
    await page.close();
  });

  it("36: a transcript is never asked on the user's behalf", async () => {
    const { page, answerCalls } = await openVoicePage() as unknown as { page: Page; answerCalls: number };
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-recording").waitFor();
    await page.getByTestId("voice-button").click();
    await page.waitForFunction(() => (document.querySelector('[data-testid="question-input"]') as HTMLTextAreaElement)?.value.length > 0);
    await page.waitForTimeout(1000);
    // The box is filled, and nothing was asked.
    expect(await page.getByTestId("question-input").inputValue()).toBe("TermPlus 有现金价值吗？");
    expect(await page.getByTestId("answer-view").count()).toBe(0);
    void answerCalls;
    // Pressing Ask is still the user's move, and it works.
    await page.getByTestId("ask-button").click();
    await page.getByTestId("answer-view").waitFor({ timeout: 30_000 });
    await page.close();
  });
});

// ---------------------------------------------------------------------------
// Preset answers: a presentation shortcut for five exact strings, not a cache.

describe("preset saved answers (37-42)", () => {
  /** Counts /api/answer calls; still fulfils so the live path stays testable. */
  async function openCounting(): Promise<{ page: Page; calls: () => number }> {
    const page = await context.newPage();
    let calls = 0;
    await page.route(
      (url) => url.pathname === "/api/answer",
      async (route: Route) => {
        calls += 1;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(strongAnswer) });
      },
    );
    await page.goto(BASE, { waitUntil: "networkidle" });
    return { page, calls: () => calls };
  }

  it("37: an exact preset answers without calling /api/answer", async () => {
    const { page, calls } = await openCounting();
    await page.getByTestId("preset-question").first().click();
    await page.getByTestId("answer-view").waitFor({ timeout: 10_000 });
    expect(calls()).toBe(0);
    // The normal answer component, with its normal evidence badge.
    expect(await page.getByTestId("answer-content").isVisible()).toBe(true);
    expect(await page.locator("main").innerText()).toContain("现金价值");
    await page.close();
  });

  it("38: a saved answer's citation still opens the right document and page", async () => {
    const { page } = await openCounting();
    await page.getByTestId("preset-question").first().click();
    await page.getByTestId("answer-view").waitFor({ timeout: 10_000 });
    const link = page.getByTestId("citation-link").first();
    const href = await link.getAttribute("href");
    expect(href).toBe("/documents/demo-termplus-20.pdf#page=2");
    // The quote is the document's own wording, not a paraphrase.
    expect(await page.locator("main").innerText()).toContain(
      "The policy does not accumulate cash value",
    );
    const res = await page.request.get(`${BASE}${href!.split("#")[0]}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
    await page.close();
  });

  it("39: a free-form question still runs the live pipeline", async () => {
    const { page, calls } = await openCounting();
    await page.getByTestId("question-input").fill("SecureRate 的市场价值调整怎么算？");
    await page.getByTestId("ask-button").click();
    await page.getByTestId("answer-view").waitFor({ timeout: 30_000 });
    expect(calls()).toBe(1);
    await page.close();
  });

  it("40: editing a preset's wording does NOT hit the saved answer", async () => {
    const { page, calls } = await openCounting();
    // One preset, one word changed. This must be treated as a new question.
    await page.getByTestId("question-input").fill("定期寿险有现金价值吗");
    await page.getByTestId("ask-button").click();
    await page.getByTestId("answer-view").waitFor({ timeout: 30_000 });
    expect(calls()).toBe(1);
    expect(await page.getByTestId("saved-answer-note").count()).toBe(0);
    await page.close();
  });

  it("41: a live question shows the wait expectation while it runs", async () => {
    const page = await context.newPage();
    // Hold the response open so the loading state can be observed.
    await page.route(
      (url) => url.pathname === "/api/answer",
      async (route: Route) => {
        await new Promise((r) => setTimeout(r, 2500));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(strongAnswer) });
      },
    );
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByTestId("question-input").fill("IndexFlex 的 participation rate 是多少？");
    await page.getByTestId("ask-button").click();

    await page.getByTestId("loading-stages").waitFor();
    const note = await page.getByTestId("loading-wait-note").innerText();
    expect(note).toContain("15–20");
    expect(note).toContain("about 15–20 seconds");
    // No invented precision.
    const stages = await page.getByTestId("loading-stages").innerText();
    expect(stages).not.toMatch(/\d+%/);

    // 42: the loading state clears when the answer arrives.
    await page.getByTestId("answer-view").waitFor({ timeout: 30_000 });
    expect(await page.getByTestId("loading-stages").count()).toBe(0);
    await page.close();
  });

  it("43: a saved answer says it is saved, so instant does not imply the pipeline is instant", async () => {
    const { page } = await openCounting();
    await page.getByTestId("preset-question").first().click();
    await page.getByTestId("answer-view").waitFor({ timeout: 10_000 });
    const note = await page.getByTestId("saved-answer-note").innerText();
    expect(note).toContain("pre-verified saved answer");
    expect(note).toContain("run the live retrieval");
    await page.close();
  });
});

// ---------------------------------------------------------------------------
// Knowledge base viewer: what the assistant is actually searching.

describe("knowledge base viewer (44-49)", () => {
  /** Sums the committed fixtures independently of the app. */
  function expectedFromFixtures() {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "data/fictional-products/manifest.json"), "utf8"),
    ) as Array<{ documentId: string; file: string; pages: number; productName: string }>;
    const perDoc = manifest.map((entry) => {
      const { chunks } = JSON.parse(
        readFileSync(join(ROOT, `data/derived/chunks/${entry.documentId}.chunks.json`), "utf8"),
      ) as { chunks: unknown[] };
      return { ...entry, chunks: chunks.length };
    });
    return {
      perDoc,
      totals: {
        documents: perDoc.length,
        pages: perDoc.reduce((s, d) => s + d.pages, 0),
        chunks: perDoc.reduce((s, d) => s + d.chunks, 0),
      },
    };
  }

  it("44: the summary line reports the real totals", async () => {
    const page = await openPage();
    const { totals } = expectedFromFixtures();
    const line = await page.getByTestId("kb-totals").innerText();
    expect(line).toContain(`${totals.documents} 份文档`);
    expect(line).toContain(`${totals.pages} 页`);
    expect(line).toContain(`${totals.chunks} 个片段`);
    // Sanity that the fixtures really are the frozen 3/20/45.
    expect(totals).toEqual({ documents: 3, pages: 20, chunks: 45 });
    await page.close();
  });

  it("44b: the opening proof strip uses the same totals", async () => {
    const page = await openPage();
    const { totals } = expectedFromFixtures();
    expect(await page.getByTestId("hero-proof-documents").innerText()).toContain(String(totals.documents));
    expect(await page.getByTestId("hero-proof-pages").innerText()).toContain(String(totals.pages));
    expect(await page.getByTestId("hero-proof-chunks").innerText()).toContain(String(totals.chunks));
    await page.close();
  });

  it("45: the list is collapsed until asked for", async () => {
    const page = await openPage();
    expect(await page.getByTestId("kb-list").count()).toBe(0);
    expect(await page.getByTestId("kb-toggle").getAttribute("aria-expanded")).toBe("false");
    await page.getByTestId("kb-toggle").click();
    await page.getByTestId("kb-list").waitFor();
    expect(await page.getByTestId("kb-toggle").getAttribute("aria-expanded")).toBe("true");
    await page.close();
  });

  it("46: every document shows the page and chunk counts its fixtures actually have", async () => {
    const page = await openPage();
    await page.getByTestId("kb-toggle").click();
    await page.getByTestId("kb-list").waitFor();
    const { perDoc } = expectedFromFixtures();
    expect(await page.getByTestId("kb-document").count()).toBe(perDoc.length);
    for (const doc of perDoc) {
      const card = page.locator(`[data-document-id="${doc.documentId}"]`);
      const counts = await card.getByTestId("kb-counts").innerText();
      expect(counts, `${doc.documentId} page count`).toContain(`${doc.pages} 页`);
      expect(counts, `${doc.documentId} chunk count`).toContain(`${doc.chunks} 个片段`);
      expect(await card.innerText()).toContain(doc.productName);
    }
    await page.close();
  });

  it("47: Open PDF points at the real committed document", async () => {
    const page = await openPage();
    await page.getByTestId("kb-toggle").click();
    await page.getByTestId("kb-list").waitFor();
    const { perDoc } = expectedFromFixtures();
    for (const doc of perDoc) {
      const link = page.locator(`[data-document-id="${doc.documentId}"]`).getByTestId("kb-open-pdf");
      expect(await link.getAttribute("href")).toBe(`/documents/${doc.file}`);
    }
    // And it is served, not just linked.
    const res = await page.request.get(`${BASE}/documents/${perDoc[0]!.file}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
    await page.close();
  });

  it("48: the viewer exposes no index internals", async () => {
    const page = await openPage();
    await page.getByTestId("kb-toggle").click();
    await page.getByTestId("kb-list").waitFor();
    const html = await page.content();
    for (const leak of ["embedding", "chunkId", "contentHash", "sha256"]) {
      expect(html, `viewer leaks ${leak}`).not.toContain(leak);
    }
    // Section names only; no chunk body text.
    expect(await page.getByTestId("kb-list").innerText()).not.toContain(
      "The policy does not accumulate cash value",
    );
    await page.close();
  });

  it("49: the citation of an answer points into a document the viewer listed", async () => {
    // The story this feature exists to make visible: the knowledge base and the
    // citations are the same documents.
    const page = await openPage();
    await page.getByTestId("kb-toggle").click();
    await page.getByTestId("kb-list").waitFor();
    const listed = await page.getByTestId("kb-open-pdf").evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href")),
    );
    await page.getByTestId("preset-question").first().click();
    await page.getByTestId("answer-view").waitFor({ timeout: 30_000 });
    const citationHref = await page.getByTestId("citation-link").first().getAttribute("href");
    expect(listed).toContain(citationHref!.split("#")[0]);
    await page.close();
  });

  it("50: the viewer does not overflow a phone screen", async () => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await mobile.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByTestId("kb-toggle").click();
    await page.getByTestId("kb-list").waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.close();
    await mobile.close();
  });

  it("51: the opening page does not overflow a phone screen", async () => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await mobile.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByTestId("hero-proof").waitFor();
    await page.getByTestId("hero-steps").waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.close();
    await mobile.close();
  });
});
