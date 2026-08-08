import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dispatchAutomation, WEBHOOK_SECRET_HEADER } from "../../lib/automation/dispatcher";
import { AUTOMATION_SCHEMA_VERSION, type AutomationPayload } from "../../lib/automation/types";

// The dispatcher against a real HTTP server rather than a stubbed fetch: the
// behaviours that matter here -- a slow peer, a non-2xx status, a body that is
// not the acknowledgement we require -- are properties of the wire, and a stub
// would just assert that the stub was called.
//
// No live n8n instance is involved. n8n availability is never a local test
// dependency; the mock fallback is a first-class demo path, not a degradation.

let server: Server;
let baseUrl = "";
let received: Array<{ headers: Record<string, string | undefined>; body: unknown }> = [];

/** Set per test to control what the fake n8n does. */
let respond: (send: (status: number, body: string, contentType?: string) => void) => void = (send) =>
  send(200, JSON.stringify({ accepted: true, taskId: "task_1" }));

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      received.push({
        headers: req.headers as Record<string, string | undefined>,
        body: raw ? JSON.parse(raw) : null,
      });
      respond((status, body, contentType = "application/json") => {
        res.writeHead(status, { "content-type": contentType });
        res.end(body);
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const PAYLOAD: AutomationPayload = {
  schemaVersion: AUTOMATION_SCHEMA_VERSION,
  idempotencyKey: "rev_test_x:evt_test_x",
  reviewId: "rev_test_x",
  taskType: "internal_followup",
  reviewState: "approved",
  workflowDecision: "block_client_draft",
  requiredApprovalLevel: "licensed_agent_required",
  clientDisplayName: "Demo Client C",
  products: ["Demo SecureRate 5", "Demo IndexFlex UL"],
  title: "Follow up: Demo SecureRate 5 × Demo IndexFlex UL (Demo Client C)",
  actionItems: ["州替换申报表 · State replacement forms"],
  reviewerInstructions: null,
  reviewUrl: "/review/rev_test_x",
  createdAt: "2026-08-02T12:00:00+00:00",
};

async function withEnv(
  env: { url?: string; secret?: string },
  run: () => Promise<void>,
): Promise<void> {
  const previous = { url: process.env.N8N_WEBHOOK_URL, secret: process.env.N8N_WEBHOOK_SECRET };
  if (env.url === undefined) delete process.env.N8N_WEBHOOK_URL;
  else process.env.N8N_WEBHOOK_URL = env.url;
  if (env.secret === undefined) delete process.env.N8N_WEBHOOK_SECRET;
  else process.env.N8N_WEBHOOK_SECRET = env.secret;
  received = [];
  try {
    await run();
  } finally {
    if (previous.url === undefined) delete process.env.N8N_WEBHOOK_URL;
    else process.env.N8N_WEBHOOK_URL = previous.url;
    if (previous.secret === undefined) delete process.env.N8N_WEBHOOK_SECRET;
    else process.env.N8N_WEBHOOK_SECRET = previous.secret;
  }
}

describe("mock fallback (test 6)", () => {
  it("6a: with no webhook configured nothing is sent and nothing claims it was", async () => {
    await withEnv({}, async () => {
      const result = await dispatchAutomation(PAYLOAD);
      expect(result.outcome).toBe("mocked");
      expect(received).toHaveLength(0);
    });
  });
});

describe("delivery (test 6)", () => {
  it("sends the payload with the secret in a header, never in the URL", async () => {
    await withEnv({ url: baseUrl, secret: "s3cr3t-demo" }, async () => {
      respond = (send) => send(200, JSON.stringify({ accepted: true, taskId: "task_42" }));
      const result = await dispatchAutomation(PAYLOAD);
      expect(result.outcome).toBe("delivered");
      if (result.outcome === "delivered") expect(result.ack.taskId).toBe("task_42");
      expect(received).toHaveLength(1);
      expect(received[0]!.headers[WEBHOOK_SECRET_HEADER.toLowerCase()]).toBe("s3cr3t-demo");
      expect(received[0]!.body).toEqual(PAYLOAD);
      expect(baseUrl).not.toContain("s3cr3t-demo");
    });
  });

  it("6b: a non-2xx response is a failure, not a delivery", async () => {
    await withEnv({ url: baseUrl }, async () => {
      respond = (send) => send(500, JSON.stringify({ accepted: false }));
      const result = await dispatchAutomation(PAYLOAD);
      expect(result.outcome).toBe("failed");
      if (result.outcome === "failed") {
        expect(result.errorCode).toBe("HTTP_STATUS");
        expect(result.responseCode).toBe(500);
      }
    });
  });

  it("6c: a 200 that is not the acknowledgement we require is a failure", async () => {
    for (const body of [
      "",
      "<html>Bad Gateway</html>",
      JSON.stringify({ accepted: true }),
      JSON.stringify({ accepted: false, taskId: "task_1" }),
      JSON.stringify({ accepted: true, taskId: "task_1", extra: "surprise" }),
    ]) {
      await withEnv({ url: baseUrl }, async () => {
        respond = (send) => send(200, body, "text/html");
        const result = await dispatchAutomation(PAYLOAD);
        expect(result.outcome, `body ${JSON.stringify(body)} was accepted`).toBe("failed");
        if (result.outcome === "failed") expect(result.errorCode).toBe("MALFORMED_RESPONSE");
      });
    }
  });

  it("6d: an unreachable peer fails without throwing", async () => {
    // Port 1 on loopback refuses immediately; no timeout wait needed.
    await withEnv({ url: "http://127.0.0.1:1/hook" }, async () => {
      const result = await dispatchAutomation(PAYLOAD);
      expect(result.outcome).toBe("failed");
      if (result.outcome === "failed") {
        expect(result.errorCode).toBe("NETWORK");
        expect(result.responseCode).toBeNull();
      }
    });
  });

  it("no secret is sent when none is configured", async () => {
    await withEnv({ url: baseUrl }, async () => {
      respond = (send) => send(200, JSON.stringify({ accepted: true, taskId: "task_1" }));
      await dispatchAutomation(PAYLOAD);
      expect(received[0]!.headers[WEBHOOK_SECRET_HEADER.toLowerCase()]).toBeUndefined();
    });
  });
});
