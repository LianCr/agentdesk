import { createServiceClient } from "../lib/supabase/server";
import { loadTriageCorpus } from "../lib/support/kb";
import { createSupportTicket, performTicketAction, type TicketActionInput } from "../lib/support/service";
import { suggestEscalation } from "../lib/support/escalation";
import type { Ticket, TicketInput } from "../lib/support/types";

// SYNTHETIC demo data for the support desk. Every ticket id starts with
// tkt_seed_, every row has seed = true, every requester is "Synthetic …",
// and the UI labels all of it as demo data. None of it is a real customer,
// ticket or team metric.
//
// Times are backdated relative to NOW so the queue shows every SLA state
// (breached, at risk, on track, met, met-late). They drift as time passes —
// rerun to refresh. Reruns delete only tkt_seed_ rows (the append-only
// trigger allows that for seed and test ids, nothing else).
//
//   npx tsx scripts/seed-support-tickets.ts

const MIN = 60_000;
const NOW = Date.now();
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * MIN);

type Step = { minutesAgo: number; action: (t: Ticket) => TicketActionInput };
type Seed = { id: string; minutesAgo: number; input: TicketInput; steps?: Step[] };

const t = (subject: string, body: string, requester: string, channel: TicketInput["channel"] = "form"): TicketInput => ({ subject, body, requester, channel });

const approve = (edited = false): Step["action"] => (tk) => ({
  action: "APPROVE_DRAFT", expectedStatus: tk.status, actor: "Demo Agent A",
  replyText: edited ? `${tk.triage.draft!.text}\n\nP.S. Happy to walk you through it on a call.` : tk.triage.draft!.text,
});
const reply = (actor: "Demo Agent A" | "Demo Agent B" | "Demo Agent C", text: string): Step["action"] => (tk) => ({ action: "LOG_REPLY", expectedStatus: tk.status, actor, replyText: text });
const ask = (actor: "Demo Agent A" | "Demo Agent B" | "Demo Agent C", text: string): Step["action"] => (tk) => ({ action: "REQUEST_INFO", expectedStatus: tk.status, actor, replyText: text });
const escalate = (actor: "Demo Agent A" | "Demo Agent B", extra: Partial<ReturnType<typeof suggestEscalation>>): Step["action"] => (tk) => ({
  action: "ESCALATE", expectedStatus: tk.status, actor, escalation: { ...suggestEscalation(tk), ...extra },
});

