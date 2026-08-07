import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Visual QA for the M3-C demo UI: screenshots of key states at three
// viewports into git-ignored tmp/visual-qa-ui/. Expects the dev server on
// port 3123 (started separately). Mocks /api/answer with fixtures so states
// are deterministic and no model call is made.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tmp/visual-qa-ui");
const BASE = process.env.UI_BASE_URL ?? "http://localhost:3123";
mkdirSync(OUT, { recursive: true });

const { strongAnswer, insufficientAnswer, reviewAnswer } = await import("../tests/ui/fixtures");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(OUT, `${vp.name}-1-idle.png`), fullPage: true });

    for (const [label, fixture] of [
      ["2-strong", strongAnswer],
      ["3-insufficient", insufficientAnswer],
      ["4-review", reviewAnswer],
    ] as const) {
      await page.route("**/api/answer", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) }),
      );
      await page.getByTestId("question-input").fill("测试问题 demo question");
      await page.getByTestId("ask-button").click();
      await page.getByTestId("answer-view").waitFor({ timeout: 15000 });
      await page.screenshot({ path: join(OUT, `${vp.name}-${label}.png`), fullPage: true });
      await page.unroute("**/api/answer");
    }
    await context.close();
    console.log(`ok ${vp.name}: 4 screenshots`);
  }
} finally {
  await browser.close();
}
console.log(`Screenshots in ${OUT}`);
