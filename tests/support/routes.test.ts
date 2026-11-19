import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setRateLimitStore } from "../../lib/ops/guard";
import { setLogWriter } from "../../lib/ops/request-log";
import type { RateLimitStore } from "../../lib/ops/rate-limit";
import { GET as list, POST as create } from "../../app/api/support/tickets/route";
import { POST as act } from "../../app/api/support/tickets/[id]/actions/route";
import { GET as handoff } from "../../app/api/support/handoff/route";

// Offline route tests: everything here is decided before any database call.

let lines: string[] = [];
let hits = 0;
const blocked: RateLimitStore = {
  hit: async () => {
    hits += 1;
    return { allowed: false, count: 21, resetAt: new Date(Date.now() + 60_000) };
  },
};
beforeEach(() => {
  hits = 0;
  setRateLimitStore(blocked);
  setLogWriter((l) => lines.push(l));
});
afterEach(() => {
  setRateLimitStore(null);
  setLogWriter(null);
  lines = [];
});

const post = (body: unknown) =>
  new Request("http://x/api/support/tickets", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", "x-request-id": "test-req-1" },
    body: JSON.stringify(body),
  });

describe("POST /api/support/tickets", () => {
  it("rejects invalid input before the limiter counts it", async () => {
    const res = await create(post({ subject: "x" }), {});
    expect(res.status).toBe(400);
    expect(hits).toBe(0);
  });

  it("caller cannot set triage fields: unknown keys are ignored, not trusted", async () => {
    const res = await create(post({ subject: "Help me", body: "please help", requester: "Synthetic Broker", priority: "P4", status: "resolved" }), {});
    // Reaches the limiter (blocked here) — the extra fields were simply not part of the input.
    expect(res.status).toBe(429);
    expect(hits).toBe(1);
  });

  it("is rate limited per client with Retry-After, and the log line never holds the IP or ticket text", async () => {
    const res = await create(post({ subject: "Compare page broken", body: "500 error on compare", requester: "Synthetic Broker" }), {});
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(res.headers.get("x-request-id")).toBe("test-req-1");
    const log = lines.join("\n");
    expect(log).toContain('"rateLimitRule":"support-create-ip"');
    expect(log).not.toContain("203.0.113.7");
    expect(log).not.toContain("Compare page broken");
  });
});

describe("other support routes reject bad input offline", () => {
  it("unknown queue filter → 400", async () => {
    expect((await list(new Request("http://x/api/support/tickets?status=bogus"), {})).status).toBe(400);
  });
  it("actions: a status-setting payload is not an action → 400", async () => {
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ status: "resolved" }) });
    expect((await act(req, { params: Promise.resolve({ id: "tkt_x" }) })).status).toBe(400);
  });
  it("actions: an actor outside the roster → 400", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ action: "RESOLVE", expectedStatus: "needs_human", actor: "Mallory", resolutionNote: "done" }),
    });
    expect((await act(req, { params: Promise.resolve({ id: "tkt_x" }) })).status).toBe(400);
  });
  it("handoff: unknown format → 400", async () => {
    expect((await handoff(new Request("http://x/api/support/handoff?format=pdf"), {})).status).toBe(400);
  });
});
