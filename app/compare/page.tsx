import { ComparisonWorkbench } from "../../components/comparison/comparison-workbench";
import { Disclaimer } from "../../components/shell/disclaimer";
import { loadComparisonOptions } from "../../lib/comparison/loader";

// Server component: the option lists are read from committed data on the
// server, so the browser bundle never contains product facts, chunk text or
// any loader code.

export const metadata = {
  title: "AgentDesk — 产品比较草稿 Product Comparison Draft",
};

// A demo starting point, not a suggestion: these three are simply the pair a
// reviewer is most likely to want to see first.
const DEFAULTS = {
  productAId: "doc_termplus20_v1",
  productBId: "doc_indexflex_ul_v1",
  clientCaseId: "DEMO-2026-001",
};

export default async function ComparePage() {
  const { products, clients } = await loadComparisonOptions();
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <ComparisonWorkbench products={products} clients={clients} defaults={DEFAULTS} />
        <Disclaimer />
      </div>
    </main>
  );
}
