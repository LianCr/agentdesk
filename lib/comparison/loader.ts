import "server-only";
import { buildClientRosterEntry, type ClientRosterEntry } from "./client-roster";
import { readComparisonCatalog, type Catalog } from "./catalog-files";

// Server-only loader for the committed comparison inputs. The browser never
// imports this module (and cannot: `server-only` makes that a build error), so
// product facts, derived chunks and synthetic cases stay on the server and the
// client receives only a finished ComparisonDraft.
//
// Everything is read from disk once and cached for the process — the
// comparison path performs no database and no network access at all.

let cached: Catalog | null = null;

export async function loadComparisonCatalog(): Promise<Catalog> {
  cached ??= await readComparisonCatalog(process.cwd());
  return cached;
}

// What the selection controls need. Products stay ids and display names; the
// clients carry their demo background too, because /compare shows a roster the
// way the assistant page shows its knowledge base. Everything in it is
// committed fictional demo data — no product facts and no chunk text.
export interface ComparisonOptions {
  products: Array<{ documentId: string; productName: string; productCategory: string }>;
  clients: ClientRosterEntry[];
}

export async function loadComparisonOptions(): Promise<ComparisonOptions> {
  const { products, cases } = await loadComparisonCatalog();
  return {
    products: products.map((p) => ({
      documentId: p.documentId,
      productName: p.productName,
      productCategory: p.productCategory,
    })),
    clients: cases.map(buildClientRosterEntry),
  };
}
