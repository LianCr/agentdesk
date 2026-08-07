# Backlog

Optional improvements noted during development. None block the current
milestone; do not start these without explicitly re-scoping.

- **Byte-level deterministic PDFs.** Chromium embeds creation timestamps and
  document IDs, so regenerating identical content changes the PDF bytes and
  its sha256 (manifest must be regenerated together with the PDFs). Semantic
  stability is already enforced via per-page normalized-text digests
  (`generated/text-digest.json`). If byte determinism is ever needed, strip or
  pin PDF metadata post-generation. (Noted during M1.)
- **PDF visual spot-check tooling.** Addressed in M2 via
  `npm run render:pages` (Playwright screenshots to git-ignored
  tmp/visual-qa). A committed snapshot-diff check remains future work.
  (Noted during M1.)
- **ANN/HNSW vector index.** At 45 chunks exact scan is optimal; add an
  HNSW index (vector(1536) fits pgvector's 2000-dim index limit) when the
  corpus grows past ~10k chunks. (Noted during M2.)
- **Separate test/demo Supabase projects.** Integration tests currently
  share the demo project using test_-prefixed ids with hard guards; a
  dedicated test project would remove even that residual risk. (M2.)
- **Scheduled stale-run cleanup.** Stale running runs are detected and
  reported by validate:ingestion but never auto-deleted; a maintenance
  command or schedule is deliberately deferred. (M2.)
- **Public regulatory PDF ingestion.** The CDI/NAIC guides are documented
  in data/public-documents but not downloaded or ingested; revisit when M3
  retrieval quality would benefit. (M2.)
- **Production monitoring/alerting.** Out of demo scope. (M2.)
