# Claude Code Brief — Fix the B2C Student Flow (shell consolidation)

**Version 1.0.** Manual UAT found the student app runs **two navigation shells at once**, so the header changes between pages, login lands on the wrong page, onboarding re-asks every login, and a cross-class "All tests" page leaks other classes. Root cause: the **legacy student shell/pages were never retired** when the new context-scoped experience was built (phases 1–5). Companion: `claude-student-flow-redesign-brief.md` (IA + the add-class flow). **Produce a short plan and pause before coding.**

## The six issues (all trace to one root cause)
1. **Two shells coexist** — legacy header (`Dashboard / Tests / History`) + new header (`Home / My progress / My subscriptions / All tests`). Navigating flips between them.
2. **Post-login redirect goes to `/tests`** (legacy browse-all), not the new home.
3. **Onboarding re-triggers every login** — entry via the legacy shell never checks/sets context; only `/dashboard` forces it, so it feels un-persisted.
4. **"All tests" / `/tests` shows every class** (Class 6 + Class 7…) — breaks context scoping.
5. **No "＋ add class"** — the context toggle can't add a context.
6. **Redundant legacy routes** (`/tests` browse-all, old `/dashboard`/`/history` under the legacy header) duplicate the new ones.

## Step 0 — inventory before changing anything
List: the two layout/header components and which routes use each; where the **post-login redirect** target is set; the **onboarding gate** (middleware/layout/guard) and what it reads; every student route and which shell it renders. Report this and pause — I want to confirm the map before deletion.

## Fixes

**1. One shell.** Make **every** student route render the new context-scoped layout (the `Home / My progress / My subscriptions` header with the context switcher). Delete the legacy header/shell and stop rendering it anywhere. The header must be identical on Home, My progress, My subscriptions, subject pages, attempt result, etc.

**2. Post-login redirect.** On successful login (and email-verify landing): if the student has **≥1 `tq_student_context`** → `/dashboard` (home); if **zero** → `/onboarding`. Remove any redirect to `/tests`.

**3. One-time onboarding (persist + guard).** The onboarding gate must read `tq_student_contexts`: if the student has any context, **never** show onboarding again (no matter which route they enter through). Only a student with zero contexts is sent to onboarding. Fix whatever currently lets the legacy entry path bypass this so it stops re-asking each login.

**4. Kill the cross-class browse.** Remove the **"All tests"** tab and retire the legacy `/tests` browse-all page. Do **not** replace it with another global list — the class Home → subject → chapter is the browse. (If a flat list is ever wanted, it must be scoped to the active context only — not this pass.)

**5. ＋ Add a class.** Add the action to the context switcher → a flow that picks board+class (reuse the onboarding class-picker, scoped), writes a new `tq_student_context`, sets it active, and lands on that class's Home. A class already held is disabled; empty boards hidden (as onboarding does). Result: adding a class immediately surfaces its free samples + its own subscribe banner.

**6. Fold History into My progress.** Move the attempts/history list under **My progress** as "Recent attempts"; remove History as a standalone legacy page.

## Guardrails
- **Do not touch** the attempt engine, paywall/checkout, receipt emails, or access gating — those are verified. This is navigation/routing/shell only.
- Keep everything **fail-closed** and context-scoped: no student page may query or display another class's content.
- No schema changes (contexts table already exists). No `db push`.
- After the change, verify: login with context → lands on Home in the new shell; login without context → onboarding once, then never again; the header is identical across all student pages; `/tests` no longer serves a cross-class list; add-class works and reveals that class's free tests.

## Acceptance
A returning student logs in and lands on **Home** (not browse-all), in **one consistent shell** that never changes between pages; onboarding is asked **once, ever**; there is **no way to see another class's tests**; the context switcher can **add a class** and that class's free samples + subscribe banner appear; History lives under My progress. `npm run build` green; add/adjust E2E so the admin/student suites cover "one shell, one-time onboarding, post-login lands on Home."
