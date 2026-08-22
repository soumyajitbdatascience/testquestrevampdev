# Testquest — Coaching Centre UI Plan

> **Purpose:** UI/UX reference for building the Coaching Centre layer. Companion to `IMPLEMENTATION_PLAN.md`. Defines design system extensions, information architecture, component vocabulary, screen inventory by phase, and a working process for solo design + Claude Code execution.

Last updated: 2026-05-26

---

## 0. How to use this with Claude Code

Add a pointer in `CLAUDE.md`:

```
## UI reference
UI_PLAN.md defines visual conventions, screen layouts, and component patterns
for the coaching centre layer. Consult before building any new screen.
Existing Meridian design system in /lib/design and components/ui is the base.
```

When briefing Claude Code on a UI task, always include three things:

1. The IMPLEMENTATION_PLAN task ID
2. The UI_PLAN section that covers it
3. A reference to the closest existing screen pattern in the codebase

Example: "Build the screen per IMPLEMENTATION_PLAN Task 1.6 (`/coaching/dashboard`). Layout intent in UI_PLAN §5.1.4. Match the visual structure of the existing `/dashboard` (student B2C) — same hero, stat tiles, chart placement — but with the coaching-specific content listed."

---

## 1. Design system context

The web app already has the Meridian system:

- **Colors:** saffron gold `oklch(0.78 0.17 65)` primary, deep indigo `oklch(0.13 0.04 270)` surface, dark default
- **Typography:** DM Sans body, DM Serif Display italic for headlines and big numbers
- **Score signals:** emerald ≥75%, amber ≥50%, red <50%
- **Component library:** shadcn/ui + Tailwind v4
- **Animations:** Quest Constellation (landing), Achievement Pulse Rings (dashboard), Drifting Formulas (tests bg), Rotating Yantra (auth). Respects `prefers-reduced-motion`.

The coaching centre layer does **not** introduce a new design system. It extends Meridian with three additions: a brand override system (for white-label), role-based signals (owner / teacher / student), and status conventions (assignment completion, payment state, trial countdown).

---

## 2. Design token additions

### 2.1 Brand override system (for Phase 3 white-label)

The Meridian primary color is a CSS variable. White-label centres on Pro+ override it at the org context boundary.

```css
:root {
  --brand-primary: oklch(0.78 0.17 65);        /* saffron, Meridian default */
  --brand-primary-foreground: oklch(0.13 0.04 270);
  --brand-secondary: oklch(0.13 0.04 270);     /* indigo */
}

[data-org-branded="true"] {
  --brand-primary: var(--org-primary);          /* set from tq_organizations.brandingJson */
  --brand-secondary: var(--org-secondary);
}
```

