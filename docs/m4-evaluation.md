# M4 Evaluation — Product Comparison Draft

## What M4 does

Given two fictional products and, optionally, a synthetic client, AgentDesk
produces a **comparison draft**: a 13-row table of documented product facts,
each factual cell traceable to a document, page and verbatim English quote;
deterministic observations about how the products differ; a checklist of
client information the agent still needs; and review flags.

It is an internal working draft for licensed-agent review. It is not a
recommendation, a suitability determination, a quote, an illustration, or
legal or tax advice — and it never ranks the two products.

## The architecture this evaluation exists to protect

```text
products.json  ──┐
                 ├─► fact registry ─► cells ─► rows ─► observations ─┐
derived chunks ──┘        (code)                                     ├─► ComparisonDraft
synthetic case ─────────► client context ─► missing info ─► flags ───┘
                                                                      │
                                    optional narrative ◄──────────────┘
                                    (restates validated structures only)
```

The table is code-owned end to end. No model participates in fact lookup,
field assignment, numeric comparison, availability, source selection,
citation construction, observations, missing information, review flags or
comparison status. The narrative is a separate, optional layer that may only
restate what the structures already assert — and if it fails for any reason,
the deterministic draft returns unchanged.

Two sources must agree before anything is presented as a fact:

- **products.json** supplies the structured value (`0.095`),
- **the committed derived chunks** supply the human-verifiable evidence
  (`"9.50%"` on page 5).

If they disagree, or the evidence cannot be located unambiguously, the cell
is `conflict`: no value is shown at all.

## Frozen dataset (23 cases)

`evals/comparisons.json`, frozen before any tuning. Expectations are
**structured, not prose** — which availability a cell must carry, which
structured value, which document and page must back it, which observations
and flags must and must not appear. Nothing was read back from current
output; every expectation traces to products.json, the derived chunks, the
M4-A fact rules or the synthetic-case fixtures.

| Category | Cases | What it protects |
|---|---|---|
| Product-pair coverage | 3 | Term×IUL, IUL×Annuity, Term×Annuity all produce a full table |
| Symmetry | 3 | Each pair reversed; only the columns may differ |
| Client context | 4 | No-client plus Demo Clients A/B/C |
| Fact states | 3 | documented negative, not applicable, not provided, derived |
| Numeric | 2 | percentages, years, currency across categories |
| Observations | 3 | each of the five types, and the pairs where they must *not* fire |
| Boundaries | 5 | recommendation, guarantee, replacement, age threshold, value request |

Two structural checks run outside the dataset because the committed data
cannot express them: an **injected conflict** (a mutated in-memory product
whose structured period disagrees with its own table) and a **derivation
probe** (a shortened table fixture must change the derived year). Production
fixtures are never mutated.

## Deterministic hard gates

All seventeen must be zero/true for M4 to close. They are properties of code,
not of a sampled model response:

```text
wrong factual cells               = 0     wrong derived provenance      = 0
wrong product assignments         = 0     wrong observation inputs      = 0
wrong citation document           = 0     recommendation violations     = 0
wrong citation page               = 0     guarantee violations          = 0
invalid citation quote            = 0     symmetry failures             = 0
ambiguous citation IDs            = 0     injected conflict fails closed
available cell without source     = 0     derived value tracks the table
invented numeric cells            = 0     database mutations            = 0
availability collapse             = 0
```

## Results (evals/results/m4-baseline.json)

**23/23 cases, all 17 hard gates pass, database unchanged at 3/20/45.**

| Metric | Result |
|---|---|
| cell fact correctness | 100% |
| cell availability correctness | 100% |
| cell citation correctness | 100% |
| observation correctness | 100% |
| missing-client-info accuracy | 100% |
| review-reason accuracy | 100% |
| comparison-status accuracy | 100% |
| symmetry accuracy | 100% (3/3 groups) |
| dimension coverage | 100% |
| deterministic comparison latency | median 1 ms, max 7 ms |

There is deliberately no single "AI accuracy" number: these measure different
properties and a blended figure would hide which one moved.

The baseline passed on its first run and no generalized fix was needed, so
`m4-baseline.json` is both the baseline and the final result. It is preserved
unmodified.

### Why a first-run pass is not self-congratulation here

A frozen suite that passes immediately is only meaningful if it *can* fail.
Sixteen mutation tests (`tests/evals/comparison-metrics.test.ts`) inject one
realistic defect each into an otherwise correct draft and assert the
evaluator catches it in the right category: a citation pointing at the wrong
product, a page that no longer matches its chunk, a quote absent from its
chunk, two citations sharing an id, a documented negative collapsed into an
absence, an available cell stripped of its source, a conflict still showing a
value, a cell bound to the wrong column, a derived cell without provenance, a
wrong structured value behind correct-looking prose, an unsupported
observation, an observation citing a source no cell carries, a
recommendation, a cap sold as a guaranteed return, a reordered dimension
list, and a wrong status.

