# Claude Design Brief — B2C Student Flow Consolidation & Add-Class

**Version 1.0 · Companion to the code fix brief.** The student app currently has **two navigation shells** (a legacy `Dashboard/Tests/History` header + `/tests` browse-all, and the new context-scoped `Home / My progress / My subscriptions` header). They must become **one**. The new shell is the keeper; this brief defines the unified IA and the one genuinely new screen — **add a class**. Stay in the existing purple token system.

## The single shell (adopt everywhere, retire the old)
Header, on every student page:
- **Left:** logo + **context switcher** — a dropdown showing every board+class the student has, the active one checked, and a persistent **＋ Add a class** row at the bottom.
- **Right:** **Home · My progress · My subscriptions**, theme toggle, avatar.
- **Remove** the legacy tabs (`Dashboard`, `Tests`, `History`) and the **"All tests"** cross-class tab entirely. There is no global browse — the class home *is* the browse.

## Screens & states

**Onboarding** (unchanged visually) — board → class (→ optional second). Shown **only** when the student has zero contexts. Never again after that.

**Home** = the active class. Subscribe banner (when unsubscribed) → subject cards → subject → chapters. Already built and good; it just needs to be the *only* landing and always in this shell.

**Context switcher (enhanced)** — opening it lists the student's classes (switch on click) and a **＋ Add a class** action.

**Add a class (NEW screen/flow)** — the key new design:
- Reuse the onboarding class-picker, but scoped: pick board (default the one they already use) → pick class → confirm.
- On add: write the new context, switch to it, land on that class's Home. If that class is unsubscribed, its Home shows the "Try free" samples + subscribe banner exactly like any other — so **adding a class immediately reveals its free tests and its own subscription offer** (this is what the user asked for).
- Empty/duplicate handling: a class they already have is disabled ("already added"); a board with no content is hidden (as onboarding already does).

**My progress** — absorb **History** here as a "Recent attempts" section (score, date, per attempt), plus the existing trend/weak-chapters. History as a separate top-level page goes away.

**My subscriptions** — unchanged; active passes per class + renew.

## Multi-class behaviour
- Each class is independent: its own subscribed/unsubscribed state, its own free samples, its own pass and paywall.
- Switching context re-scopes Home, progress, and subscriptions to that class.
- The subscribe banner and "Try free" only appear for the class the student is currently viewing.

## Principles
- **One shell, always** — the header must never change shape as the student navigates.
- **Never show another class's content** — scoping is the core promise.
- Adding a class is a positive, low-friction moment (more free tests to try), not a settings chore.
- Purple tokens, dark mode, AA, ≥44px, mobile-first.

## Out of scope
Attempt player, paywall sheet, receipt emails (all built and fine). This is navigation/IA + the add-class flow only.
