# Backlog

Optional improvements noted during development. None block the current
milestone; do not start these without explicitly re-scoping.

- **Byte-level deterministic PDFs.** Chromium embeds creation timestamps and
  document IDs, so regenerating identical content changes the PDF bytes and
  its sha256 (manifest must be regenerated together with the PDFs). Semantic
  stability is already enforced via per-page normalized-text digests
  (`generated/text-digest.json`). If byte determinism is ever needed, strip or
  pin PDF metadata post-generation. (Noted during M1.)
- **PDF visual spot-check tooling.** `pdftoppm` (poppler) is not installed on
  the dev machine; validation is text-based. A rendered-page snapshot check
  could catch purely visual regressions. (Noted during M1.)
