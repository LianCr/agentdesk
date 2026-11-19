import type { Ticket } from "./types";

// Knowledge-base gaps, computed on read. Tickets the knowledge base could not
// answer well (match level low or medium, no red line, an answerable
// category) are grouped by the ticket words the knowledge base has never
// seen — those words ARE the missing article.
//
// The suggested article is a skeleton: a title and the requesters' own
// questions, verbatim. The answer is left blank on purpose. Code does not
// know the answer, and inventing one is exactly what this repo refuses to do.

const GAP_CATEGORIES = new Set(["how_to", "product_question", "access", "other"]);

export interface KbGap {
  gapKey: string;
  terms: string[];
  ticketIds: string[];
  count: number;
  suggestedArticle: { title: string; markdown: string };
}

export function isGapCandidate(t: Ticket): boolean {
  return GAP_CATEGORIES.has(t.category) && !t.triage.redline.hard && t.triage.match.level !== "high";
}

export function findKbGaps(tickets: Ticket[]): KbGap[] {
  const groups = new Map<string, Ticket[]>();
  for (const t of tickets.filter(isGapCandidate)) {
    const unknown = t.triage.retrieval.unknownTerms;
    const terms = (unknown.length ? unknown : t.triage.retrieval.searchedTerms).slice().sort().slice(0, 2);
    const key = `${t.category}:${terms.join("+") || "untitled"}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([gapKey, list]) => {
      const terms = gapKey.split(":")[1]!.split("+");
      const title = `Help article needed: ${list[0]!.subject}`;
      const markdown = [
        `# ${title}`,
        "",
        `Category: ${list[0]!.category} · ${list.length} ticket(s) · missing terms: ${terms.join(", ")}`,
        "",
        "## Questions people asked (verbatim)",
        ...list.map((t) => `- "${t.subject}" (${t.ticketId})`),
        "",
        "## Answer",
        "_To be written by a support engineer. Not generated._",
      ].join("\n");
      return { gapKey, terms, ticketIds: list.map((t) => t.ticketId), count: list.length, suggestedArticle: { title, markdown } };
    })
    .sort((a, b) => b.count - a.count || a.gapKey.localeCompare(b.gapKey));
}
