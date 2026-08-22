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

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** A query value is only honoured when it names something in the catalog. */
function pick(value: string | string[] | undefined, allowed: Set<string>, fallback: string): string {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const { products, clients } = await loadComparisonOptions();
  // The knowledge assistant hands over the product it was asked about via
  // ?a=, ?b=, ?client=. The values are untrusted input: anything that is not a
  // documentId / caseId in the committed catalog falls back to the default.
  const query = await searchParams;
  const productIds = new Set(products.map((p) => p.documentId));
  const clientIds = new Set(clients.map((c) => c.caseId));
  const a = pick(query.a, productIds, DEFAULTS.productAId);
  let b = pick(query.b, productIds, DEFAULTS.productBId);
  if (b === a) {
    b = products.find((p) => p.documentId !== a)?.documentId ?? b;
  }
  const defaults = {
    productAId: a,
    productBId: b,
    clientCaseId: pick(query.client, clientIds, DEFAULTS.clientCaseId),
  };
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <ComparisonWorkbench products={products} clients={clients} defaults={defaults} />
        <Disclaimer />
      </div>
    </main>
  );
}
