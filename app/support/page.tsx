import { SupportQueue } from "../../components/support/support-queue";

export const metadata = {
  title: "AgentDesk — 支持工单 Support Desk",
};

export default function SupportQueuePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <SupportQueue />
      </div>
    </main>
  );
}
