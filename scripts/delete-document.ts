import { createServiceClient } from "../lib/supabase/server.js";
import { getActiveDocument, deleteTestDocument, documentRowCounts } from "../lib/supabase/repository.js";

// Safe document deletion CLI — M2 scope: test_ documents only. There is
// deliberately NO production override: the three approved demo documents are
// only ever replaced through controlled ingestion, never deleted here.
// Pages/chunks are removed by FK cascade; ingestion_runs history is retained.

const arg = process.argv.slice(2).find((a) => a.startsWith("--document-id="));
const documentId = arg?.slice("--document-id=".length) ?? "";

if (!documentId) {
  console.error("Usage: delete-document --document-id=test_<id>");
  console.error("Only test_-prefixed business document ids can be deleted.");
  process.exit(1);
}
if (!documentId.startsWith("test_")) {
  console.error(
    `refusing to delete non-test document id "${documentId}" — only test_-prefixed ids are deletable in M2`,
  );
  process.exit(1);
}

const db = createServiceClient();
console.log(`target document: ${documentId}`);

const before = await documentRowCounts(db, documentId);
if (before.documents === 0) {
  console.log("not found — idempotent no-op (nothing deleted)");
  process.exit(0);
}

await deleteTestDocument(db, documentId);

const after = await getActiveDocument(db, documentId);
if (after !== null) {
  console.error("deletion did not remove the document row");
  process.exit(1);
}
console.log(
  `deleted: 1 document, ${before.pages} pages and ${before.chunks} chunks removed by cascade; ` +
    `ingestion_runs history retained`,
);
process.exit(0);