const SEEDS: Seed[] = [
  { id: "tkt_seed_p1_compare_500", minutesAgo: 50, input: t("Compare page returns 500 for everyone in our office", "Since this morning Product Comparison returns a 500 internal server error for everyone in our office. Steps: 1. Open Product Comparison 2. Pick Demo SecureRate 5 and Demo IndexFlex UL 3. Click compare. Chrome on macOS. Request id demo-req-7731.", "Synthetic Broker 01", "email") },
  { id: "tkt_seed_p1_assistant_down", minutesAgo: 180, input: t("Assistant down for the whole team", "The assistant page is down for the whole team; every typed question fails with an error after a long spinner. We cannot work. Request id demo-req-5120.", "Synthetic Broker 02", "email"),
    steps: [
      { minutesAgo: 172, action: reply("Demo Agent A", "Thanks for flagging — we can see failures on typed questions and are investigating now. Sample question chips still work as a workaround.") },
      { minutesAgo: 150, action: escalate("Demo Agent A", { reproAttempted: true, reproResult: "Reproduced: typed question fails after ~60 s; sample chips answer instantly", expected: "Grounded answer in 28–76 s", actual: "Error after a long spinner", affectedUsers: "Whole team at one brokerage (~12 users, synthetic)", workaround: "Use the sample question chips", environment: "Chrome on macOS, /api/answer", ruledOut: ["Not a rate limit: no 429 in the response", "Not one user's browser: three colleagues reproduce", "Sample chips work, so the page itself loads"] }) },
    ] },
  { id: "tkt_seed_p2_review_spinner", minutesAgo: 300, input: t("Review page stuck on loading", "When I open a review from the queue the page is stuck on a spinner and I cannot approve it. Steps: 1. Open Review Queue 2. Click the newest review. Safari on iPhone.", "Synthetic Broker 03") },
  { id: "tkt_seed_p2_delete_data", minutesAgo: 60, input: t("Please delete my data", "Please delete my data and everything you store about me.", "Synthetic Broker 04", "email"),
    steps: [{ minutesAgo: 55, action: (tk) => ({ action: "ASSIGN", expectedStatus: tk.status, actor: "Demo Agent B", assignee: "Demo Agent B" }) }] },
  { id: "tkt_seed_p2_best_product", minutesAgo: 200, input: t("Which product is best for my client?", "Which product is best for a 45 year old client? Just tell me which one to recommend.", "Synthetic Broker 05") },
  { id: "tkt_seed_p3_rate_limit", minutesAgo: 30, input: t("Getting HTTP 429 when asking questions", "I asked a few questions in a row and now every typed question says Too many requests with HTTP 429. How long do I have to wait?", "Synthetic Broker 06") },
  { id: "tkt_seed_p3_cash_value", minutesAgo: 120, input: t("Does TermPlus 20 have cash value?", "A client asked whether the Demo TermPlus 20 policy builds any cash value. What does the product guide say?", "Synthetic Broker 07", "api") },
  { id: "tkt_seed_p3_cash_value_zh", minutesAgo: 450, input: t("定期寿险有现金价值吗？", "客户问 Demo TermPlus 20 定期寿险有没有现金价值？", "Synthetic Broker 08") },
  { id: "tkt_seed_p3_send_review", minutesAgo: 1440, input: t("How do I send a comparison for review?", "How do I send a comparison draft for review, and what happens if I send it twice?", "Synthetic Broker 09"),
    steps: [{ minutesAgo: 1380, action: approve(false) }] },
  { id: "tkt_seed_p3_voice", minutesAgo: 2880, input: t("Does voice input send automatically?", "How does voice input work? Does it send my question automatically after I speak?", "Synthetic Broker 10"),
    steps: [{ minutesAgo: 2820, action: approve(true) }] },
  { id: "tkt_seed_p3_wrong_page", minutesAgo: 1440, input: t("Citation link opens the wrong page", "The citation link for the surrender charge quote opens the wrong page of the SecureRate 5 PDF. It still works otherwise. Firefox on Windows.", "Synthetic Broker 11"),
    steps: [{ minutesAgo: 1200, action: ask("Demo Agent C", "Thanks — could you tell us which question you asked, so we can reproduce the exact citation?") }] },
  { id: "tkt_seed_p4_excel", minutesAgo: 4320, input: t("Feature request: export to Excel", "It would be great if you could add an export of the comparison table to Excel.", "Synthetic Broker 12"),
    steps: [{ minutesAgo: 2880, action: ask("Demo Agent B", "Thanks for the suggestion — logged for the product team. Would CSV work for you too?") }] },
  { id: "tkt_seed_p3_salesforce_a", minutesAgo: 360, input: t("Can AgentDesk sync with Salesforce?", "Can I connect AgentDesk to our Salesforce instance so client notes sync?", "Synthetic Broker 13") },
  { id: "tkt_seed_p3_salesforce_b", minutesAgo: 240, input: t("Salesforce sync for client notes", "Is there a Salesforce sync for client notes?", "Synthetic Broker 14", "email") },
  { id: "tkt_seed_p3_password_late", minutesAgo: 540, input: t("Do I need a password?", "Do I need an account or a password to use AgentDesk?", "Synthetic Broker 15"),
    steps: [{ minutesAgo: 30, action: reply("Demo Agent C", "No password is needed — the demo has no login. Anyone with the link can open it.") }] },
  { id: "tkt_seed_p2_narrative_fixed", minutesAgo: 2880, input: t("Narrative fails to load on compare", "The comparison narrative fails with an error every time and I cannot share it with my manager. Chrome on Windows, /compare.", "Synthetic Broker 16"),
    steps: [
      { minutesAgo: 2850, action: reply("Demo Agent B", "Thanks — reproducing now. The comparison table itself is unaffected.") },
      { minutesAgo: 2800, action: escalate("Demo Agent B", { reproAttempted: true, reproResult: "Reproduced on Chrome; narrative times out", affectedUsers: "1 requester", workaround: "The 13-row table is code-generated and still available", ruledOut: ["Table still renders, so the comparison engine is fine"] }) },
      { minutesAgo: 1700, action: (tk) => ({ action: "ENGINEERING_RETURNED", expectedStatus: tk.status, actor: "Demo Agent B", note: "Engineering raised the narrative timeout; fix deployed (synthetic)." }) },
      { minutesAgo: 1650, action: (tk) => ({ action: "RESOLVE", expectedStatus: tk.status, actor: "Demo Agent B", resolutionNote: "Confirmed with requester that the narrative loads again." }) },
    ] },
];

async function main(): Promise<void> {
  const db = createServiceClient();
  const corpus = await loadTriageCorpus(process.cwd());
  for (const table of ["ticket_events", "support_tickets"]) {
    const { error } = await db.from(table).delete().like("ticket_id", "tkt\\_seed\\_%");
    if (error) throw new Error(`SEED_CLEANUP_FAILED: ${table}`);
  }
  for (const s of SEEDS) {
    let ticket = await createSupportTicket({ db, corpus, requestId: null, now: at(s.minutesAgo) }, s.input, { ticketId: s.id, seed: true });
    for (const step of s.steps ?? []) {
      const out = await performTicketAction({ db, corpus, requestId: null, now: at(step.minutesAgo) }, s.id, step.action(ticket));
      if (!out || out.result !== "applied") throw new Error(`SEED_STEP_FAILED: ${s.id} ${out?.result}`);
      ticket = out.ticket;
    }
    console.log(`${s.id.padEnd(30)} ${ticket.priority} ${ticket.category.padEnd(16)} ${ticket.status}`);
  }
  console.log(`\nSeeded ${SEEDS.length} synthetic tickets (seed = true).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
