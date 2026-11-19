import { HandoffView } from "../../../components/support/handoff-view";

export const metadata = {
  title: "AgentDesk — 交接班 Shift Handoff",
};

export default function HandoffPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <HandoffView />
      </div>
    </main>
  );
}
