# Feature: Checkout, payments, coupons & bundles

> **What this file tells you:** how students pay for tests, how Razorpay is wired in, and which tables record money and access.

## What it does

Paid tests can be bought singly or as bundles (a discounted pack of tests). At checkout the student can apply a coupon code for a discount, then pays through Razorpay — India's card/UPI/netbanking gateway. The moment payment succeeds, the purchased tests unlock on the student's account and appear under "My purchases". Admins create the bundles and coupons in the admin panel and see all orders and revenue there.

## How it works

`POST /api/orders/create` writes a pending row to `tq_orders` and asks Razorpay to create a payment order; the browser then opens Razorpay's payment window. On success, the browser calls `POST /api/orders/verify`, which checks Razorpay's cryptographic signature (proof the payment is genuine), marks the order paid, records any coupon use in `tq_coupon_usages`, and grants access by writing rows to `tq_student_access`. Independently, Razorpay also calls our webhook (`/api/razorpay/webhook`) server-to-server — this is the safety net if the student closes the browser mid-payment. The webhook logs every event in `tq_webhook_events` so the same event is never processed twice (idempotency).

## Files to edit

| Layer | Files |
|---|---|
| Screens | [src/app/checkout/page.tsx](../../../src/app/checkout/page.tsx) · [src/app/checkout/success/page.tsx](../../../src/app/checkout/success/page.tsx) |
| API routes | [orders/create](../../../src/app/api/orders/create/route.ts) · [orders/verify](../../../src/app/api/orders/verify/route.ts) · [razorpay/webhook](../../../src/app/api/razorpay/webhook/route.ts) · [coupons/validate](../../../src/app/api/coupons/validate/route.ts) · [bundles/[id]](../../../src/app/api/bundles/%5Bid%5D/route.ts) |
| Logic | [src/lib/razorpay.ts](../../../src/lib/razorpay.ts) (client + signature checks) |
| Admin side | See [06-admin-panel.md](./06-admin-panel.md) for bundle/coupon/order management screens |

## Database tables used

All new `tq_*` tables (Prisma) — the mobile app knows nothing about payments:

| Table | Used for |
|---|---|
| `tq_orders` | One row per checkout: amount, status, Razorpay ids |
| `tq_coupons`, `tq_coupon_usages` | Coupon definitions and who used them |
| `tq_bundles`, `tq_bundle_tests` | Bundles and the tests inside each |
| `tq_student_access` | The unlock records — "student X may take test Y" |
| `tq_webhook_events` | Every Razorpay webhook received (idempotency log) |
| `tq_subscriptions` | Coaching-centre subscriptions (the webhook also handles these — see [07-coaching-b2b.md](./07-coaching-b2b.md)) |

## Watch out for

- **Razorpay is on TEST keys.** No real money moves until live keys are installed (env vars `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`) and the webhook URL is registered in the live Razorpay dashboard. See [12-known-gaps-and-risks.md](../12-known-gaps-and-risks.md).
- Never grant access without signature verification — both `verify` and the webhook check signatures; keep it that way.
- Access granting must stay idempotent: verify and the webhook can both fire for the same payment.
