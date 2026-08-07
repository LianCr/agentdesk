# Retrieval Calibration (M3-A)

Measured on the 45 live chunks with `text-embedding-3-large@1536`.
Baselines: A = original query only; B = + deterministic glossary; C = + GPT-5-mini rewrite.
Score = 1 − cosine distance. Retrieval relevance is labeled separately from
answer sufficiency — high similarity on missing-information probes proves
nothing about answerability.

## P1 (en, answerable): Does TermPlus 20 accumulate cash value?
Expected: doc_termplus20_v1 page 2 (gold chunks: doc_termplus20_v1:c001)

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | termplus20_v1:c001 @ 0.608<br>termplus20_v1:c002 @ 0.536<br>termplus20_v1:c000 @ 0.522 | 1 | 0.608 | ✓ | ✓ | ✓ | no |
| B_glossary | termplus20_v1:c001 @ 0.608<br>termplus20_v1:c002 @ 0.536<br>termplus20_v1:c000 @ 0.522 | 1 | 0.608 | ✓ | ✓ | ✓ | no |
| C_llm_rewrite | (en single-route — n/a) | | | | | | |

## P2 (zh, answerable): 定期寿险有现金价值吗？
Expected: doc_termplus20_v1 page 2 (gold chunks: doc_termplus20_v1:c001)

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | termplus20_v1:c004 @ 0.465<br>termplus20_v1:c001 @ 0.459<br>indexflex_ul_v1:c003 @ 0.441 | 2 | 0.459 | ✗ | ✓ | ✓ | no |
| B_glossary | termplus20_v1:c001 @ 0.493<br>termplus20_v1:c004 @ 0.465<br>indexflex_ul_v1:c003 @ 0.441 | 1 | 0.493 | ✓ | ✓ | ✓ | no |
| C_llm_rewrite | termplus20_v1:c001 @ 0.527<br>termplus20_v1:c004 @ 0.464<br>indexflex_ul_v1:c003 @ 0.442 | 1 | 0.527 | ✓ | ✓ | ✓ | no |

## P3 (mixed, answerable): IUL 的当前 cap 和保证最低 cap 是多少？
Expected: doc_indexflex_ul_v1 page 5 (gold chunks: doc_indexflex_ul_v1:c007)

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | indexflex_ul_v1:c007 @ 0.578<br>indexflex_ul_v1:c016 @ 0.545<br>securerate5_v1:c002 @ 0.523 | 1 | 0.578 | ✓ | ✓ | ✓ | no |
| B_glossary | indexflex_ul_v1:c007 @ 0.603<br>indexflex_ul_v1:c016 @ 0.557<br>securerate5_v1:c002 @ 0.549 | 1 | 0.603 | ✓ | ✓ | ✓ | no |
| C_llm_rewrite | indexflex_ul_v1:c001 @ 0.642<br>indexflex_ul_v1:c007 @ 0.612<br>indexflex_ul_v1:c003 @ 0.550 | 2 | 0.612 | ✗ | ✓ | ✓ | no |

## P4 (mixed, answerable): SecureRate 有 rider 吗？
Expected: doc_securerate5_v1 page 5 (gold chunks: doc_securerate5_v1:c008)

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | securerate5_v1:c008 @ 0.395<br>indexflex_ul_v1:c012 @ 0.387<br>termplus20_v1:c009 @ 0.342 | 1 | 0.395 | ✓ | ✓ | ✓ | no |
| B_glossary | securerate5_v1:c008 @ 0.395<br>indexflex_ul_v1:c012 @ 0.387<br>termplus20_v1:c009 @ 0.342 | 1 | 0.395 | ✓ | ✓ | ✓ | no |
| C_llm_rewrite | securerate5_v1:c008 @ 0.472<br>indexflex_ul_v1:c012 @ 0.460<br>securerate5_v1:c000 @ 0.448 | 1 | 0.472 | ✓ | ✓ | ✓ | no |

