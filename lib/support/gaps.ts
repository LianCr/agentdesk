import type { Ticket } from "./types";

// Knowledge-base gaps, computed on read. Tickets the knowledge base could not
// answer well (match level low or medium, no red line, an answerable
// category) are grouped — across categories — by the ticket words the knowledge base has never
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
  const candidates = tickets.filter(isGapCandidate);
  const termsOf = (t: Ticket) => {
    const unknown = t.triage.retrieval.unknownTerms;
    return unknown.length ? unknown : t.triage.retrieval.searchedTerms;
  };
  // The key is the ticket's missing term that the MOST candidate tickets
  // share, so "Salesforce sync?" and "connect to our Salesforce instance"
  // land in one gap. Ties break alphabetically, so grouping is deterministic.
  const freq = new Map<string, number>();
  for (const t of candidates) for (const term of new Set(termsOf(t))) freq.set(term, (freq.get(term) ?? 0) + 1);
  const groups = new Map<string, Ticket[]>();
  for (const t of candidates) {
    const key = [...new Set(termsOf(t))].sort((x, y) => (freq.get(y)! - freq.get(x)!) || x.localeCompare(y))[0] ?? "untitled";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([gapKey, list]) => {
      const terms = [gapKey];
      const title = `Help article needed: ${list[0]!.subject}`;
      const markdown = [
        `# ${title}`,
        "",
        `${list.length} ticket(s) · categories: ${[...new Set(list.map((t) => t.category))].join(", ")} · missing term: ${gapKey}`,
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
