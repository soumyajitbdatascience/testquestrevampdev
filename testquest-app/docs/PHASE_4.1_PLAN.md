> **STATUS: BUILT (test-mode pending credentials).** Migration 20 applied; all code landed; tsc + eslint clean; state machine + webhook idempotency verified against the DB via a throwaway (now removed). **Remaining before this is "done done":** (1) you add test `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET` to `.env`, (2) configure the Razorpay webhook URL + events in the dashboard, (3) run the live webhook replay in §6, (4) wire the billing-page "Subscribe / auto-renew" button to `POST /api/coaching/billing/subscribe`. See "Build status" at the bottom.

# Phase 4.1 — Razorpay Subscriptions (recurring) — Implementation Plan

**Task:** IMPLEMENTATION_PLAN.md §8, Task 4.1. Complexity L (~15h). The keystone of Phase 4 — 4.2 (seat proration), 4.3 (renewal/grace), 4.7 (dunning) all build on the state machine and webhook events landed here.

**Scope decision (this session):** Plan-first, then build the **full integration in test mode**. Credentials supplied by you.

**Locked decisions:**
- **All three cycles — Monthly, Quarterly, Annual — become recurring mandates.** The existing one-time `/coaching/billing/checkout` stays as a manual-pay fallback (e.g. for owners who decline auto-debit), but the default path for every cycle is now an auto-renewing Razorpay subscription. (This deviates from the original "annual stays one-time" note in the plan — superseded by your choice.)
- **Idempotency via a new `tq_webhook_events` table** (stores processed Razorpay event ids; reusable across all webhook types).

---

## 1. What already exists (reuse, don't rebuild)

| Piece | File | Reuse as |
|---|---|---|
| Razorpay SDK singleton | `src/lib/razorpay.ts` | add subscription helpers next to it |
| Webhook receiver + signature verify | `src/app/api/razorpay/webhook/route.ts` | extend with `subscription.*` events |
| One-time ORG_SUB checkout/verify | `src/app/api/coaching/billing/{checkout,verify}/route.ts` | sibling pattern for `subscribe` |
| State machine (TRIAL→GRACE→EXPIRED) | `src/lib/services/subscription.service.ts` | extend `activateSubscription`; add ACTIVE→GRACE on failed charge |
| Plans (Starter/Growth/Pro) | `tq_subscription_plans` | map each (plan × cycle) → a Razorpay plan_id |
| Order ledger | `tq_orders` (itemType ORG_SUB) | one row per recurring charge for audit |

`razorpay` npm pkg `^2.9.6` already installed. `.env` has empty `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET` — you'll fill the **test** values.

---

## 2. Razorpay Subscriptions model (how it maps to us)

Razorpay's recurring flow is: **Plan** → **Subscription** (the mandate) → **Invoices** auto-charged each cycle → **webhook events**.

```
Our SubscriptionPlan (Starter/Growth/Pro)
   × BillingCycle (MONTHLY | QUARTERLY | ANNUAL)
        → one Razorpay Plan (period=monthly int=1 / monthly int=3 / yearly int=1)  [created once, id cached]

Owner clicks "Subscribe monthly"
   → create Razorpay Subscription (mandate) against that plan
   → client opens Checkout with subscription_id → owner authorizes mandate
   → webhook subscription.authenticated / first charge → our sub goes ACTIVE
   → every cycle: subscription.charged → extend expiresAt + write an Order row
   → failed charge: subscription.pending → GRACE; subscription.halted → EXPIRED
   → owner/we cancel: subscription.cancelled → CANCELLED
```

Key difference from the one-time flow: **no client-side `verify` call is the source of truth** for recurring — the **webhook is authoritative**. The client authorize step just opens the mandate; activation/renewal is webhook-driven (idempotent).

---

## 3. Schema change (1 migration, tq_* only — never legacy)

