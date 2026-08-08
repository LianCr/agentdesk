import { ReviewDetail } from "../../../components/reviews/review-detail";
import { Disclaimer } from "../../../components/shell/disclaimer";

export const metadata = {
  title: "AgentDesk — 审核项 Review Item",
};

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <ReviewDetail reviewId={reviewId} />
        <Disclaimer />
      </div>
    </main>
  );
}
