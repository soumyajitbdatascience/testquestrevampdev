# Handoff: Testquest B2C Subscription Experience (Web)

**Target codebase:** `testquest-app` (Next.js 16 App Router · TypeScript · Tailwind v4 · shadcn/ui · Prisma 6 + legacy MySQL views · Razorpay · custom JWT auth)
**Requirement baseline:** `docs/handover/b2c-enhancement-plan.md` v1.2 · design briefs `claude-design-brief.md` (student) + `claude-admin-design-brief.md` (admin)

## Overview
Testquest moves from pay-per-test to **prepaid Board+Class passes** (3/6/12 months, one-time Razorpay payment, no auto-renew). This handoff covers the full student journey (onboarding → home → subject → paywall → success → subscriptions → progress → video), the conversion-optimized funnel (sample-result upsell, coupons on the pass), and the admin content-ops cockpit (grouped sidebar, chapters & tagging, videos, samples, plans, launch readiness, subscriptions).

## About the Design Files
The bundled `Testquest Scope A.dc.html` (open it in a browser; `support.js` + `uploads/` must sit beside it) is a **design reference created in HTML** — it shows intended look and behavior, and is not production code. The task is to **recreate these designs inside `testquest-app`** using its established patterns: App Router pages, shadcn/ui components, Tailwind v4 utilities, oklch tokens in `src/app/globals.css`, existing auth/order/coupon APIs. Do not copy the HTML markup.

The canvas is organized in turns, newest at top. Option ids are visible badges:
- **Turn 3 (`3a`–`3e`)** — journey optimization + coupons (supersedes matching parts of turn 1 where they conflict)
- **Turn 2 (`2a`–`2g`)** — admin screens
- **Turn 1 (`1a`–`1h`)** — student Scope A screens

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, copy, and states are final intent. Recreate pixel-faithfully with the codebase's components; where shadcn/ui provides an equivalent (Dialog, Sheet, Tabs, Table, Switch, Badge), use it and restyle via tokens rather than hand-rolling.

## Design Tokens (extend `globals.css`; replaces the Meridian gold/indigo direction for these surfaces)
| Token | Light | Role / rule |
|---|---|---|
| `primary` | `#6134EB` | CTAs, active states, links on dark; white text on it passes AA (6.6:1) |
| `primary-deep` | `#642CC8` | Hover/pressed; text links on white (7.6:1) |
| `ink` | `#140C3D` | Headings + body text |
| `accent` | `#815FE9` | Icons, large display text, chart lines only — never body text on white |
| `lavender` | `#A790EA` | Decorative only (formula decor, focus rings) — never text |
| `wash` | `#F4F0FE` | Section bg, locked fills, `primary-dim` role, selected rows |
| `text-secondary` | `#4B426E` · `text-muted` `#837CA3` | Secondary copy · captions/meta (large/secondary only) |
| `border` | `#E6E1F5` | Hairlines. Page bg alt: `#FBFAFE` |
| semantic | success `#1B8A5A` · warning `#B45309` · error `#D92D20` | Tints used: `#EAF7F0`, `#FDF3E7`, `#FCEEE9` |

**Dark mode** (class-toggled, both modes required on every screen): bg `#130C36`, card `#1D1550`, raised `#251C5E`, sidebar/dark-alt `#181040`, border `#332A6B`, text `#F1EDFF`, secondary `#C0B5EA`, muted `#948BC4`, primary → `#815FE9`, link/accent `#A790EA`, success `#45C990`, warning `#E1A03C`, error `#F97066`.

**Type:** display = Sora (600–800) for headings/numbers; body = Manrope (400–800). (Stand-ins for the existing display font — swap only if the owner keeps DM Serif; sizes/weights stay.) Scale used: h1 24–26/1.2, screen title 17–20, card title 14–15.5, body 13–14, meta 11–12, admin body 13 with 12–12.5 table cells.
**Shape:** cards `18px` radius with optional 4px accent top bar; inputs/buttons `11–14px`; pills `999px`. Primary CTA shadow: `0 6px 18px rgba(97,52,235,.35)`.
**Touch:** ≥44px targets on student mobile; admin rows may be 38–48px. Baseline student viewport 375px; admin reference 1280px.

