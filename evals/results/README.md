# Evaluation artifacts — what is permanent and what is evidence

Four distinct kinds of artifact live in the evaluation tree. Only the first
two are release artifacts; the rest are evidence or generated output.

| Tier | Location | Mutability |
|---|---|---|
| **Frozen ground truth** | `evals/questions.json`, `evals/redteam.json` | Immutable contract. Changes require a documented ground-truth justification, never "the model disagreed". |
| **Baseline** | `evals/results/m3-baseline.json` | Immutable. The first measurement, taken before any fix; never overwritten or regenerated. |
| **Diagnostic runs** | `evals/results/diagnostics/` | Historical evidence, kept unmodified. Each file is a real live run, including the ones that failed hard gates — they are the record of what was investigated and why the evaluator changed. |
| **Public evaluation report** | `docs/m3-evaluation.md` | The narrative deliverable. It is what a reader should be pointed at; the JSON exists so its claims can be checked. |

New runs (`npm run eval -- --out=…`) write raw JSON that is **not** committed
by default. Commit a run only when it is cited by the report or preserved as
diagnostic evidence for a specific defect, and put it under `diagnostics/`
with a name that says which attempt it belongs to.

`evals/summarize-runs.ts` aggregates any set of run files: hard gates are
reported per run and never averaged; stochastic quality metrics are reported
as run values plus min/median/max.