## P5 (en, answerable): What happens to TermPlus premiums after the 20-year level period?
Expected: doc_termplus20_v1 page 4 (gold chunks: doc_termplus20_v1:c001, doc_termplus20_v1:c004)

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | termplus20_v1:c004 @ 0.627<br>termplus20_v1:c001 @ 0.602<br>termplus20_v1:c002 @ 0.540 | 1 | 0.627 | ✓ | ✓ | ✓ | no |
| B_glossary | termplus20_v1:c004 @ 0.627<br>termplus20_v1:c001 @ 0.602<br>termplus20_v1:c002 @ 0.540 | 1 | 0.627 | ✓ | ✓ | ✓ | no |
| C_llm_rewrite | (en single-route — n/a) | | | | | | |

## P6 (zh, answerable): SecureRate 的初始利率保证期是多久？
Expected: doc_securerate5_v1 page 3 (gold chunks: doc_securerate5_v1:c002)

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | securerate5_v1:c002 @ 0.545<br>indexflex_ul_v1:c005 @ 0.445<br>indexflex_ul_v1:c010 @ 0.429 | 1 | 0.545 | ✓ | ✓ | ✓ | no |
| B_glossary | securerate5_v1:c002 @ 0.563<br>indexflex_ul_v1:c005 @ 0.448<br>indexflex_ul_v1:c010 @ 0.442 | 1 | 0.563 | ✓ | ✓ | ✓ | no |
| C_llm_rewrite | securerate5_v1:c002 @ 0.615<br>indexflex_ul_v1:c010 @ 0.501<br>securerate5_v1:c000 @ 0.491 | 1 | 0.615 | ✓ | ✓ | ✓ | no |

## P7 (en, answerable): What is the SecureRate surrender charge schedule?
Expected: doc_securerate5_v1 page 4 (gold chunks: doc_securerate5_v1:c004)

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | securerate5_v1:c004 @ 0.757<br>indexflex_ul_v1:c009 @ 0.713<br>indexflex_ul_v1:c008 @ 0.702 | 1 | 0.757 | ✓ | ✓ | ✓ | no |
| B_glossary | securerate5_v1:c004 @ 0.757<br>indexflex_ul_v1:c009 @ 0.713<br>indexflex_ul_v1:c008 @ 0.702 | 1 | 0.757 | ✓ | ✓ | ✓ | no |
| C_llm_rewrite | (en single-route — n/a) | | | | | | |

## P8 (en, filter): surrender charge
Expected: doc_securerate5_v1

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | securerate5_v1:c004 @ 0.719<br>securerate5_v1:c005 @ 0.530<br>securerate5_v1:c003 @ 0.496 | — | — | — | — | — | no |
| B_glossary | securerate5_v1:c004 @ 0.719<br>securerate5_v1:c005 @ 0.530<br>securerate5_v1:c003 @ 0.496 | — | — | — | — | — | no |
| C_llm_rewrite | (en single-route — n/a) | | | | | | |

## P9 (en, ambiguous): surrender charge schedule

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | securerate5_v1:c004 @ 0.834<br>indexflex_ul_v1:c009 @ 0.794<br>indexflex_ul_v1:c008 @ 0.762 | — | — | — | — | — | no |
| | products in top8: doc_securerate5_v1, doc_indexflex_ul_v1 | | | | | | |
| B_glossary | securerate5_v1:c004 @ 0.834<br>indexflex_ul_v1:c009 @ 0.794<br>indexflex_ul_v1:c008 @ 0.762 | — | — | — | — | — | no |
| C_llm_rewrite | (en single-route — n/a) | | | | | | |

## P10 (mixed, missing): TermPlus 61 岁的续保保费是多少？

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | termplus20_v1:c004 @ 0.513<br>indexflex_ul_v1:c003 @ 0.467<br>termplus20_v1:c005 @ 0.467 | — | — | — | — | — | no |
| | top score 0.513 — related context only; answer sufficiency: NOT ANSWERABLE (intentional omission) | | | | | | |
| B_glossary | termplus20_v1:c004 @ 0.540<br>termplus20_v1:c005 @ 0.502<br>indexflex_ul_v1:c006 @ 0.483 | — | — | — | — | — | no |
| | top score 0.540 — related context only; answer sufficiency: NOT ANSWERABLE (intentional omission) | | | | | | |
| C_llm_rewrite | termplus20_v1:c004 @ 0.590<br>termplus20_v1:c005 @ 0.554<br>termplus20_v1:c002 @ 0.542 | — | — | — | — | — | no |
| | top score 0.590 — related context only; answer sufficiency: NOT ANSWERABLE (intentional omission) | | | | | | |

