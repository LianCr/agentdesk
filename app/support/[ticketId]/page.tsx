import { TicketDetail } from "../../../components/support/ticket-detail";

export const metadata = {
  title: "AgentDesk — 工单 Ticket",
};

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <TicketDetail ticketId={ticketId} />
      </div>
    </main>
  );
}
