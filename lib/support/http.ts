import { NextResponse } from "next/server";

// Error responses for the support routes: a stable code and a bilingual
// message, never the underlying error text (same "codes only" rule as the
// rest of the API).

export function supportError(err: unknown, event: string, fallback: string): NextResponse {
  const message = err instanceof Error ? err.message : "";
  const code = message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? fallback;
  console.error(JSON.stringify({ event, code })); // sanitized: code only
  return NextResponse.json(
    { error: code, message: "处理工单时出现问题，请重试。Something went wrong handling the ticket request." },
    { status: 500 },
  );
}

export const notFound = () =>
  NextResponse.json({ error: "TICKET_NOT_FOUND", message: "找不到该工单。Ticket not found." }, { status: 404 });

export const badRequest = (error: string, en: string, zh: string) =>
  NextResponse.json({ error, message: `${zh} ${en}` }, { status: 400 });