**Confirmed against live DB:** `tq_subscriptions` has **no** Razorpay columns, and `billingCycle` enum is `('MONTHLY','ANNUAL')` — **no QUARTERLY**. Since 4.1 covers monthly+quarterly recurring, the migration must also extend that enum.

Add (raw `ALTER TABLE`, idempotent, per the repo's "no `prisma db push`" rule):

```
ALTER TABLE tq_subscriptions
  ADD COLUMN razorpayCustomerId      VARCHAR(64)  NULL,
  ADD COLUMN razorpaySubscriptionId  VARCHAR(64)  NULL,
  ADD COLUMN razorpayMeta            JSON         NULL;
ALTER TABLE tq_subscriptions ADD UNIQUE INDEX uniq_rzp_sub (razorpaySubscriptionId);
ALTER TABLE tq_subscriptions
  MODIFY COLUMN billingCycle ENUM('MONTHLY','QUARTERLY','ANNUAL') NOT NULL DEFAULT 'ANNUAL';

-- Idempotency ledger for ALL Razorpay webhook deliveries (reusable):
CREATE TABLE IF NOT EXISTS tq_webhook_events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  eventId     VARCHAR(64) NOT NULL,        -- x-razorpay-event-id
  eventType   VARCHAR(80) NOT NULL,
  receivedAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uniq_event (eventId)
);
```

(Matching `BillingCycle` enum in `schema.prisma` gets `QUARTERLY` added; new `WebhookEvent` model maps to `tq_webhook_events`.)

**Webhook idempotency mechanism:** at the top of the webhook handler, after signature verification, `INSERT IGNORE` (or catch the unique violation) the `eventId`. If the row already existed → return 200 immediately (already processed). This makes every event exactly-once regardless of Razorpay redelivery.

- `razorpaySubscriptionId` — indexed, the lookup key when a webhook arrives.
- `razorpayCustomerId` — saved customer for future mandates / seat add-ons (4.2).
- `razorpayMeta` — raw `{ short_url, status, plan_id, current_start, current_end, ... }` for debugging + replay.

For mapping **our plan×cycle → Razorpay plan_id**: store a small map in `SubscriptionPlan.featuresJson.razorpayPlanIds = { MONTHLY: "plan_x", QUARTERLY: "plan_y" }`, lazily created by `ensureRazorpayPlan()` on first subscribe. No new table needed. (Reversible; can promote to a column later.)

**Files:** `prisma/migration/20-add-subscription-razorpay.ts` (raw ALTER, idempotent guard like migration 14) + mirror the three fields into `schema.prisma` `Subscription` model, then `npx prisma generate` + **restart dev server**.

---

## 4. New / changed code

### 4a. `src/lib/razorpay.ts` (extend)
- `verifySubscriptionSignature(subscriptionId, paymentId, signature)` — HMAC of `payment_id|subscription_id` (Razorpay's documented order for subscription auth, distinct from the one-time `order_id|payment_id`).

### 4b. `src/lib/services/razorpay-subscription.service.ts` (NEW)
- `ensureRazorpayPlan(planId, cycle)` → returns a cached/created Razorpay plan_id; persists into `featuresJson`.
- `createSubscriptionMandate({ orgId, planId, cycle, seats })` → creates Razorpay customer (if absent) + subscription; writes `razorpayCustomerId/SubscriptionId/Meta`; returns `{ razorpaySubscriptionId, shortUrl, keyId }`.
- `cancelMandate(orgId, { atCycleEnd })` → `subscriptions.cancel`; on success set our status CANCELLED (or schedule).
- `findSubByRazorpayId(rzpSubId)` → webhook lookup helper.

### 4c. `src/lib/services/subscription.service.ts` (extend)
- `activateSubscription` → accept an explicit cycle/duration so a **recurring** charge extends by the cycle's days (monthly≈30 / quarterly≈90), not always `plan.durationDays`. Keep one-time callers working (default to plan.durationDays).
- `markChargeFailed(subId)` → ACTIVE→GRACE transition entry point for the webhook (feeds 4.3/4.7 dunning later).

### 4d. Routes (NEW, under `src/app/api/coaching/billing/`)
- `POST subscribe/route.ts` — OWNER/ADMIN; body `{ planId, cycle: "MONTHLY"|"QUARTERLY" }`; calls `createSubscriptionMandate`; returns `{ razorpaySubscriptionId, shortUrl, razorpayKeyId }` for Checkout. Guards: cycle must be monthly/quarterly (annual → 402 "use one-time checkout"); reject if an active mandate already exists.
- `GET subscription/route.ts` — current mandate status (merges our row + `razorpayMeta`).
- `DELETE subscription/route.ts` — cancel mandate (calls `cancelMandate`).

### 4e. `src/app/api/razorpay/webhook/route.ts` (extend) — **the core**
Add, alongside the existing `payment.captured`/`payment.failed`:

| Event | Action |
|---|---|
| `subscription.authenticated` | mark sub ACTIVE (mandate approved) |
| `subscription.charged` | `activateSubscription` (extend expiresAt by cycle) + insert an `Order` row (ledger) |
| `subscription.pending` | failed auto-charge → `markChargeFailed` → GRACE |
| `subscription.halted` | retries exhausted → EXPIRED |
| `subscription.cancelled` | → CANCELLED |

**Idempotency (critical — Razorpay redelivers):** guard each handler. Use `razorpay_event_id` (header `x-razorpay-event-id`) — store processed ids in a tiny `tq_webhook_events` table (or a `razorpayMeta.lastEventIds` set) and no-op on replay. For `subscription.charged`, also dedupe the Order ledger row by `razorpayPaymentId` unique check before insert.

---

## 5. State machine (after 4.1)

```
TRIAL ──pay one-time (annual)──────────────► ACTIVE  (existing)
TRIAL ──authorize mandate (monthly/qtr)────► ACTIVE  (new, via subscription.authenticated/charged)
ACTIVE ──subscription.charged──────────────► ACTIVE  (expiresAt += cycle)
ACTIVE ──subscription.pending (charge fail)► GRACE   (14-day window, 4.3/4.7 own retries)
GRACE  ──subscription.charged (recovered)──► ACTIVE
GRACE  ──subscription.halted────────────────► EXPIRED
any    ──subscription.cancelled────────────► CANCELLED
```

Existing time-based TRIAL/ACTIVE→GRACE→EXPIRED in `resolveSubscriptionState` stays; webhook transitions are event-driven and complementary. (Note: for mandate-backed ACTIVE subs we should NOT let the lazy time check force EXPIRED while Razorpay is still retrying — guard the lazy transition when `razorpaySubscriptionId` is set and status is ACTIVE/GRACE.)

---

## 6. Verification (test mode)

1. Fill `.env` with test `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`; restart dev.
2. `npx tsx prisma/migration/20-*.ts` → `npx prisma generate` → restart.
3. `POST /api/coaching/billing/subscribe {planId, cycle:"MONTHLY"}` as Sunrise owner → returns `shortUrl` + `razorpaySubscriptionId`; row gets the rzp ids.
4. Authorize via the returned short_url (Razorpay test card) OR simulate by **replaying signed webhook payloads** (`subscription.authenticated`, then `subscription.charged`) with a locally computed `x-razorpay-signature` → assert sub flips ACTIVE and `expiresAt` extends, and one Order ledger row appears.
5. Replay the SAME `subscription.charged` event id → assert **no** duplicate Order row, no double extension (idempotency).
6. Replay `subscription.pending` → GRACE; `subscription.halted` → EXPIRED; `subscription.cancelled` → CANCELLED.
7. `tsc --noEmit` + eslint clean on all touched files.

I'll write a throwaway `prisma/migration/_test-rzp-webhook.ts` that POSTs locally-signed payloads so we can verify the full state machine **without** waiting on real Razorpay charge cycles, then delete it.

---

## 7. Out of scope for 4.1 (explicitly deferred)
- Seat proration / "Add seats" → **4.2**
- Dunning emails/WhatsApp + retry schedule UI → **4.7** (4.1 only lands GRACE/EXPIRED transitions they hook into)
- Billing-page UI polish → minimal subscribe button wiring only; full UI later
- Live keys / production KYC → blocked on your Razorpay Subscriptions activation

---

## 8. Build order (tasks #6–#11 in the tracker)
1. Migration 20 + schema + generate (schema foundation)
2. `verifySubscriptionSignature` in `razorpay.ts`
3. `razorpay-subscription.service.ts`
4. `activateSubscription` recurring-cycle support + `markChargeFailed`
5. subscribe / subscription routes
6. webhook subscription events + idempotency
7. verify (migration run, webhook replay, tsc/eslint), then clean up throwaway

---

## Build status (this session)

**Shipped:**
- `prisma/migration/20-add-subscription-razorpay.ts` — applied. Added `tq_subscriptions.razorpayCustomerId / razorpaySubscriptionId / razorpayMeta`, `uniq_rzp_sub` index, `billingCycle` enum gained `QUARTERLY`, new `tq_webhook_events` idempotency table. Idempotent (safe to re-run).
- `schema.prisma` — Subscription model + `BillingCycle` enum + new `WebhookEvent` model. `prisma generate` run.
- `src/lib/razorpay.ts` — `verifySubscriptionSignature` (HMAC `payment_id|subscription_id`) + `safeEqualHex` helper.
- `src/lib/services/razorpay-subscription.service.ts` (NEW) — `ensureRazorpayPlan`, `createSubscriptionMandate`, `cancelMandate`, `findSubByRazorpayId`, `CYCLE_DAYS`, `RazorpaySubscriptionError`.
- `src/lib/services/subscription.service.ts` — `activateSubscription` now takes `extendByDays`; added `cycleToDays`, `markChargeFailed`, `setSubscriptionStatus`.
- `src/app/api/coaching/billing/subscribe/route.ts` (NEW) — POST create mandate.
- `src/app/api/coaching/billing/subscription/route.ts` (NEW) — GET status, DELETE cancel.
- `src/app/api/razorpay/webhook/route.ts` — event-id idempotency guard via `tq_webhook_events`; handlers for `subscription.authenticated/activated/charged/pending/halted/cancelled`; charged writes a deduped Order ledger row; existing `payment.captured`/`payment.failed` refactored + ORG_SUB one-time activation folded in.

**Verified:** `npx tsc --noEmit` clean · eslint clean on all 6 files · DB-level state-machine test (charge→ACTIVE +cycle days, pending→GRACE, halted→EXPIRED, cancelled→CANCELLED, terminal no-op, duplicate event-id → P2002) all passed; scratch rows cleaned up.

**NOT verified (needs your test credentials):** live Razorpay plan/customer/subscription creation, the Checkout authorize handshake, and real webhook delivery signatures. The `.env` Razorpay vars are still empty.

## Handoff for going live in test mode
1. Put test keys in `.env`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; restart `npm run dev`.
2. In Razorpay test dashboard: enable the **Subscriptions** product, add a webhook pointing at `<host>/api/razorpay/webhook` subscribed to `subscription.*` + `payment.captured` + `payment.failed`, using the same webhook secret.
3. `POST /api/coaching/billing/subscribe {planId:2, cycle:"MONTHLY"}` as a Sunrise owner → open the returned `shortUrl`, authorize with a Razorpay test card.
4. Watch the sub flip ACTIVE on `subscription.charged`; replay the same event id from the dashboard → confirm no duplicate Order row (idempotency).
5. Wire the `/coaching/billing` UI "Auto-renew / Subscribe" button to the subscribe endpoint (currently only the one-time checkout button exists).

## Deferred to later Phase-4 tickets (unchanged)
- 4.2 seat proration · 4.3 renewal/grace UX depth · 4.7 dunning notifications + retry schedule.
