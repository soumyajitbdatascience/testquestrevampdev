# Claude Design Brief — Testquest B2C Subscription Experience

**Version 1.2** *(v1.1: Board layer in hierarchy and onboarding; Board+Class pass paywall with 3/6/12-month prepaid duration cards — no auto-renew; multi-context toggle; expiry series replaces dunning. v1.2: locked-video placeholder rule; phase 2 enhances the existing Android app.)*

**Audience:** a Claude (design) session producing UI/UX for the Testquest B2C relaunch. The requirement lives in `docs/handover/b2c-enhancement-plan.md` — read §3 (student experience) and §10 (theme) first. Deliverables feed a developer handoff consumed by Claude Code, which builds exactly what is specified here.

## 1. Product context

Testquest (testquest.in) is test practice for Indian school students, Classes 6–12. Content hierarchy: **Board (CBSE/ICSE/State…) → Class → Subject → Chapter → Tests + Videos**. The sellable unit is a **Board+Class pass**: a one-time prepaid purchase (3, 6, or 12 months, admin-priced) unlocking every subject, chapter-wise test, and video in that class. One free sample test per subject. Students can hold multiple passes and toggle contexts. Mobile-first audience (baseline viewport 375×812 is the QA standard), price-sensitive, mid-range Android phones — light pages, obvious tap targets, no hover-dependent interactions. In phase 2 the existing Android app will be enhanced to mirror these patterns, so favour conventions that translate cleanly to native mobile.

**Existing stack you are designing for:** Next.js + Tailwind CSS v4 + shadcn/ui; light default + one-tap dark toggle; oklch tokens in a central globals file (`docs/handover/05-ui-theming.md`); existing student header, card language (rounded-[18px], accent top bars, `primary-dim` fills), display font for headings, subtle `DriftingFormulas` decor. Work **within** this system. Do not redesign coaching (B2B) surfaces. Admin screens have their own companion brief — [claude-admin-design-brief.md](./claude-admin-design-brief.md) — sharing this token system.

## 2. Design token system (confirmed with owner — apply everywhere)

| Token | Light | Role | Accessibility rule |
|---|---|---|---|
| primary | #6134EB | CTAs, active states, links | White text on it: 6.6:1 ✓ |
| primary-deep | #642CC8 | Hover/pressed, text links on white | 7.6:1 ✓ |
| ink | #140C3D | Headings, body | ~17:1 ✓ |
| accent | #815FE9 | Icons, large display text, charts | 4.4:1 — **large text/icons only, never body text on white** |
| lavender | #A790EA | Decorative, illustration, focus rings | 2.7:1 — **never text** |
| wash | #F4F0FE | Section bg, locked-card fills, `primary-dim` role | — |
| text-secondary | #4B426E | Secondary copy | ✓ |
| text-muted | #837CA3 | Captions, metadata | large/secondary only |
| border | #E6E1F5 | Hairlines, dividers | — |
| success #1B8A5A · warning #B45309 · error #D92D20 | | Semantic | all AA on white |

Dark mode: primary → #815FE9, backgrounds derived from the #140C3D indigo family, semantic hues perceptually matched. Deliver both modes for every screen. WCAG 2.1 AA minimum; touch targets ≥44px; visible focus states.

## 3. Scope A — new surfaces (in this order; every screen needs default, loading, empty, error, dark states)

