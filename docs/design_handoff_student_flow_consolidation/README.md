# Handoff: TestQuest B2C — Student Flow Consolidation & Add-a-Class (Web)

**Target codebase:** `testquest-app` (Next.js App Router · TypeScript · Tailwind v4 · shadcn/ui · Prisma · custom JWT auth)
**Companion briefs:** `docs/handover/claude-code-student-flow-fix-brief.md` (the six fixes; produce a plan and pause before coding, per that brief) · `claude-student-flow-redesign-brief.md` (IA)
**Builds on:** `design_handoff_b2c_web/` (Scope A student screens + tokens). Tokens, fonts, and shape rules are unchanged — this bundle only consolidates navigation and adds one new flow.

## Overview
UAT found the student app running **two navigation shells at once**: the legacy header (`src/components/student/student-header.tsx`: Dashboard / Tests / History) still wraps `/tests`, `/my-attempts`, `/progress`, `/my-subscriptions`, while `/dashboard` renders its own new context-scoped header inline. This design consolidates to **one shell**, retires the cross-class `/tests` browse-all, folds History into My progress, and adds the one genuinely new surface: **add a class** from the context switcher — which lands the student on the new class's Home where its free samples and its own subscribe banner appear.

## About the Design Files
`Student Flow Consolidation.dc.html` (open in a browser; `support.js` + `assets/` must sit beside it) is a **design reference created in HTML** — it shows intended look and behavior, not production code. Recreate these designs inside `testquest-app` using its established patterns: App Router pages, shadcn/ui components (Dialog/Sheet for 2a), Tailwind v4 utilities, the existing oklch tokens in `src/app/globals.css` (the `--wash/--ink/--bg-alt/…` handoff roles are already there). Do not copy the HTML markup.

The canvas is organized in turns, newest at top. Option ids are visible badges:
- **Turn 2 (`2a`–`2b`)** — the tighter add-a-class flow. **Build `2a`**; `2b` is a comparison alternative, do not build. `2a` supersedes `1c`.
- **Turn 1 (`1a`–`1g`)** — the unified shell and every consolidated screen (`1c` is the earlier 3-step add flow, superseded by `2a`).

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, copy, and states are final intent. Every screen is shown at 375 (mobile-first) and light + dark; desktop frames at 1100. Recreate pixel-faithfully with the codebase's components and tokens.

## Design Tokens
Identical to `design_handoff_b2c_web/README.md` §Design Tokens — light: primary `#6134EB`, primary-deep `#642CC8`, ink `#140C3D`, accent `#815FE9`, lavender `#A790EA`, wash `#F4F0FE`, bg-alt `#FBFAFE`, border `#E6E1F5`, text-secondary `#4B426E`, text-muted `#837CA3`, success `#1B8A5A`/`#EAF7F0`, warning `#B45309`/`#FDF3E7`, error `#D92D20`/`#FCEEE9`. Dark: bg `#130C36`, card `#1D1550`, raised/wash `#251C5E`, border `#332A6B`, text `#F1EDFF`, secondary `#C0B5EA`, muted `#948BC4`, primary → `#815FE9`, accent/link → `#A790EA`, success `#45C990`, warning `#E1A03C`, error `#F97066`, tints ≈ 14% alpha of the semantic color.
**Type:** Sora 600–800 (display/numbers) · Manrope 400–800 (body). **Shape:** cards 18px radius (optional 4px accent top bar), buttons/inputs 11–14px, pills 999px. Primary CTA shadow `0 6px 18px rgba(97,52,235,.35)`. **Touch:** ≥44px targets.

## Screens / Views

