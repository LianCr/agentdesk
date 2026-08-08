import "server-only";
import { AutomationAckSchema, type AutomationAck, type AutomationPayload } from "./types";

// The one place AgentDesk talks to n8n.
//
// Built-in fetch: calling a webhook does not need an SDK. The URL and the
// shared secret are read from the server environment and never reach the
// browser -- the browser cannot name a destination, so there is nothing to
// leak and nothing to redirect.
//
// This is a webhook, not a generation task, so the timeout is short. The M4
// narrative path waits 90 seconds because a model may think for that long; a
// workflow trigger that has not answered in ten is not going to.

const TIMEOUT_MS = 10_000;
export const WEBHOOK_SECRET_HEADER = "X-AgentDesk-Webhook-Secret";

export type DispatchResult =
  | { outcome: "mocked" }
  | { outcome: "delivered"; responseCode: number; ack: AutomationAck }
  | { outcome: "failed"; responseCode: number | null; errorCode: string };

export interface Dispatcher {
  (payload: AutomationPayload): Promise<DispatchResult>;
}

/**
 * Sends the payload, or reports that it did not.
 *
 * With no webhook URL configured the result is `mocked`, which is NOT a
 * flavour of delivered: nothing left the process and the caller must say so.
 * A malformed acknowledgement is `failed` for the same reason -- a 200 with an
 * HTML error page in it is not a workflow that ran.
 */
export async function dispatchAutomation(payload: AutomationPayload): Promise<DispatchResult> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return { outcome: "mocked" };

  const secret = process.env.N8N_WEBHOOK_SECRET;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // In a header, never a query string: URLs end up in logs and history.
        ...(secret ? { [WEBHOOK_SECRET_HEADER]: secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { outcome: "failed", responseCode: null, errorCode: timedOut ? "TIMEOUT" : "NETWORK" };
  }

  if (!response.ok) {
    // The body is not read: it is written by another system and may contain
    // anything. The status code is what we chose to depend on.
    return { outcome: "failed", responseCode: response.status, errorCode: "HTTP_STATUS" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { outcome: "failed", responseCode: response.status, errorCode: "MALFORMED_RESPONSE" };
  }

  const ack = AutomationAckSchema.safeParse(body);
  if (!ack.success) {
    return { outcome: "failed", responseCode: response.status, errorCode: "MALFORMED_RESPONSE" };
  }
  return { outcome: "delivered", responseCode: response.status, ack: ack.data };
}