The wrapper component reads org branding from JWT context and sets the data attribute on `<html>` for student-facing pages. Owner/teacher screens always show Meridian (so the centre staff always know they're on Testquest).

### 2.2 Role signals

Subtle background-tint badges, not loud colors:

| Role | Badge bg | Text | Icon |
|---|---|---|---|
| OWNER | gold-tinted | gold | crown |
| TEACHER | indigo-tinted | indigo | book |
| STUDENT | neutral | neutral | none (default) |

Use shadcn `Badge` with a `variant` extension; don't introduce new component primitives.

### 2.3 Status pill conventions

Consistent across assignments, payments, trial states:

| State | Color | Use |
|---|---|---|
| Active / paid / completed | emerald | positive terminal state |
| In progress / pending | amber | transient state |
| Not started / unpaid / overdue | red-tinted | needs attention |
| Locked / archived / cancelled | neutral grey | non-active |
| Trial | gold (saffron) | special — denotes the trial period |

Implement once as a `StatusPill` component; use everywhere.

### 2.4 Mobile breakpoint

Owners do 80%+ of work on phone. Design every screen mobile-first.

- **xs (default):** 360px — budget Android. All primary actions reachable.
- **sm:** 640px — large phone, small tablet
- **md:** 768px — tablet, small laptop
- **lg:** 1024px — laptop
- **xl:** 1280px+ — desktop

Tap targets minimum 44×44px. Bottom-fixed primary action on critical screens (assign test, batch detail).

---

## 3. Information architecture

### 3.1 Public routes (unauthenticated)

```
/                                  -- existing B2C landing
/for-coaching-centres              -- NEW: B2B landing
/coaching/signup                   -- NEW: self-serve signup
/coaching/login                    -- NEW: centre login (same auth backend as /login)
/coaching/demo                     -- NEW: book demo form
/coaching/join/[token]             -- NEW: student invite-link join
```

### 3.2 Authenticated coaching routes

```
/coaching/setup                    -- 5-step wizard for new centres
/coaching/dashboard                -- home for owners/teachers
/coaching/batches                  -- list of all batches
/coaching/batches/[id]             -- single batch detail
/coaching/batches/[id]/assign      -- assign test flow
/coaching/batches/[id]/assignments/[id]   -- live assignment monitoring
/coaching/tests                    -- (Phase 2) browse Testquest + own bank
/coaching/tests/new                -- (Phase 2) build custom test
/coaching/questions                -- (Phase 2) private question bank + import
/coaching/students                 -- cross-batch student list
/coaching/team                     -- (Phase 2) members + invite
/coaching/billing                  -- subscription + invoices
/coaching/settings                 -- branding (Phase 3), profile, security
/coaching/reports                  -- (Phase 3) parent reports overview
```

### 3.3 Top navigation (within /coaching)

**Desktop / tablet:** sidebar nav (collapsible to icons), sections:

- Dashboard
- Batches
- Tests
- Questions *(Phase 2+)*
- Team *(Phase 2+, hidden in solo mode)*
- Reports *(Phase 3+)*
- — divider —
- Billing
- Settings

**Mobile (xs/sm):** bottom tab bar with 4 items + "More":

- Dashboard | Batches | Tests | Students | More

Trial countdown banner sticky at top across all screens during trial period.

### 3.4 New routes in main admin panel (Phase 2)

```
/admin/organizations
/admin/organizations/new
/admin/organizations/[id]
/admin/organizations/[id]/billing
```

These live inside existing `/admin/*` shell; no nav restructure needed — just add a top-level "Organizations" link to admin sidebar.

---

## 4. Component vocabulary

New reusable patterns. Each is implemented once and used across screens. Avoid one-offs.

| Pattern | Purpose | Built from |
|---|---|---|
| `StatTile` | Numeric summary (e.g. "47 students") with optional delta indicator | shadcn `Card` + DM Serif Display number |
| `StatusPill` | Tiny labeled badge for state (see §2.3) | shadcn `Badge` variants |
| `ActivityFeedItem` | Single row in an activity feed (student took test, etc.) | flex row, avatar + text + timestamp |
| `WizardShell` | Multi-step form container with progress bar + back/next | new; used by /coaching/setup, possibly billing |
| `EmptyState` | Standard empty card with icon, headline, body, primary CTA | shadcn `Card` |
| `InviteShareCard` | Generated invite link with copy button + WhatsApp/SMS share buttons | shadcn `Card` + native share API |
| `PlanComparisonCard` | One pricing tier card (Starter / Growth / Pro / Enterprise) | shadcn `Card` with feature list |
| `TrialBanner` | Top-of-page banner with days-left counter + upgrade CTA | shadcn `Alert` variant |
| `BatchListItem` | Single batch row in a list — name, class, student count, quick action | flex row, mobile-stacked |
| `StudentListItem` | Single student row — name, last activity, score average, menu | flex row |
| `AssignmentCard` | Summary of one assignment — test name, due date, completion progress bar | shadcn `Card` with progress bar |
| `QuestionPickerRow` | One question in the test builder picker with checkbox + preview toggle | shadcn `Checkbox` + collapsible |
| `RoleBadge` | Small badge showing user role (see §2.2) | shadcn `Badge` |
| `BrandedHeader` | App header that adapts to org branding when present | header component with brand context |
| `LiveProgressIndicator` | Real-time counter for assignment monitoring (X / Y completed) | shadcn `Progress` + polling hook |

Build the first 5 in Phase 1. Add others as their phase arrives.

---

## 5. Screen inventory and layout intent — by phase

### 5.1 Phase 1 screens

#### 5.1.1 `/for-coaching-centres` — B2B landing

**Purpose:** convert centre owners arriving from Google/referrals.

**Layout (top to bottom):**
- Hero band: headline + subhead + dual CTAs (Start trial primary, Book demo secondary), supporting illustration to the right on desktop / below on mobile
- Three-column value props: question bank breadth, branded parent reports, mobile-friendly
- Pricing tier row: 4 `PlanComparisonCard` instances side by side (stack on mobile), Pro highlighted
- Sample dashboard screenshot embedded — single device frame
- Two testimonial cards (placeholder copy initially, real quotes after closed beta)
- FAQ accordion
- Footer CTA band

**Mobile considerations:** hero CTA sticks to bottom on scroll past hero. Pricing tiers carousel-scroll horizontally.

#### 5.1.2 `/coaching/signup` — self-serve form

**Purpose:** create org + trial in one form.

**Layout:** centered card (max-width 480px), single column. Logo at top. Title "Start your 14-day trial." Form fields stacked. Primary button full-width. Link below: "Already have an account? Sign in."

**Fields order matters:** centre name → owner name → city → mobile → email → password → expected student count. (Easiest first, friction last.)

**State handling:** inline validation, no popups. Submit button shows spinner state. On error, focus the failing field.

#### 5.1.3 `/coaching/setup` — 5-step wizard

**Purpose:** new owner from zero to first test assigned.

**Layout:** `WizardShell` component with progress bar at top showing 5 steps. Each step content centered, max-width 600px. Sticky footer with Back / Next buttons.

**Steps:**
1. **Branding** — logo upload (dropzone or skip), centre display name, city confirm, primary color swatch picker (saffron default + 5 alternatives). Skip allowed.
2. **Boards & classes** — multi-select chip grid for boards (CBSE, ICSE, State boards), then class chips appear filtered. Required.
3. **First batch** — batch name (with smart placeholder like "Class 10 CBSE Morning 2026"), class dropdown, board dropdown, subjects multi-select. Required.
4. **Invite students** — three tabs: Generate link / Paste roster / Skip. Generate link shows `InviteShareCard`. Paste roster takes textarea (one student per line: name, mobile, optional email) with live preview parse and validation.
5. **Done** — summary card ("You created [batch name] with [N] students. Now assign your first test.") + primary CTA to dashboard.

**Mobile:** each step fills the screen. Progress bar collapses to "Step 3 of 5" text.

#### 5.1.4 `/coaching/dashboard` — owner home

**Purpose:** at-a-glance status + entry to common actions.

**Layout:**
- Top: `TrialBanner` if applicable
- Greeting row: "Good morning, [name]" + centre name + days-into-trial
- Stat tile grid (4 tiles on desktop, 2×2 on mobile): Students, Active Batches, Assignments this week, Average score
- Batch list: cards for each active batch with `BatchListItem` + quick assign button
- Recent activity feed: last 10 events (X student completed Y assignment, etc.) — `ActivityFeedItem` rows
- Empty state for batches: "Create your first batch" CTA card

**Mobile:** stat tiles 2×2 grid, batch list stacks, activity feed collapses to a "See activity" link below.

#### 5.1.5 `/coaching/batches/[id]` — batch detail

**Purpose:** day-to-day operations.

**Layout:**
- Header: batch name (editable inline by owner), class/board/subjects chips, student count, settings menu
- Sticky CTA: "Assign test" primary button
- Tabs: Students | Assignments | Reports (Reports disabled until Phase 3 — show coming-soon tooltip)
- **Students tab:** list of `StudentListItem`, with per-student avg score, last activity, three-dot menu (remove, transfer)
- **Assignments tab:** list of `AssignmentCard`, sorted active first, then past

**Mobile:** tabs become horizontal scroll. Sticky bottom CTA "Assign test".

#### 5.1.6 `/coaching/batches/[id]/assign` — assign test flow

**Purpose:** pick a Testquest test + schedule.

**Layout:** two-pane on desktop:
- Left pane (60%): test picker with search + filters (class auto-set, subject multi-select, difficulty, type). Results as cards with name, question count, duration, marks, preview button.
- Right pane (40%): selected test summary, due date picker, optional instructions textarea, "Notify by" multi-select (SMS, Email; WhatsApp in Phase 2), primary CTA "Assign to N students"

**Mobile:** full-screen picker first, "Continue" button to second screen with schedule + assign.

#### 5.1.7 `/coaching/batches/[id]/assignments/[id]` — live monitoring

**Purpose:** see who's done what.

**Layout:**
- Status header: completion progress bar (X / Y completed), average score (when ≥3 have completed), due countdown, "Send reminder" action
- Student list: each student with status pill (Not started / In progress / Completed), score if available, finish time
- Topic insights card (appears once ≥50% completion): top 3 weak topics
- Question-level panel: each question with % correct, expandable to see option distribution

**Mobile:** student list virtualizes if >20 rows. Topic + question panels become scrollable cards.

#### 5.1.8 `/coaching/billing` — plan + upgrade

**Purpose:** trial-to-paid conversion + ongoing billing.

**Layout:**
- Current plan card: plan name, status pill (Trial / Active / Grace / Expired), seats used / purchased, expiry date
- Upgrade section (visible during trial): pricing tier cards with selected tier pre-highlighted based on seats from signup
- Razorpay checkout button (reuses existing component)
- Invoice history table (empty during trial)

**Mobile:** sections stack. Pricing cards horizontal scroll.

#### 5.1.9 `/coaching/join/[token]` — student invite landing

**Purpose:** student joins their centre's batch.

**Layout:** centered card on a quietly-branded full-screen background. Top: "Join [Centre Name]" with logo if available. Body: "[Batch Name] — [Class, Board]". Form: full name, mobile (OTP flow), then OTP entry.

**Mobile:** edge-to-edge card, keyboard-aware.

---

### 5.2 Phase 2 screens (lighter detail)

- **`/coaching/team`** — table-style list of members (owner + teachers) with role badges, last active, three-dot menu (remove, change role). Top right: "Invite teacher" button → modal with email + name. Owner-as-teacher: when only one member, hide this screen entirely from nav.
- **`/coaching/tests/new`** — custom test builder. Two-pane: left = test config (name, class, subject, duration), right = `QuestionPickerRow` list with source labels (Testquest / Your bank). Bottom sticky bar: "Save test (N questions selected)".
- **`/coaching/questions`** — owned question bank. List view, filters (subject, type, difficulty), top-right "Import from Excel" button → modal with file dropzone + template download link.
- **`/admin/organizations`** — admin panel addition. Table with org name, type, plan, status, seats used, monthly revenue, sales stage. Filters and search above. Click row → detail.
- **`/admin/organizations/new`** — create org form for sales-led path. Form: centre name, owner email + mobile + name, plan tier dropdown, seat count, billing arrangement notes, sales notes. Submit → org created, owner gets magic link.
- **`/admin/organizations/[id]`** — detail tabs: Overview | Members | Batches | Usage | Billing | Sales notes.

### 5.3 Phase 3 screens

- **`/coaching/settings/branding`** — Pro+ only. Form: logo upload (light + dark variants), primary color picker, secondary color picker, support contact, preview pane on the right showing how student screens will look.
- **`/coaching/reports`** — overview of parent reports sent + pending. Row per student with last report sent date, "Send now" action. Bulk: "Generate reports for all students".
- **Parent report PDF layout** (not a screen but a deliverable): one-page A4. Top: centre logo + report title + student name + period. Score trend chart (4 weeks). Weak topics list. Subject-wise breakdown table. Attendance summary. Bottom: footer with centre contact.

### 5.4 Phase 4 screens

- **`/coaching/billing`** extension — subscription management for recurring plans: payment method (Razorpay mandate), upcoming charge, cancel flow.
- **Multi-branch parent dashboard** — for orgs with `parent_org_id`. Branch selector at top. "All branches" view shows consolidated stats with per-branch breakdown.
- **Student transfer dialog** — modal launched from student row menu. Pick destination batch from dropdown, "Transfer" button. Confirmation: history preserved.

### 5.5 Phase 5 screens

- **Bulk actions UI** — checkbox column on batch list, student list, assignment list. Top toolbar appears when ≥1 selected: bulk assign, bulk reminder, bulk remove.
- **Sample data prompt on first trial signup** — modal after wizard step 5: "Try with sample data?" with screenshot preview. Generates 1 demo batch + 10 fake students + 1 sample assignment.

---

## 6. Empty, error, and loading state conventions

These are required for every screen, not optional polish.

### 6.1 Empty states

Every list or table has an empty state. Standard structure: icon (large, neutral color) + headline + body sentence + primary CTA.

Examples:
- No batches → "No batches yet." + "Create your first batch to start assigning tests." + [Create batch] button
- No students in batch → "This batch is empty." + "Invite students using the link below or paste their names." + [Generate invite link] [Paste roster]
- No assignments → "No tests assigned yet." + "Pick a test from Testquest's bank to get started." + [Assign test]

Never show a blank panel with no content.

### 6.2 Error states

Three tiers:

1. **Inline field errors** — for form validation. Red text below the field. Never alert dialogs.
2. **Section errors** — when a data fetch fails for one section. Inline card with retry button. Other sections still render.
3. **Page-level errors** — 404, 403, 500. Centered full-screen with icon, headline, body, "Go back" + "Contact support" CTAs.

Error messages are written for the user, not the developer. "Couldn't load this batch's students. Try again?" not "fetch failed: 500".

### 6.3 Loading states

- **Initial page load:** skeleton loaders matching the layout. Never spinners on full pages.
- **Data refresh / mutation:** subtle inline spinner inside the affected element. Buttons go to a `loading` state with disabled + spinner.
- **Long operations (>3s expected):** progress indicator or step-by-step status. Bulk reminder to 100 students should show "Sending 47 of 100…".

Skeleton screens use the existing shadcn `Skeleton` primitive. Build matched skeletons for: stat tile, student row, batch card, activity feed item.

---

## 7. Design process for solo + Claude Code

### 7.1 When to sketch first vs go straight to code

**Sketch first (paper or Figma) when:**
- The screen has a layout you can't describe in 2 sentences
- Multiple states interact (the wizard, the assignment monitoring screen)
- You're inventing a new component pattern

**Skip sketches, prompt Claude Code directly when:**
- The screen is "list of X with detail view" or other standard pattern
- You can reference an existing screen as the model
- You'll know within 10 minutes of seeing the code whether it works

For Phase 1, sketch the setup wizard and the assignment monitoring screen. Everything else can go straight to code.

### 7.2 References to anchor visual quality

When briefing Claude Code on a new pattern, reference an existing well-designed example:

- **SaaS dashboards:** Linear, Vercel, Plane — clean, density-aware, mobile-respectful
- **Indian edtech adjacent:** Embibe and Toppr for content-density patterns
- **Forms and onboarding:** Stripe Atlas, Notion's onboarding
- **Mobile-first product screens:** Razorpay's own app

Don't paste these as instruction ("make it look like Linear"); use them as your own sanity check after Claude Code produces a draft.

### 7.3 Mobile testing protocol

End of every phase: pull out a real Android phone (sub-₹15k tier — Redmi/Realme/Moto budget range). Walk the new flows. Note:

- Tap targets too small
- Text too small to read at arm's length
- Sticky elements blocking content
- Slow renders on JS-heavy screens
- Keyboard covering input fields

Fix before the phase ships. This is the single highest-ROI quality activity for this product.

### 7.4 Brand vs convention

Default to convention for the operational UI (centre owner / teacher screens). Reserve brand expressiveness for marketing surfaces (`/for-coaching-centres`) and the trial onboarding (where wow-factor drives conversion). Don't put DM Serif Display italic on every heading — it loses meaning. Reserve it for headlines, big numbers in stat tiles, and quotes.

---

## 8. How to brief Claude Code on UI tasks

The template:

```
Build the screen described in UI_PLAN §5.1.X (or Phase 2/3/4/5 reference).
Implementation context: IMPLEMENTATION_PLAN Task Y.Z.

Match the structure of the existing [PATH TO REFERENCE SCREEN] — same layout 
shell, same component hierarchy, same Tailwind patterns. Use existing 
components from components/ui/* and design tokens from /lib/design.

Specifics:
- [list any concrete requirements that differ from the reference]

Empty/loading/error states are required per UI_PLAN §6 — don't skip them.

When done, show me:
- Screenshots of the happy path, empty state, loading state, and one error state
- The component file diffs
- Any new shadcn components added (I'd prefer reuse over new)
```

### Anti-patterns when prompting Claude Code on UI

- **Don't ask for "modern" / "clean" / "nice" UI** — these words don't constrain anything. Reference a specific existing screen instead.
- **Don't let it add a new color** — every new color requires me to extend the token system. If Claude Code wants to use a color, it's reaching for `--brand-primary`, `--brand-secondary`, or one of the status pill colors. That's it.
- **Don't let it add new fonts** — DM Sans and DM Serif Display are the entire font system. No exceptions.
- **Don't accept a desktop-only design** — every screen ships mobile responsive from the first commit. If the diff doesn't include the mobile breakpoint, send it back.
- **Don't accept missing empty states** — the diff should include the empty state markup. If it's "we'll add that later," it never gets added.

---

## 9. Open UI questions

Resolve as you build; track decisions in `USER_JOURNEY.md` §9.

- [ ] Logo upload size / format constraints — max dimensions, file size, formats allowed
- [ ] Primary color picker — fixed swatch options only, or free-form hex/oklch input on Pro tier?
- [ ] Dark mode for branded centres — does white-label respect dark mode too, or force light?
- [ ] Sidebar collapse memory — persist per device or per user?
- [ ] Trial banner — fully dismissible (until next session) or persistent always?
- [ ] Parent report PDF — single-page only, or allow multi-page for detailed history?
- [ ] WhatsApp share — native share API on mobile vs custom WA Business deep link
- [ ] Empty state illustrations — use an illustration library, generate with AI tooling once, or skip and use icons only?

---

## 10. Update protocol

When you add a new component pattern: add it to §4.

When you add a new screen: add it to §5 under the right phase, with layout intent.

When you make a design system change (new token, new convention): add to §2 and update CLAUDE.md to reflect.

When you resolve an open question: move it from §9 into the relevant section.
