import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setRateLimitStore } from "../../lib/ops/guard";
import { setLogWriter } from "../../lib/ops/request-log";
import type { RateLimitStore } from "../../lib/ops/rate-limit";
import { POST as answer } from "../../app/api/answer/route";
import { POST as narrative } from "../../app/api/compare/narrative/route";
import { POST as transcribe } from "../../app/api/transcribe/route";

// The three model-spending routes, wired to a store that says "over the
// limit". Every assertion here holds without a network: a blocked request
// must be turned away BEFORE any model, embedding or transcription call.

const resetAt = () => new Date(Date.now() + 120_000);
const blocked: RateLimitStore = { hit: async () => ({ allowed: false, count: 11, resetAt: resetAt() }) };
let lines: string[] = [];

beforeEach(() => {
  setRateLimitStore(blocked);
  setLogWriter((l) => lines.push(l));
});
afterEach(() => {
  setRateLimitStore(null);
  setLogWriter(null);
  lines = [];
});

const json = (body: unknown) =>
  new Request("http://x", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  });

describe("rate-limited routes", () => {
  it("/api/answer: 429 RATE_LIMITED with Retry-After and a bilingual message", async () => {
    const res = await answer(json({ query: "定期寿险有现金价值吗？" }), {});
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    const body = await res.json();
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.message).toMatch(/请求太频繁/);
    expect(body.message).toMatch(/Too many requests/);
    const line = JSON.parse(lines.at(-1)!);
    expect(line).toMatchObject({ route: "/api/answer", status: 429, rateLimit: "blocked", queryLength: 11 });
    expect(lines.join("\n")).not.toContain("203.0.113.9");
    expect(lines.join("\n")).not.toContain("现金价值");
  });

  it("/api/answer: invalid input is rejected before the limiter counts it", async () => {
    let hits = 0;
    setRateLimitStore({ hit: async () => (hits++, { allowed: true, count: 1, resetAt: resetAt() }) });
    const res = await answer(json({ query: "" }), {});
    expect(res.status).toBe(400);
    expect(hits).toBe(0);
  });

  it("/api/compare/narrative: 429 keeps the renderable 'unavailable' shape", async () => {
    const res = await narrative(json({ productAId: "doc_securerate5_v1", productBId: "doc_indexflex_ul_v1" }), {});
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ error: "RATE_LIMITED", narrativeStatus: "unavailable", narrativeSections: [] });
  });

  it("/api/transcribe: 429 after the audio passes validation", async () => {
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(64)], { type: "audio/webm" }), "q.webm");
    const res = await transcribe(new Request("http://x", { method: "POST", body: form }), {});
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("RATE_LIMITED");
  });
});
