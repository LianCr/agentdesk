import { AssistantDemo } from "../components/chat/assistant-demo";
import { loadKnowledgeSummary } from "../lib/knowledge/summary";

// Server component: the knowledge-base figures are derived from committed data
// on the server, so the page ships them already rendered — no client fetch and
// no loading state for the first thing a visitor reads.

export default async function HomePage() {
  return <AssistantDemo knowledgeSummary={await loadKnowledgeSummary()} />;
}
