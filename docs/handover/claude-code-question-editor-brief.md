# Claude Code Brief — Admin Question Editor (add / edit / delete)

**Version 1.0 · Admin Questions tab.** The content team can bulk-import questions but **cannot add a single question or edit/fix an existing one from the UI** — the backend routes exist, the UI doesn't. This is the more urgent of the two gaps because your team needs to correct content in-place (typos, the residual damaged questions). **UI-only work — no design handoff needed; reuse the existing admin patterns.** Produce a short plan and pause before coding.

## What exists (reuse, don't rebuild)
- **Create:** `POST /api/admin/offerings/[id]/questions`
- **Edit:** `PATCH /api/admin/offerings/[id]/questions/[questionId]` — accepts `chapterId`, scalars (`text`, `type`, `difficulty`, `explanation`, `marks`), and `options[]` (`{label,text,isCorrect}`), which it **replaces wholesale** in a transaction.
- **Delete:** `DELETE …/[questionId]`
- UI primitives already in the admin: `Dialog`, `Input`, `Select`, `Badge`, `RichText`, and the existing **Import dialog** in `src/components/admin/offering/questions-tab.tsx` — match its look.

## Build
Add to `questions-tab.tsx` (the offering workspace Questions tab):

1. **"Add question" button** next to Template/Import → opens a question **Dialog** (empty form) → `POST`.
2. **Per-row actions** on each question row: an **Edit** (pencil) that opens the same Dialog pre-filled → `PATCH`; and a **Delete** (trash) with a confirm → `DELETE`.

**The question form** (shared by add + edit):
- **Chapter** — Select of this offering's chapters (allow "untagged"/none).
- **Type** — Single answer / Multiple answers / Fill in the blank. (Do **not** offer Paragraph/Subjective — unsupported.)
- **Difficulty** — Easy / Medium / Hard.
- **Question text** — textarea; show a live `RichText` preview (questions carry HTML/Math).
- **Options** — for MCQ: four inputs A–D with a **correct-answer control**: radio (exactly one) for Single, checkboxes (≥2) for Multi. For **Fill**: hide options, show a single **accepted-answer** text field.
- **Explanation**, **Marks**.

**Validation — mirror the importer exactly** (client + server): Single = exactly 1 correct; Multi = ≥2 correct; MCQ needs ≥2 non-empty options; Fill needs an accepted answer. On save, send the full `options[]` (`{label:'A', text, isCorrect}`) so the PATCH's wholesale replace is correct.

## Guardrails & notes
- **Don't touch** the attempt engine, scoring, or access gating. Render through the existing `RichText`.
- **Warn on edit/delete of a question that's in use** — the row already shows "used in N tests"; if N > 0 (or it has attempts), show a confirm noting that editing options changes option identities and delete removes it from those tests. (Scores are snapshotted, so history isn't retroactively rescored — this is acceptable, just disclosed.)
- **Fill-in-blank** may be created/edited for parity with import, but note in the UI it is **not auto-graded** (same limitation as import) — don't imply it scores.
- Keep it inside the offering workspace styling; AA; ≥44px targets.

## Also verify (point #4 — videos)
Separately confirm the student video path end-to-end (it's built but was never seen working with real data): using the existing **CBSE Class 7 pass**, map a YouTube video to a Class 7 chapter in admin, then as that subscribed student go **Home → that subject → the chapter → the video tile** and confirm `/videos/[id]` plays the `youtube-nocookie` embed. If a *subscribed* student still can't reach it, diagnose and fix (check the offering API returns the video and `hasClassAccess` passes). Report the result.

## Acceptance
Adding a single MCQ from the UI makes it appear in the offering's list; editing a question's text and correct answer persists and the student sees the corrected version; delete is confirm-guarded and warns when in use; validation rejects Single-with-2-correct, Multi-with-1, MCQ-with-<2-options, Fill-without-answer; the video path plays for the subscribed Class 7 student. `npm run build` green; extend the admin E2E with an add + an edit case. Plan first, then stop and show me.