## Screens / Views — Student

### 1a Onboarding (`/onboarding`, full-screen, ~20s)
Three steps with a 3-segment progress bar (4px, filled = primary): **board** (radio cards, 52px rows, selected = 2px primary border + wash bg + primary check circle) → **class** (3-col grid of 56px chips, Classes 6–12) → **optional second class** (chip row + Skip / Finish, desktop shows a centered 520px card on wash). Boards list is admin-configured. Shown on first login and once to legacy accounts with no context (`tq_student_contexts` empty). "Edit contexts" re-entry from header toggle + settings. Lavender formula decor at 0.3–0.5 opacity, never overlapping text.

### 1b Home (`/dashboard` replacement)
Header: logo mark 28px (assets below), **context pill** (wash bg, 40px, `CBSE · Class 10 ▾`; green 7px dot when subscribed), avatar. Context dropdown: student's contexts with status line (subscribed = green "Subscribed — till {date}"; else "Free browsing · 1 free test per subject"), then "+ Add a class" (primary-deep) and quiet "Edit contexts" footer. Calm at 1 context, scales to 4–5.
- **Unsubscribed:** one primary banner card (solid primary, 18px radius, lavender circle decor): "Unlock all of Class {n}" / "All N subjects · T chapter-wise tests · V video lessons" / "From ₹{min} · One-time payment · no auto-renewal" / white "See plans" button → paywall. Subject cards below (accent top bar, 40px wash icon tile, name, "38 chapter-wise tests · 14 video lessons", full-width wash CTA "Try your free Maths test", lock hint "37 in pass"). Never per-subject prices.
- **Subscribed:** banner gone; cards show progress ("9 of 15 chapters attempted", % in accent, 6px primary progress bar) + next-action CTA ("Continue · Ch 10 Circles — Test 2" primary; secondary subjects use wash buttons). Validity note in header area.
- Desktop 1100+: top nav (Home / My progress / My subscriptions), 3-col subject grid.

### 3d Returning-user home (evolves 1b — implement this version)
Order: (1) **Resume card** first (2px primary border, wash bg): title, "Question 8 of 18 · 14 min left", primary CTA "Pick up where you left off" — surfaces the existing in-progress-attempt detection on home, not just test detail. (2) **T-7 renew strip** (warning tint bg, clock icon): "Your pass ends in 7 days. Renew now — days add on after {expiry}, never lost." (3) "Keep going" list: weak-chapter card (41% amber tile → practice), next suggested test, half-watched video.

### 1c Subject page (`/subjects/[id]` new)
Header: back, subject name, meta line "CBSE · Class 10 · 15 chapters · 38 tests · 14 videos", green "1 free test" pill. Ordered chapter accordions (16px radius; expanded header = wash bg, number in accent): test rows 52px (state icon 26px circle: green check+"Done — 82%" / lock in wash circle + "42 marks · 60 min" + "Unlock" link) and a 2-up video tile row. Collapsed chapters show counts. Trailing dashed **"More tests"** group for untagged content. **Unsubscribed:** sticky bottom CTA "Unlock Class 10 — from ₹499" + "One-time payment · No auto-renewal" microcopy over a white gradient fade. **Subscribed:** no CTA; Start buttons (36px primary) and done scores; per-chapter "2 done" counts. Desktop: 280px chapter rail (active = wash row, completion fraction) + expanded chapter card.

### Video treatment (1c tiles + 1h page) — videos are complementary
A pass unlocks **every** video mapped to its Board→Class (→Subject→Chapter). There are no free or individually purchasable videos.
- **Locked tile (any unsubscribed view):** wash fill, lock icon, "Included with the pass", title + duration. **Never render the YouTube thumbnail** — the URL leaks the video id. The API must not return the id to non-subscribers.
- **Subscribed tile:** gradient thumb placeholder (`135deg, #251C5E → primary`) with white play chip, duration badge.
- **1h player page (subscribed):** back header with chapter context, 16:9 embed (`youtube-nocookie.com`), title, "Video 1 of 2 · Chapter 1 · 08:12", actions "Take Test 2 on this topic" / "Mark watched", "Up next in {chapter}" list mixing videos and tests (tests get Start). **Unsubscribed player route:** locked hero (wash, lock chip, "This video is included with the Class 10 pass" / "Subscribe once — every video in every subject unlocks together", duration chip) + primary side panel "Unlock every video … See plans — from ₹499".

