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

## M4.1 — Narrative Reliability & Performance (non-blocking, before M7)

**Status: deferred, does not block M5/M6.** M4's comparison table, citations,
observations, missing information, review flags and status are deterministic
and gated (see `docs/m4-evaluation.md`); the optional narrative is the only
stochastic surface, and its availability is deliberately not an M4 gate.

Scope:

- measure narrative acceptance across repeated runs per pair and language
  (accepted / rejected by guard / timeout / provider failure)
- report the latency distribution separately from deterministic comparison
  latency, which is currently ~1 ms
- decide a timeout policy — the present 90-second bound is demo behaviour,
  chosen because this model's measured p95 in M3 was ~53 s, not a release
  target
- compare a cheaper or faster model tier for the explanation task if the
  distribution justifies it
- decide the loading strategy (explicit button vs auto-load after the table)

Not in scope: making narrative wording a feature gate, or relaxing any
narrative guard to raise the acceptance rate.

## UI rule: one real-world action per screen (post-M7, applied 2026-08)

The three surfaces end in exactly one code-chosen action (`/` → build a
comparison / get it from the documents / hand to a person; `/compare` → send
to review, or "usable internally"; `/review` → next pending review). Metrics,
reason chips and technical state are folded into that card or collapsed.
The yardstick for any later UI change: **does the user have fewer decisions
to make after reading, not more.** Design references behind it:

- Krug, *Don't Make Me Think* — cut decisions per screen, not information.
- Thaler & Sunstein, choice architecture — one default path beats a menu.
- Klein, recognition-primed decision making — field experts act on
  "situation → one move", not on comparing N options.
- Clinical alert-fatigue literature — stacked warnings get ignored; one
  sentence on why a human is needed, details folded.
- Aviation / surgical checklist design — the checklist appears before the
  evidence and each item is a concrete act, not an explanation.

Still open under this rule: the review queue page could surface the single
oldest pending item as its primary action instead of a table.

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
- **INFRA-01 — one unreproduced partial DB-suite failure.** During M5-B a
  single `npm run test:db` run reported 6 failed files with `15 passed | 49
  skipped`; every subsequent run, including two deliberate reproduction
  attempts under the suspected conditions, was fully green. Cause unknown; no
  root cause is claimed. Re-investigate only if it reproduces. (M5-B.)
- **Production authentication and RBAC.** M5 writes a server-owned placeholder
  reviewer (`"Demo Reviewer"`); the hard gate only guarantees the browser
  cannot supply or override it. Real accounts, roles and assignment are out of
  demo scope. (M5-D.)
- **`annuity_suitability` has no ReviewFlag counterpart.** It is one of Case
  C's declared fixture risk flags. Force-mapping it onto a semantically
  different flag would make the metric a lie, so it is recorded as a
  vocabulary gap with a mutation test watching that it is not quietly mapped.
  Revisit if a suitability-specific flag earns its place. (M5-D.)
- **Revision requests do not regenerate the draft.** v1 records the
  instructions and moves to a terminal state; acting on them produces a new
  review. Automatic regeneration is a full iterative-editing system and is
  deliberately deferred. (M5-D.)
- **Checklist completion is not persisted.** Still true. The checklist now has
  per-item ticks, but they live in React state only: cleared on reload, never
  submitted with the decision, and with no effect on the approve/reject controls.
  The UI says so. Revisit if the workflow ever needs a real per-item sign-off,
  which would mean a new table plus an audit event. (M5-D; revised when the
  checklist became interactive.)
- **`allow_checklist_only` can still be human-approved.** M5's state machine
  keys only on `reviewState`, so a comparison whose facts could not be verified
  can be approved by a reviewer. M5.1 fails closed downstream -- automation is
  refused with `FACTS_UNVERIFIED` -- rather than changing M5 semantics late.
  Revisit if the review UI should refuse the approval itself. (M5.1.)
- **No production authentication or RBAC.** `"Demo Reviewer"` remains a
  server-owned placeholder on both the review and the automation paths. (M5.1.)
- **No production PII handling or outbound client communication.** Payload
  client data is synthetic, and the system has no capability to contact a
  client at all -- by design, not by configuration. (M5.1.)
- **No real external integrations beyond the demo n8n webhook.** No email, SMS,
  Slack or CRM node exists in the workflow. (M5.1.)
- **Retry policy is intentionally minimal.** Manual re-run, capped at three
  attempts, no queue, worker, backoff or automatic retry. (M5.1.)
- **`/review/[reviewId]` overflows ~11px at 375px.** Measured on `main` before
  and after the checklist became interactive: identical both times, and every
  offending element is comparison-table internals, so the checklist is not the
  cause. Same family as the M6 finding below; worth folding into the same fix.
  (Observed while verifying the interactive checklist.)
- **Viewport tests covered only the review queue.** M5-C's narrow-viewport test
  checked `/review`, which has no wide table, so the comparison table pushing
  the page wider than a phone screen survived until M6 demo acceptance found
  it. Consider asserting zero horizontal overflow on every page that renders
  the comparison table. (M6.)
- **Voice input accuracy is unverified on real speech.** The API path was smoked
  with macOS `say` synthetic audio, which is harder for ASR than natural speech:
  English transcribed exactly 3/3, Chinese 2/3 (one run produced 有限金 for
  有现金). A browser microphone smoke was never run because this environment has
  no microphone. The transcript is deliberately never auto-submitted, which is
  what makes the remaining error rate a review step rather than a wrong answer.
  (Voice input.)
- **UI knowledge-base assertions count raw rows.** Three UI tests assert
  documents/pages/chunks == 3/20/45 including test-prefixed rows, so residue
  left by an unrelated failing DB suite makes them red and points at the wrong
  component. validate:ingestion already separates non-test totals from residue;
  the UI tests could do the same. (Observed during M6 push verification.)
