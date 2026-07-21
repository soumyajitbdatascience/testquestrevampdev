# 11. Testing & QA

> **What this file tells you:** how the app is tested today (manual QA with written test packs), what automated checks exist, and where to start if you want to add automated tests.

## The honest picture

**There are no automated tests.** No unit-test framework (Jest/Vitest), no end-to-end framework (Playwright/Cypress), and no `test` script in `package.json`. Quality has been maintained through a written manual QA pack plus type checking and linting. This is a known gap, listed in [12-known-gaps-and-risks.md](./12-known-gaps-and-risks.md).

## What you do have

### Static checks (run these before every deploy)

```bash
npx tsc --noEmit    # TypeScript type check (strict mode) — catches a lot in this codebase
npm run lint        # ESLint
npm run build       # the production build itself is a meaningful check
```

### The manual QA pack (in `docs/`)

| Document | What it is |
|---|---|
| [../MANUAL_TEST_CASES.md](../MANUAL_TEST_CASES.md) | The big one: step-by-step manual test cases across the whole product (~886 lines) |
| [../test-scenarios.md](../test-scenarios.md) | Higher-level user scenarios to walk through |
| [../user-personas.md](../user-personas.md) | The user types the scenarios are written around |
| [../test-results/RUN_2026-06-01.md](../test-results/RUN_2026-06-01.md), [../test-results/agent-s.md](../test-results/agent-s.md) | Logs of past manual test runs |

Before a release that touches core flows, walk the relevant sections of `MANUAL_TEST_CASES.md` and record a new run log in `docs/test-results/`.

### Test logins

- Admin: `admin@testquest.in` (password was `admin123` — should be changed at handover, see [10-accounts-checklist.md](./10-accounts-checklist.md)).
- Students: create a throwaway signup. **Remember the database is live/shared** — don't fabricate data on real student accounts, and prefer obviously-fake emails you can identify later.
- Payments: Razorpay is in test mode; use Razorpay's published test cards/UPI ids at checkout.

## If you add automated testing (recommended order)

1. **A few Playwright end-to-end tests** for the highest-risk flows first: signup → login, take a free test to the result screen, checkout with a Razorpay test payment. These catch regressions in the flows the business lives on.
2. **Unit tests** (Vitest) for the pure logic with tricky inputs: [src/lib/scoring.ts](../../src/lib/scoring.ts) (answer formats like `",,3,,,"`) and the coupon/pricing calculations.
3. **A GitHub Action** that runs `tsc`, `lint`, `build`, and the tests on every push — this doubles as the missing CI (see the gaps file).

Point tests at a local/dummy database or mock the data layer — never at the shared production database.