### 1a — One shell (spec diagram, not a screen)
The single header on **every** student page:
- **Left:** logo mark 28px (`assets/logo-mark.png`) + **context switcher pill** — wash bg, 40px tall, radius 999, 13px/700 Manrope ink, `{boardCode} · {className}` + chevron-down 13px; a 7px success-green dot prefixes the label **only when the active context is subscribed**.
- **Right (desktop ≥1100):** nav links `Home · My progress · My subscriptions` — 13.5px/600 Manrope text-secondary, active page 800 weight ink; then theme toggle (sun/moon stroke icon 17px), avatar 32–34px circle (primary bg, white initial).
- **Mobile:** no nav links in the header; pages end with a 2-tile quick-nav grid (`My progress` / `Subscriptions`, 12px-radius bordered cards, 13px/700 text-secondary). The "All tests" tile is removed.
- Header bar: white (dark: `#1D1550`) at ~92% opacity + blur, 1px bottom border, content max-width 1100 px, 16px side padding mobile / 24px desktop.
- **Retire:** `student-header.tsx` (Dashboard/Tests/History), the "All tests" nav link, `/tests` browse-all, `/my-attempts` as a page. Route map: `/tests` → redirect to `/dashboard`; `/my-attempts` → `/progress` (Recent attempts); post-login → `/dashboard` if ≥1 context else `/onboarding` (once, ever).

### 1b — Context switcher (open state)
Dropdown anchored under the pill: 300px, white card (dark `#1D1550`), 14px radius, 1px border, `0 12px 32px rgba(20,12,61,.18)` shadow, 6px padding; page behind dims `rgba(20,12,61,.35)` (dark `rgba(6,3,20,.5)`).
- One row per context (10/12px padding, 10px radius): name 14px/700 Manrope ink; status line 11px/600 — subscribed: success color, `Subscribed — till {date}`; else muted, `Free browsing · 1 free test per subject`. Active row: wash bg + primary check icon right. Tap switches context: Home/progress/subscriptions re-scope instantly, server-persisted.
- 1px hairline divider, then the **persistent last row** (min 44px): plus icon + `Add a class`, 13.5px/800 primary-deep (dark: lavender `#A790EA`). Always present, even with one context.
- Quiet footer link `Edit contexts`, 11px/600 muted.

### 2a — Add a class ★ BUILD THIS (supersedes 1c)
Bottom sheet on mobile (20px top radius, 40×4px grabber, backdrop `rgba(20,12,61,.55)`), centered ~420px modal on desktop (18px radius, shadow `0 24px 64px rgba(20,12,61,.35)`). Opened from the switcher's ＋ row. **One sheet, two taps:**
1. Title row: `Add a class` Sora 20/700 + X close (returns to exactly where they were; the sheet never navigates).
2. **Board chip row** (36px pill chips): the student's current board pre-selected (solid primary chip + check icon, white text); other boards wash chips. Helper line under it, 10.5px muted: `Your current board is pre-selected — tap another to switch`. Boards with no content are never listed (same rule as onboarding). Switching board swaps the class grid below (keep per-board cache so flipping back never refetches/flashes).
3. **Class grid** — 3 columns, 56px min-height chips, 14px radius, 14px/700 Manrope: default 1px border; selected 2px primary border + wash bg + 800 weight; **already-added class**: disabled, wash bg at 75% opacity, muted label + green check `Already added` (10px/700) — never an error; class with no content: enabled-looking but sublabel `coming soon` 10px/500 muted.
4. **Summary strip** (appears on pick, animates in ~200ms): 12px-radius bordered card on bg-alt, sparkles icon primary, `**CBSE · Class 7** — 5 subjects · 96 tests · **1 free test per subject**` 11.5px/600 (real counts from API).
5. **CTA is the confirm** — 48px primary button, copy `Add {class} · try {n} free tests`; before any pick it is disabled and reads `Pick a class`. Microcopy under it, 10.5px muted centered: `Switches you right away — flip back anytime · its pass is separate, from ₹{minPrice}`.
On Add: POST the new `tq_student_context`, set it active, close, route to `/dashboard` — **quietly**, no toast/celebration; the new class's Home (1d) shows its free samples and its own subscribe banner.

