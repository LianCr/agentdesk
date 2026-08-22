---
name: eli5
description: Rewrite or review any explanation so a smart person with zero technical or insurance-jargon background gets it on the first read. Use when the user says "eli5", "讲简单点", "说人话", or when output is for the non-engineering insurance-agency owner this project serves.
---

# ELI5 — 说人话

The reader is the agency owner in CLAUDE.md §2: busy, bilingual, not an
engineer, not a compliance lawyer. They will read once, on a phone, and decide
what to do next. Write for that.

## Rules

1. **One idea per sentence.** If a sentence has "and", "which", or a comma
   chain, split it.
2. **Lead with the consequence, not the mechanism.** "It will not invent a
   number" before "citation validation is deterministic".
3. **No jargon without a three-word gloss the first time.** RAG, chunk,
   embedding, pgvector, zod, webhook, idempotent, snapshot hash → either drop
   the word or gloss it: "快照（当时那张表的存档）".
4. **Concrete over abstract.** Name the page, the button, the number, the
   person. "点「送交审核」" beats "进入审核流程".
5. **End with what the reader does next.** One action. If nothing, say
   "到这儿就行 / nothing to do".
6. **Keep the project's red lines intact.** Simplifying never turns "the
   system does not recommend" into a recommendation, a guarantee, or a
   risk verdict. Never invent a product fact to make an example easier.
7. **Bilingual stays bilingual.** 中文在前，English after, both equally
   simple. Do not let the English become the "real" version.
8. **Length budget.** A UI sentence ≤ 20 Chinese characters / 15 English
   words. A summary ≤ 5 sentences. If it needs more, it is two things.

## Procedure

1. Identify who reads it and what they must do after reading.
2. Cut everything that does not change that action.
3. Rewrite what is left under the rules above.
4. Read it aloud as the owner. Any word you would stumble on — replace it.
5. Check against CLAUDE.md §3: no recommendation, no guarantee, no invented
   fact, no PII.
