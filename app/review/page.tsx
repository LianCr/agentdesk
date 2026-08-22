import { ReviewQueue } from "../../components/reviews/review-queue";
import { Disclaimer } from "../../components/shell/disclaimer";

// CLAUDE.md §11 names this route in the singular. The queue itself is a client
// component so the rows come from the summary endpoint rather than being
// embedded in the HTML — the same data path the UI tests exercise.

export const metadata = {
  title: "AgentDesk — 审核队列 Review Queue",
};

export default function ReviewQueuePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <ReviewQueue />
        <Disclaimer />
      </div>
    </main>
  );
}