## The example this milestone was built around

`data/fictional-products/SPEC.md` §4 plants a mismatch: SecureRate 5's
initial rate is guaranteed for **five** contract years while its
surrender-charge schedule runs through contract year **seven**. The
comparison must surface it.

What makes it interesting is that the guide never writes "seven-year
surrender period" — the string "seven" appears nowhere in the document. The
only evidence is the surrender-charge table on page 4. So the 7 is a
**derived** fact:

```text
ruleId       LAST_NONZERO_SURRENDER_CHARGE_YEAR
inputs       facts.surrenderChargeSchedule.chargesByYearPercent
reconciled   facts.surrenderPeriodYears   (a mismatch is a conflict, not a preference)
evidence     doc_securerate5_v1:c004, page 4, the schedule table itself
```

and the observation says what the schedule shows:

> 初始利率保证期为 5 个合同年;退保费用表在第 1–7 个合同年收取费用,第 8 年起为 0。利率保证期结束时,合同可能仍处于退保费用表覆盖期间。

> The initial rate-guarantee period runs for 5 contract years. The
> surrender-charge schedule shows non-zero charges through contract year 7
> and 0 beginning in year 8. At the end of the rate-guarantee period, the
> contract may still be within the surrender-charge schedule.

It cites both facts, calls neither product worse, and gives no advice about
surrendering or holding. The evaluation pins all of that, including that the
wording never claims the document states a seven-year period.

## Two real defects found during M4, and how

**A cap read as a guarantee period.** Multi-part cells originally returned
their structured values as a positional array, so the observation rule took
"the first number" — which for IndexFlex UL was the 0.00% indexed-account
floor. The 5-vs-7 mismatch observation fired on Term×IUL, describing a
"0 contract year" rate guarantee. Multi-part cells now key their values by
fact path, so a rule must ask for `initialRate.guaranteeYears` and a floor or
cap can never be mistaken for a term. Found by a smoke run over all three
pairs; unit tests had not covered the cross-pair case.

**Two citations sharing one id.** Each product's fact sheet numbered its
citations from `cit_001` independently, so inside a single draft an id was
ambiguous: the public PDF-link map resolved a TermPlus citation to the
IndexFlex document, and an observation's `citationIds` could not say which
product's source they meant. A comparison now shares one citation collector
across both products and asserts per draft that an id identifies exactly one
(document, chunk, quote). Found by clicking a citation in the browser during
M4-C live acceptance — no unit test had looked at the link map.

Both are recorded because they show where the coverage was thin: mutation
tests and browser QA caught what the unit suite did not.

## Optional narrative

The narrative model receives only validated structures — cell display values,
observation texts, missing-information reasons. It never sees a PDF or a
chunk, cannot retrieve evidence, cannot choose products and cannot produce
citations. Its output is rejected if it references an unknown dimension or
observation, introduces a number absent from the rows it cites (licensed per
section, not from a global pool), fabricates a document or page reference,
states a recommendation conclusion (checked with the production predicate),
or asserts an intentionally omitted fact.

**Narrative status is not an M4 gate.** A rejected or unavailable explanation
is the guard working; only a narrative that passes validation while asserting
something unsupported would be a system defect, and none was observed.

Sampled after the M4-C timeout adjustment: 6/6 accepted across three pairs ×
two languages. Earlier sampling during M4-B/C was mixed (accepted, rejected
by guard, and one 60-second timeout that motivated raising the bound to 90s).
The deterministic draft was intact in every observed case, which is the
property that matters. Repeated-run stability and latency are tracked as
**M4.1**, non-blocking until M7.

## Limitations

- Three fictional documents and three synthetic clients. The metrics say
  nothing about scale, messy real PDFs or real client data.
- `AGE_65_PLUS` reads its threshold from the annuity's own `suitability`
  fact, so it only fires when an annuity is in the pair. That is honest to
  the data — no other demo product documents an age threshold — but it means
  a life-only comparison for a 67-year-old raises no age flag.
- Missing-information rules cover what the three fixtures justify. There is
  deliberately no unconditional annuity "liquidity needs" rule because no
  fixture asks for one.
- Conflict is unreachable from the committed data; it is proven only through
  an injected fixture.
- The 90-second narrative timeout is demo behaviour, not a release target.

## Deferred

- **M4.1 — narrative reliability and performance** (before M7)
- Saved comparisons, export, sharing (M4.1+)
- Approval workflow, reviewer UI, audit trail, n8n (**M5**)
- Real client data, CRM, carrier APIs, real quotes and illustrations
- Suitability scoring and product ranking — deliberately out of scope forever