### 1d + 3c Subscription sheet — the paywall (build 3c, the coupon version)
Bottom sheet on mobile (20px top radius, grabber), centered 620px modal on desktop. Opened from any locked item; **remember the item and return to it after payment**.
1. Title "Unlock CBSE · Class 10" + summary "All 5 subjects · 142 chapter-wise tests · 56 video lessons" (real counts from API).
2. **Duration cards** — 3/6/12 months as radio rows (56–62px; price right in Sora 16–18px, per-month under label, green "Save {n}%" pill computed vs 3-month rate). **12-month pre-selected**: 2px primary border, wash bg, floating "Best value" tag. Desktop: 3 columns. Prices admin-set from plans API.
3. **Coupon** (validates via existing `POST /api/coupons/validate`; discount applies to the selected duration's price). Four states: resting — one quiet link "Have a coupon code?"; open — uppercase input (2px primary border when focused) + Apply; **applied** — success-tinted card (1px `#1B8A5A` border, `#EAF7F0` bg): "Coupon WELCOME25 applied · Remove" + line items (pass price / "25% off (max ₹325)" − ₹325 / "You pay ₹974" bold, hairline above) — the selected card's per-month math updates ("now ₹81/month"); invalid/expired — 2px error border + "This code expired on 31 Oct. Try another?"; below-minimum — warning tint note "SAVE300 needs a minimum of ₹799 — pick the 6 or 12-month pass to use it."
4. **Honesty line** (shield icon, wash card): "One-time payment. Valid until {today + duration}. **No auto-renewal.**" (green emphasis). Recompute date on duration change.
5. Pay button: "Pay ₹{final}" (50px, primary, shadow) → existing Razorpay order flow. Trust row: lock icon + "Secured by Razorpay · UPI, cards, netbanking".

### 1e Post-payment success
Full-screen on wash: 84px white circle with 58px success-green check, "All of Class 10, unlocked." (Sora 26/800), "5 subjects · 142 tests · 56 videos · Valid till {date} — no auto-renewal.", "Receipt sent to {email}". CTAs pinned bottom: primary "Continue to {the exact item tapped}" + outline "Explore your subjects". Lavender decor. Celebratory but quick — no blocking animation.

### 3b Sample-test result (`/attempts/[id]/result` for free samples) — the conversion moment
Score ring (120px SVG, primary arc, 82% in Sora 26/800, "20 of 24 correct"), social proof line in success green ("Better than 68% of Class 10 students on this test"), correct/wrong/skipped tiles. Then per-question review where the student's answer shows but **the solution area is blurred (`filter: blur(4px)`) with a lock overlay**: "Step-by-step solutions are in the class pass". Blur real solution text server-side-safely (send placeholder text, not the real solution). Closing line "Solutions for all 24 questions — plus 141 more tests and 56 videos." CTA "See where you went wrong — from ₹499" → paywall; ghost "Retake test".

### 1f My subscriptions (`/profile` purchases section → own page)
Active pass card (green top bar, "Active" pill, "12-month pass · valid till 12 Jan 2027 · 168 days left", green time-elapsed bar, primary **Renew** CTA + microcopy "Renewing adds time from your current expiry — you never lose days."). Expired card (muted, red "Expired" pill, "your scores and progress are saved", outline "Renew from ₹399"). **Payment history** rows (desc, date · Razorpay · method, amount, Receipt link). **"Your purchased tests"** — grandfathered `tq_student_access` rows, "yours forever".

### 1g My progress (per subject within active context)
Subject pill tabs (active = solid primary). Score-trend line chart (last 8 attempts; primary line 2.5px, lavender dots, latest point primary + % label; hairline grid at 25/50/75). Chapter-completion bars (8px; sequential purples by intensity: primary → accent → lavender; label + fraction). **"Worth another look"** card (warning top bar): weak chapters with avg % in warning color → "Practice" deep-link. Reuses existing dashboard analytics API. Charts: labels in ink, never series color; no dual axes.

### 3a Funnel (reference)
Signup (name/email/password only — board+class moves to onboarding) → 1a → 1b free sample → 3b result-sell → 3c paywall+coupon → 1e unlock → return to denied item. Returning loop: resume-first home. Expiry loop: T-7/T-1 emails → 1f renew; win-back email may carry a coupon.

## Screens / Views — Admin (desktop-first 1280; usable ≤768)

### 2a Grouped sidebar + dashboard
Sidebar 216px: sections OVERVIEW (Dashboard, Launch readiness "New"), CONTENT (existing four, unchanged), CURRICULUM (Boards, Chapters & tagging, Videos, Free samples), COMMERCE (Plans & pricing, Subscriptions, Orders, Bundles ⌞Legacy⌟, Coupons ⌞Legacy⌟), PEOPLE. Section labels 10px/700 uppercase muted; active item wash bg + primary text; Legacy = outline pill. Extend `admin-sidebar.tsx`, don't replace. Dashboard gains 4 tiles: Active passes, Revenue this month, Tagging progress (bar), Expiring in 7 days (warning number) — linking to 2f/2g.

### Context selector (shared component — build once)
Sticky bar on every Curriculum screen: wash bg + 2px primary bottom border, "WORKING IN" label, three white dropdown chips (Board / Class / Subject), right-aligned coverage readout "14 chapters · **312/412 tests tagged** · 18 videos · sample ✓". Persist per admin session (server-side).

### 2b Chapters & tagging — the workhorse
Left pane 270px: chapter list (drag handles, `01 · Real Numbers`, per-chapter `3t · 2v` counts; active = wash bg + 3px primary left border; inline add row "Type a chapter name… ↵ to add"; rename inline; archive, never delete). Right pane tabs: **In chapter (n)** and **Untagged (100)** with count badge (solid primary pill). Untagged toolbar: search (`/` shortcut), Free/paid + Tagged-elsewhere filters, "37 selected of 100 filtered", primary "Move to chapter →" (opens chapter picker; confirm shows count: "Move 37 tests to 'Trigonometry'?"). Dense table: checkbox / name / Qs / duration / Free-Paid / other-board chips (`ICSE ·10` — cross-board tagging is additive, never a move) / per-row quick-assign →. Selected rows = wash bg. Select-all-filtered supported; server pagination ("1–50 of 100"); motivation counter "**100 left** in this subject". After commit: dark toast (ink bg) "Moved 37 tests to 'Trigonometry' — **Undo**" (lavender link). Keyboard: full tab order, Enter commits, Esc cancels.

### 2c Video manager
Within context, per chapter. "Add video" = paste YouTube URL → states: extracting id → **fetched** (oEmbed title + thumbnail preview — admin-only; editable title, duration, chapter select, Save) → errors, each with the fix: "Invalid URL — paste the full watch or share URL." / "Video is Private — set it to Unlisted on the brand channel, then paste again." / "Embedding disabled — enable Allow embedding in YouTube Studio → Details → Advanced." List mirrors the chapter test list: drag order, duration, active toggle.

### 2d Free-sample picker
One card per subject: set = green "Sample set ✓" pill + current test row + Change (searchable picker limited to the context's active tagged tests; archived/empty impossible). Empty = **loud**: 2px warning border, "No free sample set — students see no try-free test for this subject." + primary "Pick a sample test".

### 2e Plans & pricing
Grid: rows = board+class (content-less combos greyed "no content yet"), columns 3/6/12 price inputs + status. Zero/empty price → red input border + "Blocked" pill (can't activate). Bulk: "Copy this row's pricing to…". Rows render an expander (▸) reserved for future per-subject plans. Right panel: **live student paywall preview** (mini 3c) for the selected row.

### 2f Launch readiness
One row per board+class: chapters (n/n subjects), % tests tagged (90px bar; green at 100%), video count, samples n/5, plans status → rollup pill Ready (green) / In progress (wash+primary-deep) / Not started (outline). Every deficit deep-links into the exact curriculum context.

### 2g Subscriptions + board guard
Stat tiles (active passes, revenue this month, expiring 7d in warning, renewal rate); filters Board/Class/Duration/Status + "Expiring soon" preset (wash chip); CSV export. Passes table: student, board+class, duration, purchased, expires (warning color + "· 7d" when close), amount, status pill. **Board deactivate guard dialog:** "Deactivate ICSE board? ICSE has **212 active student passes**" + consequences list (passes keep working; removed from onboarding/storefront; plans hidden) — Cancel / warning-colored "Deactivate board". Always "archive"/"deactivate", never "delete".

### 3e Coupon editor (extends existing `/admin/coupons`)
Add scope chips: **Class passes — all** / Specific board+class… / Specific durations… / Legacy: tests & bundles. Type/value/cap/min-order/limits/validity unchanged. Coupon applies at the paywall and can ride win-back emails.

## Interactions & Behavior
- **Paywall:** duration change re-runs per-month math, savings %, validity date, coupon math, pay amount. Coupon Apply disables button while validating; applied state re-validates on duration change (min-order may invalidate → show state 4). Razorpay modal per existing `POST /api/orders/create` → `verify`; on success write pass + `tq_coupon_usages`, then route to 1e with `returnTo`.
- **Renew:** always extends from current expiry (never today). Copy must say so.
- **Resume:** home queries in-progress attempt (existing detection) and renders 3d's resume card; card disappears on submit/expiry of attempt.
- **Context toggle:** switching re-scopes home/subject/progress instantly; server-persisted (no localStorage).
- **Locks:** every locked element opens the paywall — a lock is a doorway, never a dead end.
- **Admin bulk actions:** preview count before commit, undo toast after, determinate progress on long ops.
- **Animations:** subtle only — sheet slide-up ~240ms ease-out, toast fade, progress bar width transitions. Respect `prefers-reduced-motion`.

## State Management
- Student: active context id (server), pass status per context (`subscribed | free | expired` + expiry), plans+prices per context, coupon validation result, selected duration, in-progress attempt, per-subject progress.
- Loading/empty/error required per screen (skeletons in wash; empty states with one clear action; errors name the fix). Locked/subscribed/expired variants per §Screens.
- Admin: session-persisted curriculum context; selection model (ids + select-all-filtered flag); optimistic row moves with rollback on failure.

## Data / API notes (from the codebase)
- New: `tq_student_contexts`, plans, passes tables (additive `tq_*` only; legacy schema untouched; legacy reads via views; 10s query ceiling — server pagination on all admin lists).
- Coupons: reuse `tq_coupons` + `tq_coupon_usages` + `POST /api/coupons/validate`; order-create must accept plan orders with couponId.
- Video governance: video id returned **only** to covered students; locked tiles get title+duration only.
- Free sample: web-side designation (`tq_free_tests` style), never the legacy free/paid flag.
- Grandfathering: existing `tq_student_access` rows listed under "Your purchased tests" forever.

## Assets
`uploads/logo-lockup.png` (1334×330, transparent — light headers, ~26px tall), `uploads/logo-mark.png` (512×512 — mobile headers, dark-mode mark, favicons; pair with "Test Quest" text in `#F1EDFF` on dark), `uploads/logo.png` / `uploads/logo-email.png` (lockup with tagline — marketing/email only). Icons in the mock are inline 24-viewBox strokes — map to lucide-react (`lock`, `play`, `check`, `chevron-down`, `shield-check`, `clock`, `pencil`, `search`).

## Files
- `Testquest Scope A.dc.html` — the full design canvas (open in browser; needs `support.js` + `uploads/` beside it)
- `support.js` — runtime for the canvas (reference only)
- `uploads/` — logo assets

## Out of scope / flags for engineering
- Emails (8 lifecycle templates) and the per-screen states matrix are designed-next, not in this bundle.
- Exam-taking mechanics, B2B coaching, and existing admin CRUD screens: untouched beyond nav regrouping + token alignment.
- Google Play billing question is phase-2 (Android), not web.