## P11 (en, missing): How much cash value will IndexFlex have after 20 years?

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | indexflex_ul_v1:c001 @ 0.549<br>termplus20_v1:c001 @ 0.532<br>indexflex_ul_v1:c003 @ 0.518 | — | — | — | — | — | no |
| | top score 0.549 — related context only; answer sufficiency: NOT ANSWERABLE (intentional omission) | | | | | | |
| B_glossary | indexflex_ul_v1:c001 @ 0.549<br>termplus20_v1:c001 @ 0.532<br>indexflex_ul_v1:c003 @ 0.518 | — | — | — | — | — | no |
| | top score 0.549 — related context only; answer sufficiency: NOT ANSWERABLE (intentional omission) | | | | | | |
| C_llm_rewrite | (en single-route — n/a) | | | | | | |

## P12 (en, missing): What have SecureRate's renewal rates been historically?

| config | top-3 (chunk @ score) | gold rank | gold score | hit@1 | hit@3 | hit@8 | irrelevant product outranks |
|---|---|---|---|---|---|---|---|
| A_original | securerate5_v1:c002 @ 0.570<br>securerate5_v1:c000 @ 0.434<br>termplus20_v1:c004 @ 0.415 | — | — | — | — | — | no |
| | top score 0.570 — related context only; answer sufficiency: NOT ANSWERABLE (intentional omission) | | | | | | |
| B_glossary | securerate5_v1:c002 @ 0.570<br>securerate5_v1:c000 @ 0.434<br>termplus20_v1:c004 @ 0.415 | — | — | — | — | — | no |
| | top score 0.570 — related context only; answer sufficiency: NOT ANSWERABLE (intentional omission) | | | | | | |
| C_llm_rewrite | (en single-route — n/a) | | | | | | |

## Locked conclusions (lib/retrieval/thresholds.ts, v1)

**Measured score ranges** (runs 1–2)
- Answerable gold top-1: 0.395 (P4, negative fact, route A/B) … 0.757 (P7, table)
- Missing-probe top-1 (related context only): 0.513 … 0.570
- Unrelated cross-product tail: ≤ ~0.44

**Finding 1 — score cannot decide sufficiency.** The weakest genuine gold
(0.395) scores BELOW every missing-probe top (≥0.513). Any score threshold
separating "answerable" from "missing" would be wrong in both directions.
Answer sufficiency is therefore owned by M3-B citation validation; scores
serve only as weak floors:
- `EVIDENCE_FLOOR = 0.30` — pool admission (keeps the 0.395 gold, drops far tail)
- `LOW_RELEVANCE_TOP = 0.35` — top-1 below this ⇒ off-topic signal (never a sufficiency proof)
- No score-based "strong" gate. A single accurate, verifiable chunk is
  sufficient for strong evidence; chunk count is never a rule.

**Finding 2 — route policy (A vs B vs C)**
- zh: LLM rewrite (C) materially improves in every run — P2: A missed hit@1
  (gold rank 2 @0.459) while C hit@1 (@0.590 run 1 / @0.541 run 2); P6:
  0.545 → 0.595/0.620. B alone also fixed P2 hit@1 (0.493).
  → zh uses `original + glossary + rewrite`.
- mixed: B suffices in every run; C is run-to-run unstable (see Finding 3;
  it demoted P3 gold to rank 2 in run 1, rank 1 in run 2).
  → mixed uses `original + glossary`, no LLM rewrite.
- en: all probes hit@1 ≥ 0.608 unaided. → en stays single-route.

**Finding 3 — reproducibility.** Deterministic routes (A/B) reproduce across
runs to the third decimal (one ±0.001 embedding jitter observed). The LLM
rewrite route (C) produces a different rewrite each run (no temperature
control on GPT-5-mini) and its scores vary by up to ~0.07 — hit metrics
stayed stable, but this nondeterminism is itself a reason to prefer the
deterministic glossary route wherever it is sufficient (mixed), keeping C
only where its benefit is consistent and material (zh).

**Recall summary**: all 7 answerable probes hit@3 = 7/7 in every baseline
and run; hit@1 = 7/7 under the locked policy. Product filter: zero leaks.
Ambiguous "surrender charge schedule": both relevant products present in
top-8, correct one first. No irrelevant product outranked gold anywhere.
