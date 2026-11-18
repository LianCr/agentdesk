import { randomUUID } from "node:crypto";

// One structured JSON line per API request.
//
// Vercel captures stdout/stderr per invocation, so a single JSON object per
// request is enough to filter by route, status or latency in the log viewer
// without any log shipping. What is logged is deliberately boring: ids,
// route, method, status and timings. Never the question text, the audio, a
// header value, an IP address or an error message — the existing
// `{ event, code }` error lines follow the same "codes only" rule.

export const REQUEST_ID_HEADER = "x-request-id";

export type RequestLogLine = {
  ts: string;
  level: "info" | "warn" | "error";
  event: "request";
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
} & Record<string, string | number | boolean | null>;

/** Extra, route-specific fields. Values must already be safe to log. */
export type LogFields = Record<string, string | number | boolean | null>;

export type RequestContext = {
  requestId: string;
  /** Attach route-specific fields (counts, codes, timings) to this request's line. */
  annotate(fields: LogFields): void;
};

type Writer = (line: string) => void;
let writer: Writer = (line) => console.log(line);

/** Test hook: capture log lines instead of writing to stdout. */
export function setLogWriter(next: Writer | null): void {
  writer = next ?? ((line) => console.log(line));
}

const SAFE_ID = /^[A-Za-z0-9:_\-.]{1,128}$/;

/**
 * Reuse an upstream id when it looks like one (Vercel sets x-vercel-id, a
 * caller may send x-request-id), otherwise mint a UUID. Anything that is not
 * a short token is ignored so a header can never inject text into the log.
 */
export function resolveRequestId(headers: Headers): string {
  for (const name of [REQUEST_ID_HEADER, "x-vercel-id"]) {
    const value = headers.get(name);
    if (value && SAFE_ID.test(value)) return value;
  }
  return randomUUID();
}

function levelFor(status: number): RequestLogLine["level"] {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

/**
 * Wrap a route handler: assigns a request id, times the call, echoes the id
 * as a response header and writes exactly one JSON line — also when the
 * handler throws (the line says 500 and the error propagates unchanged).
 */
export function withRequestLog<Ctx>(
  route: string,
  handler: (request: Request, ctx: Ctx, log: RequestContext) => Promise<Response>,
): (request: Request, ctx: Ctx) => Promise<Response> {
  return async (request, ctx) => {
    const started = performance.now();
    const requestId = resolveRequestId(request.headers);
    const fields: LogFields = {};
    const log: RequestContext = {
      requestId,
      annotate: (more) => Object.assign(fields, more),
    };

    let status = 500;
    try {
      const response = await handler(request, ctx, log);
      status = response.status;
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    } finally {
      const line: RequestLogLine = {
        ...fields,
        ts: new Date().toISOString(),
        level: levelFor(status),
        event: "request",
        requestId,
        route,
        method: request.method,
        status,
        durationMs: Math.round(performance.now() - started),
      };
      writer(JSON.stringify(line));
    }
  };
}
