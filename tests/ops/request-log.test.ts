import { afterEach, describe, expect, it } from "vitest";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
  setLogWriter,
  withRequestLog,
} from "../../lib/ops/request-log";

// One JSON line per request, with nothing in it that came from the caller
// except a well-formed request id.

let lines: string[] = [];
afterEach(() => {
  setLogWriter(null);
  lines = [];
});
function capture() {
  setLogWriter((line) => lines.push(line));
}

describe("resolveRequestId", () => {
  it("reuses a well-formed x-request-id", () => {
    expect(resolveRequestId(new Headers({ "x-request-id": "abc-123" }))).toBe("abc-123");
  });
  it("falls back to x-vercel-id", () => {
    expect(resolveRequestId(new Headers({ "x-vercel-id": "sfo1::iad1::xyz-1" }))).toBe("sfo1::iad1::xyz-1");
  });
  it("ignores an id that could inject text into the log and mints a UUID", () => {
    const id = resolveRequestId(new Headers({ "x-request-id": 'x" , "level":"info' }));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("mints a UUID when nothing is sent", () => {
    expect(resolveRequestId(new Headers())).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("withRequestLog", () => {
  it("writes exactly one JSON line with route, status and duration, and echoes the id", async () => {
    capture();
    const handler = withRequestLog("/api/test", async (_req, _ctx: unknown, log) => {
      log.annotate({ citationCount: 2 });
      return Response.json({ ok: true }, { status: 201 });
    });
    const res = await handler(
      new Request("http://x/api/test", { method: "POST", headers: { "x-request-id": "req-1" } }),
      {},
    );
    expect(res.status).toBe(201);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("req-1");
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]!);
    expect(line).toMatchObject({
      event: "request",
      level: "info",
      requestId: "req-1",
      route: "/api/test",
      method: "POST",
      status: 201,
      citationCount: 2,
    });
    expect(typeof line.durationMs).toBe("number");
    expect(line.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("levels: 4xx is warn, 5xx is error", async () => {
    capture();
    for (const status of [429, 503]) {
      await withRequestLog("/r", async () => new Response(null, { status }))(new Request("http://x/r"), {});
    }
    expect(lines.map((l) => JSON.parse(l).level)).toEqual(["warn", "error"]);
  });

  it("annotations cannot overwrite the core fields", async () => {
    capture();
    await withRequestLog("/r", async (_req, _ctx: unknown, log) => {
      log.annotate({ status: 999, route: "/spoofed" });
      return new Response(null, { status: 200 });
    })(new Request("http://x/r"), {});
    const line = JSON.parse(lines[0]!);
    expect(line.status).toBe(200);
    expect(line.route).toBe("/r");
  });

  it("still logs a 500 line when the handler throws, and rethrows", async () => {
    capture();
    const handler = withRequestLog("/boom", async () => {
      throw new Error("kaboom with secret detail");
    });
    await expect(handler(new Request("http://x/boom"), {})).rejects.toThrow("kaboom");
    const line = JSON.parse(lines[0]!);
    expect(line.status).toBe(500);
    expect(line.level).toBe("error");
    expect(lines[0]).not.toContain("secret detail");
  });

  it("never logs the request body", async () => {
    capture();
    await withRequestLog("/api/answer", async (req) => {
      await req.json();
      return new Response(null, { status: 200 });
    })(new Request("http://x/api/answer", { method: "POST", body: JSON.stringify({ query: "我的社保号" }) }), {});
    expect(lines[0]).not.toContain("社保");
  });
});