1. **Onboarding (first login, full-screen):** pick board (admin-configured list) → pick class (6–12) → optional second class / skip. ~20 seconds. Also shown once to existing accounts with no context. Design the "edit contexts" re-entry from header and settings.
2. **Home with context toggle:** header switcher listing the student's board+class contexts (subscribed ones badged with validity, e.g. "CBSE · Class 10 — till 12 Jan"), plus "+ add class". Below, the active context's subject cards. Two context modes: **subscribed** — all subjects unlocked, each card showing progress (chapters attempted, next-test CTA); **unsubscribed** — each card offers *Try free* (sample CTA), with one persistent **class pass banner** (from-price teaser) rather than per-subject prices. Locked must never feel like a dead end — every lock is a doorway with a price on it.
3. **Subject page:** ordered chapter list, expandable; per chapter: tests (order, free/locked/done + last score) and videos (thumbnail, duration, lock); trailing "More tests" group for untagged content; sticky class-pass CTA while unsubscribed.
4. **Subscription sheet (the paywall — spend disproportionate care here):** bottom sheet on mobile / modal on desktop. Sells the whole **board+class**: three **duration cards** (3 / 6 / 12 months) with price, per-month math, and savings badge on longer terms (12-month visually pre-selected); included-content summary ("All N subjects · T chapter-wise tests · V video lessons"); the honesty line — **"One-time payment. Valid until [date]. No auto-renewal."**; single Razorpay pay button; trust row (secure payment, works on web today / app later).
5. **Post-payment success:** unlock moment for the *whole class* (celebratory but quick), return path to the exact item tapped.
6. **My subscriptions:** active passes with validity dates and a **Renew** CTA (copy: renewing extends from the current expiry — days are never lost); expired passes with renew prompts; payment history; grandfathered old purchases listed separately as "Your purchased tests".
7. **My progress** (per subject within the active context): score trend, chapter completion, weak chapters linking back into practice. Charts follow the token system (primary/accent family; sequential purples for intensity).
8. **Video experience:** embedded player (YouTube nocookie) within chapter context, up-next within chapter. **Locked state = a branded placeholder tile** (title, duration, lock icon on the wash fill) — never the YouTube thumbnail, whose URL exposes the video id to non-subscribers.
9. **Email templates (8):** verification, welcome, receipt, expiry reminder T-7, expiry reminder T-1, expired notice, post-expiry win-back (renew deep-link), unfinished-test nudge. One responsive HTML shell in brand; plain-text hierarchy first; all render acceptably in Gmail mobile. (No payment-failure/dunning email — prepaid model has no auto-charges.)

## 4. Scope B — polish pass on existing screens (after Scope A)

Dashboard, catalogue/test cards, exam screen chrome (not question mechanics), result/review screen, profile, retiring checkout remnants. Goal: consistency with the new token roles and the context toggle, not reinvention. Flag—don't fix—anything requiring backend change.

## 5. UX copy principles

Voice: encouraging coach, not exam gatekeeper — "Try your free Maths test" over "Free trial available". Prices in ₹, always plain; durations as "3 months / 6 months / 12 months" (never "quarterly/annual"). No dark patterns: the one-time, no-auto-renew nature is a selling point — say it. Locked-state copy sells content ("42 chapter-wise tests + 18 video lessons"), not restriction. Board/class/subject names match admin-entered names verbatim. English v1; avoid idioms that translate poorly later.

## 6. Deliverables expected from this design engagement

(1) User-flow diagrams: onboarding → sample → paywall → purchase → unlock; renewal via expiry series; add-context flow. (2) Screen designs for Scope A in light + dark at 375px and desktop. (3) A states matrix per screen (default/loading/empty/error/locked/subscribed/expired). (4) Token sheet as CSS variables extending the existing oklch globals. (5) Developer handoff specs — layout, spacing, component props against shadcn/ui, interaction and animation notes, responsive behaviour, edge cases — implementable by Claude Code without design judgment calls. (6) The 8 email templates as annotated HTML.

## 7. Constraints & cautions

No component libraries beyond shadcn/ui + Tailwind. No localStorage-dependent patterns in specs (server persistence exists for state like active context). Videos are standard YouTube embeds — no custom player chrome promises. The legacy mobile app is out of scope and will not match this design — never reference it in UI. Anything requiring legacy database changes is out of scope; chapters apply to tests only in v1. Multi-context UI must stay calm at 1 context (the common case) and scale to 4–5 without redesign.
