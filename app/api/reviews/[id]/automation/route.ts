import "server-only";
import { NextResponse } from "next/server";
import { describeAutomation, runAutomation } from "../../../../../lib/automation/run";
import { ELIGIBILITY_MESSAGES } from "../../../../../lib/automation/eligibility";
import { createServiceClient } from "../../../../../lib/supabase/server";

// Post-review automation.
//
// The request body is empty on purpose. A caller cannot supply a task type, a
// destination, a payload, a status or an idempotency key -- there is no field
// for any of them, and the server rebuilds all five from the stored review and
// its audit events.
//
// GET describes what WOULD happen and sends nothing. Only POST dispatches, and
// only because a human pressed a button.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const described = await describeAutomation(createServiceClient(), id);
    return NextResponse.json(serialize(described));
  } catch (err) {
    return errorResponse(err, "automation_describe_error");
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const db = createServiceClient();
    const result = await runAutomation({ db }, id);
    if (result.status === "not_eligible") {
      const message = ELIGIBILITY_MESSAGES[result.plan.reason];
      return NextResponse.json(
        { error: result.plan.reason, message: `${message.zh} ${message.en}` },
        { status: 400 },
      );
    }
    return NextResponse.json(serialize(await describeAutomation(db, id)));
  } catch (err) {
    return errorResponse(err, "automation_run_error");
  }
}

function serialize(described: Awaited<ReturnType<typeof describeAutomation>>) {
  return {
    eligible: described.plan.eligible,
    taskType: described.plan.eligible ? described.plan.taskType : null,
    ineligibleReason: described.plan.eligible ? null : described.plan.reason,
    // The payload is shown so a reviewer can see exactly what would be sent —
    // it is built from stored data and contains no secret and no recipient.
    payload: described.payload,
    runs: described.runs,
  };
}

function errorResponse(err: unknown, event: string): NextResponse {
  const message = err instanceof Error ? err.message : "";
  const code = message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? "AUTOMATION_FAILED";
  console.error(JSON.stringify({ event, code })); // sanitized: code only
  const notFound = code === "REVIEW_NOT_FOUND";
  return NextResponse.json(
    {
      error: code,
      message: notFound
        ? "找不到该审核项。Review not found."
        : "运行自动化时出现问题，请重试。Something went wrong running the automation.",
    },
    { status: notFound ? 404 : 500 },
  );
}
