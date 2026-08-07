# Model Selection (M3)

Business correctness — verifiable citations, deterministic refusals — is the
product value. Model choice serves that; it is not the headline.

## Embedding model

**OpenAI `text-embedding-3-large` at `dimensions: 1536`** (via the Vercel AI
SDK `embedMany`).

- Mandated as project default (CLAUDE.md §8); strongest multilingual retrieval
  quality among the candidates, which matters because Chinese questions search
  English chunks directly (dual-route design).
- 1536 dims via the API's native MRL truncation: half the storage and keeps a
  future pgvector ANN index possible (2000-dim index limit); measured recall
  on this corpus is 7/7 hit@1 (docs/retrieval-calibration.md).
- Corpus cost ≈ $0.001 per full ingestion; query embedding cost ≈ $0.

## Query languages and the three retrieval routes

Measured, not assumed (docs/retrieval-calibration.md):

- **zh → original + glossary + GPT-5-mini rewrite.** The LLM rewrite
  materially improved recall in every calibration run (fixed a hit@1 miss).
- **mixed zh/en → original + deterministic glossary only.** English anchors
  already present; the LLM rewrite added rank noise and is run-to-run
  nondeterministic, while the glossary route is free and deterministic.
- **en → single route.** All English probes hit@1 unaided.

## Answer model

**OpenAI GPT-5-mini** (`ANSWER_MODEL` env var; no UI model switcher — an
unconfigured provider must never silently appear available).

Candidates compared: GPT-5-mini, Claude Sonnet 4.5, Gemini 2.5 Flash. All
three clear the bar on Chinese quality and general capability; the decision
weights were:

1. **Strict structured output** is the most load-bearing capability in the
   two-stage design (the model emits only a strict-schema draft). OpenAI's
   json_schema mode is the most reliable of the three here.
2. **Citation obedience** favors Claude Sonnet 4.5, but the architecture
   deliberately does not depend on model obedience: quotes are verified as
   exact substrings and citation metadata is code-injected, neutralizing that
   advantage.
3. **Operational simplicity**: the OpenAI key already provisioned for
   embeddings serves the answer model — zero new dependencies or keys. This
   was a tie-breaker, not the reason.

One provider only in the main demo: every additional provider is a second
failure mode, a second key, and a second behavior profile to validate — with
no demo value, since the UI never exposes a model choice.

## Structured output + two-stage citation architecture

The model outputs a `ModelDraft` (sections + claims + evidence handles +
verbatim quote selections) under a strict zod schema. Code then: verifies each
quote is an exact normalized substring of the retrieved chunk, injects all
citation metadata (document, page, chunk) from retrieval, forces factual
labeling for numeric/negative claims, drops anything unverifiable, computes
evidence status deterministically, and renders the visible answer exclusively
from validated claims (with an integrity assertion). Bounded repair: one
retry, then MODEL_OUTPUT_INVALID refusal.

## Cost and latency (measured on the live acceptance set)

- Per Q&A: ~2.5–4k input + ~1–2k output tokens ≈ **$0.003–0.006** with
  GPT-5-mini; a 20-question demo stays well under $0.2 including retries.
- Latency: 15–55s end to end, dominated by the reasoning answer call
  (retrieval + rewrite ≈ 1–3s). The demo UI (M3-C) will show staged progress
  indicators rather than streaming unvalidated text.

## Fallback plan for poor quote adherence

Quote failures are detected deterministically (exact-substring check) and
already trigger one repair retry; a claim that still fails is dropped, never
rendered. If live runs showed a high drop rate, the escalation path is:
(1) tighten the quote instructions/examples in the answer prompt (version
bump), (2) switch `ANSWER_MODEL` to `gpt-5` for higher adherence, and only
then (3) evaluate Claude Sonnet 4.5 as an alternative provider. Measured so
far: 0–1 dropped claims per acceptance run, rendered unsupported content
always zero.
