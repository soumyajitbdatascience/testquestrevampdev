# Question cleanup — what to run, what I left alone

I checked the flagged questions using the loaded data (I don't need the old DB — the damaged text is in `tq_questions`/`tq_question_options`). Running the analysis showed the "~148" was **three different problems mixed together**, so I built a **safe, hand-verified** fix and deliberately left the risky ones untouched.

## Run this
`question-fix-SAFE.sql` in DBeaver against `TquestTestEnv`. It's idempotent (re-running is harmless) and does two things:

1. ~~**`Clasification` → `Classification`** — a recurring misspelling in ~130 questions (it was wrong in the legacy DB too; this is a spelling fix, not a spacing fix). This is what inflated the count.~~
   **Correction (applied 17 Aug 2026):** this was wrong about *where* the misspelling lives. `Clasification` never appeared in `tq_questions.text` or `tq_question_options.text` — running the SAFE file against those columns matched **0 rows**, and the statements in it could never have fixed the problem. The misspelling was in **names**: `tq_chapters.name` (1 row) and `tq_tests.name` (3 rows), all under CBSE Class 10 Chemistry. The "~130" was a count of questions sitting *under* those misspelled names (53 in the chapter + 69 across the three tests = 122), not questions containing the word. Fixed separately by `prisma/migration/33-name-spelling-cleanup.ts`.
2. **~28 genuine glued phrases** — `onlyherbivorous → only herbivorous`, `followingcompounds → following compounds`, `removingtheinfectedportion → removing the infected portion`, `Everyinteger → Every integer`, etc. — hand-checked, one at a time.

It touches both the question text and the option text, so answers get fixed too.

## What I deliberately did NOT touch (and why)
- **Real scientific single-words the auto-splitter wanted to break** — `phytohormone`, `microsporangia`, `phototropism`, `circumcentre`, `endoskeleton`, `biopesticide`, `Vermicompost`, `chlorophyllous`, `osmoregulators`… these are **correct**. Splitting them would create the damage, not fix it.
- **Other one-off source typos** — `prependicular` (perpendicular), `Cryrtallisation` (crystallisation), `Mitochondiral` (mitochondrial), `Palaentology` (palaeontology), `photosysnthesis` (photosynthesis), a few more. These are pre-existing content errors, not migration damage. Correcting them is a **subject-matter spell-check pass** best done by someone who knows the content (or a later QA sweep) — I won't guess at science spellings and risk introducing errors.

## Net effect
Running the SAFE file clears the obvious run-together phrases — 50 row-updates across 43 tokens, all verified to 0 afterwards. The "Clasification" heading and test titles needed the separate name fix above. The residue is a small number of genuine subject typos that are a content-QA item, not a launch blocker — and the scientific terms were never broken to begin with.

## How it was actually applied
Two idempotent scripts, both data-only (no schema change, no `db push`):

| script | what it does |
|---|---|
| `prisma/migration/32-question-text-cleanup.ts` | Replays `question-fix-SAFE.sql` against `tq_questions.text` + `tq_question_options.text`. Parses the tokens **out of the SQL file** rather than duplicating them, so the two can't drift. Reports before/after per token and guards that `phytohormone`, `circumcentre`, `phototropism`, `Vermicompost` are untouched. |
| `prisma/migration/33-name-spelling-cleanup.ts` | The `Clasification` → `Classification` fix on `tq_chapters.name` and `tq_tests.name`, plus a sweep confirming the misspelling is nowhere else. |

Note when re-verifying: this database's collation is **case-insensitive**, so a `LIKE '%Token%'` count also matches other casings. That makes an after-count of 0 the stricter check, covering every case variant at once.

## Still outstanding (content QA)
`prependicular`, `Cryrtallisation`, `Mitochondiral`, `Palaentology`, `photosysnthesis` and similar one-off subject typos — deliberately untouched, as above.