### 1c — Add a class, 3-step version (superseded)
Kept on the canvas for the record (board → class → confirm, reusing onboarding's 52px radio rows and 3-segment progress). Do not build; `2a` replaces it.

### 2b — Inline add inside the switcher (do not build)
Comparison alternative only: the picker expanded inside the 300px dropdown. Rejected: abbreviated chips, no room for the free-test pitch, cramps on desktop.

### 1d — Home, unsubscribed class (the post-add landing)
Exactly the existing `/dashboard` design re-scoped to the new class — the pill reads `CBSE · Class 7` (no green dot):
- **Subscribe banner:** solid primary, 18px radius, lavender decor circle (`rgba(167,144,234,.3)`, top-right overflow); `Unlock all of Class 7` Sora 20–22/700 white; two 13px lines (`All 5 subjects · 96 chapter-wise tests · 30 video lessons`, `From ₹399 · One-time payment · no auto-renewal`); white 44px button `See plans`, primary text → paywall.
- **Subject cards:** 18px radius, 4px accent top bar, 40px wash icon tile (book-open stroke, primary), name Sora 15/700, meta 11.5px muted; full-width 44px wash CTA `Try your free {subject} test` with sparkles icon, primary text; lock hint centered under it `🔒 {n} in pass` 11px muted. Desktop: 3-col grid.
- Banner + free CTAs appear **only** for the class currently viewed. Never per-subject prices.

### 1e — Home, subscribed class
Same shell, pill shows green dot. No banner. Order: **resume card** first when an attempt is in progress (2px primary border, wash bg, 18px radius: `IN PROGRESS` 11px/800 primary letterspaced, test name Sora 17/700, `Question 8 of 18 · 14 min left` 13px, 44px primary CTA `Pick up where you left off` + arrow) → validity note 11.5px muted `Pass active · valid till {date}` → subject cards with progress (`9 of 38 tests attempted` + avg % in accent Sora 800, 6px primary progress bar on wash) and CTA: primary subject `Continue · {next chapter test}` solid primary with play icon; other subjects wash button. Desktop: resume card (flex 1.2) beside 2-col subject grid.

### 1f — My progress (absorbs History)
Title `My progress` Sora 22/800 + subtitle `Scores, coverage, and where to focus next` 12.5px muted.
- **Subject pill tabs** (36px): active solid primary white; rest wash/text-secondary. The pills filter **both** the trend chart and Recent attempts.
- **Score trend card:** last 8 attempts; hairline grid at 25/50/75 with 9px labels; 2.5px primary line, 3px lavender dots, latest point 4px primary + value label Sora 11/800 ink. (Existing recharts line — restyle only.)
- **Recent attempts card (NEW — replaces `/my-attempts`):** card header `Recent attempts` Sora 15/700 + right link `View all 32` 11px/700 primary-deep. Rows 44px+ (11/16px padding, 1px top borders): 38px subject-initial tile (11px radius, wash bg, primary Sora 14/800) · test name 13px/700 + meta `{subject} · {date}` 11px muted · right-aligned score `82%` Sora 15/800 colored by band (≥75 success, ≥50 warning, else error) over `20 / 24` 10.5px muted. In-progress attempts show a wash/primary-deep `In progress` chip and a chevron instead of a score; tapping resumes the attempt, finished rows open the result. Scoped to the active class; server-paginated via existing `/api/student/attempts`.
- **Coverage by subject:** 8px bars on wash; sequential purples primary → accent → lavender; label 12.5px/700 + fraction right.
- **Worth another look:** 4px warning top bar; rows on wash (12px radius): subject 13px/700, avg % Sora 13/800 warning, `Practice` primary button (8px radius, 11.5px/700) deep-linking to the subject.

### 1g — My subscriptions (multi-class)
Title `My subscriptions` Sora 22/800 + subtitle. **One card per class the student holds:**
- **Active pass card:** 4px success top bar; `CBSE · Class 10` Sora 16/700; `12-month pass · valid till 12 Jan 2027 · **168 days left**` 12.5px; `Active` pill (success tint/success 11px/700); 6px success time-elapsed bar on wash; 44px primary `Renew` + microcopy 11px muted `Renewing adds time from your current expiry — you never lose days.`
- **Free-browsing class card (NEW):** plain card, `CBSE · Class 7` + `Free browsing — no pass yet · 1 free test per subject` muted; `Free` pill (wash/primary-deep); outline-primary 44px CTA `See plans — from ₹399` → that class's paywall. A quiet doorway, never a nag.
- Expired variant, payment history rows (desc / date · Razorpay · method / amount Sora + receipt icon), and grandfathered `Your purchased tests` are unchanged from `design_handoff_b2c_web` 1f.

## Interactions & Behavior
- **Shell:** identical header component on every student route; the legacy shell and its mobile tab bar are deleted, not hidden. Sheet/modal open ~240ms ease-out slide-up; respect `prefers-reduced-motion`.
- **Context switch:** re-scopes Home/progress/subscriptions instantly; active context persisted server-side (no localStorage). No student page may query or display another class's content — fail closed.
- **Add-class:** duplicate = disabled chip (never an error state); empty board hidden; on success write context + set active + land on `/dashboard` quietly. Analytics event `class_added {boardId, classId}`.
- **Post-login:** ≥1 context → `/dashboard`; zero → `/onboarding` (visually unchanged, shown once ever; gate reads `tq_student_contexts` on every entry path).
- **Locks:** every locked element opens the paywall — a lock is a doorway, never a dead end.
- **Loading/empty/error:** skeletons in wash per card; Recent attempts empty state: `No attempts in {class} yet — try a free test` linking to Home; class-grid fetch failure inside the sheet names the fix and offers retry.

## State Management
Student: contexts list + active context id (server), pass status per context, in-progress attempt, per-subject progress, add-class sheet state (selected board — defaults to active context's board, per-board class cache, selected class, saving flag), attempts page cursor + active subject filter (shared by trend and Recent attempts).

## Data / API notes (from the codebase)
- Reuse: `GET/POST /api/student/contexts`, `/api/student/home?contextId=`, `/api/boards?withClasses=1`, `/api/boards/{id}/classes`, `/api/student/attempts?page=`, `/api/student/subscriptions`, `/api/student/dashboard`. No schema changes — `tq_student_contexts` exists.
- The class list for the sheet needs `offeringCount` (already returned) and an `alreadyAdded` flag derivable client-side from the contexts list; counts + minPrice for the summary strip come from the plans/home APIs per board+class.
- Guardrails from the fix brief: do not touch the attempt engine, paywall/checkout, receipts, or access gating.

## Assets
`assets/logo-mark.png` (512×512, transparent — header mark at 28px, dark-mode safe). `assets/logo-lockup.png` (1334×330 — light marketing headers only). Icons are inline 24-viewBox strokes in the mock — map to lucide-react: `chevron-down`, `plus`, `check`, `x`, `lock`, `play`, `sparkles`, `clock`, `book-open`, `alert-triangle`, `arrow-right`, `chevron-right`, `receipt`, `sun`, `moon`.

## Files
- `Student Flow Consolidation.dc.html` — the design canvas (open in a browser; needs `support.js` + `assets/` beside it)
- `support.js` — canvas runtime (reference only)
- `assets/` — logo assets

## Acceptance (mirrors the fix brief)
Login lands on Home in one shell that never changes shape; onboarding asked once, ever; `/tests` no longer serves a cross-class list; the switcher adds a class in two taps and lands on that class's Home showing its free samples + its own subscribe banner; History lives inside My progress as Recent attempts; every screen passes AA in light and dark with ≥44px targets. `npm run build` green; E2E covers one-shell, one-time onboarding, post-login → Home, and add-class.
