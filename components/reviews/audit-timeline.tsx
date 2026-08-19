import type { UiReviewEvent } from "./types";

// Append-only history. Order is the server's `occurred_at ascending`, kept as
// received: this is a record, not a view that reorders itself.
//
// Internal row ids are not shown. An event id tells a reviewer nothing and
// only invites them to treat a database key as evidence.

const EVENT_LABELS: Record<UiReviewEvent["eventType"], { zh: string; en: string }> = {
  REVIEW_CREATED: { zh: "审核项创建", en: "Review item created" },
  APPROVED: { zh: "已批准", en: "Approved" },
  REJECTED: { zh: "已拒绝", en: "Rejected" },
  REVISION_REQUESTED: { zh: "要求修改", en: "Revision requested" },
};

function noteOf(event: UiReviewEvent): string | null {
  for (const key of ["reason", "instructions", "note"]) {
    const value = event.payload[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export function AuditTimeline({ events }: { events: UiReviewEvent[] }) {
  return (
    <section data-testid="audit-timeline" className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">审计记录 · Audit history</h2>
      <ol className="mt-3 flex flex-col gap-3">
        {events.map((event) => {
          const note = noteOf(event);
          return (
            <li
              key={event.eventId}
              data-testid="audit-event"
              data-event-type={event.eventType}
              className="border-l-2 border-slate-200 pl-3"
            >
              <p className="text-sm font-medium text-slate-800">
                {EVENT_LABELS[event.eventType].zh} · {EVENT_LABELS[event.eventType].en}
              </p>
              <p className="text-xs text-slate-500">
                <span className="whitespace-nowrap">{event.actor}</span> ·{" "}
                <time dateTime={event.occurredAt} className="whitespace-nowrap tabular-nums">
                  {event.occurredAt.slice(0, 10)} {event.occurredAt.slice(11, 16)}
                </time>
              </p>
              {note && <p className="mt-1 text-sm text-slate-700">{note}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
