# Backlog

Optional improvements noted during development. None block the current
milestone; do not start these without explicitly re-scoping.

## M3.1 — Evaluation Harness Robustness (non-blocking, before M7)

**Status: deferred, does not block M4/M5/M6.** M3's product contract is
validated by deterministic invariants (see `docs/m3-evaluation.md`), but the
red-team harness still leans on free-text regex detectors whose false
positives — not system failures — prevented a clean repeated-run result. All
failed-run artifacts are preserved in `evals/results/diagnostics/` for
diagnosis; none may be deleted for convenience.

Scope:

- finish migrating every assertion to structured pipeline state
  (`GroundedAnswer`, validated claims, claim-level citations, red-line
  decisions, review reasons, requested-facet support, refusal reason)
- reduce remaining free-text regex dependence to secondary observation only,
  reusing production classifiers instead of a second semantic implementation
- run an N-run stability analysis with the corrected harness
  (`evals/summarize-runs.ts`: hard gates per run, never averaged)
- report stochastic quality metrics as min/median/max distributions
- establish those distributions **before** public deployment / application
  packaging (M7)

Not in scope: changing the frozen dataset to make runs pass, or relaxing any
deterministic core invariant.

## Other noted improvements

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
- **hit@1 gap on one bilingual phrasing.** One eval case ranks a sibling
  chunk of the correct document first (hit@1 95%, hit@3 100%); harmless with
  top-8 answering — revisit ranking only if M6's larger rubric shows a
  pattern. (M3-D.)
- **Red-line paraphrase coverage.** Deterministic regexes intentionally
  narrow; paraphrased bypass attempts fall through to evidence-only
  generation + citation validation (verified safe in red-team). Consider a
  broader classifier corpus in M6. (M3-D.)
- **Answer latency.** Median ~26s, p95 ~53s, dominated by the reasoning
  answer model; acceptable for the demo with staged progress UX. If M7 needs
  faster demos, evaluate a lighter ANSWER_MODEL setting against the frozen
  eval before switching. (M3-D.)
