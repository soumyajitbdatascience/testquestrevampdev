# Feature: Notifications & the weekly-report job

> **What this file tells you:** how the app sends emails, SMS, and (eventually) WhatsApp messages, and how the automatic weekly parent-report job works.

## What it does

The platform reaches people outside the app in a few situations: password-reset emails, coaching-centre OTP codes, teacher invites, assignment reminder nudges ("you have a test due"), and weekly progress reports that parents receive about their child. Reports can be generated on demand by a teacher, and a scheduled job also sends them automatically every Sunday.

## How it works

[notifications.ts](../../../src/lib/notifications.ts) is the single door for outbound messages: given a recipient and message, it tries channels in order — WhatsApp first, then SMS, then email — falling through when a channel is unavailable. Today **WhatsApp is a stub** (the code path exists but no real provider is connected) and email via SMTP ([mail.ts](../../../src/lib/mail.ts), Nodemailer) is the workhorse; [sms.ts](../../../src/lib/sms.ts) handles OTP texts. Emails are branded with the coaching centre's logo/colours via [branding-for-email.ts](../../../src/lib/branding-for-email.ts). The weekly job is an HTTP endpoint, `GET /api/cron/weekly-reports`, protected by a secret header (`CRON_SECRET`); [vercel.json](../../../vercel.json) schedules it for Sundays 03:30 UTC **on Vercel only** — on the VPS it needs a crontab entry (see below). Each run is logged in `tq_weekly_report_runs` so a re-run never double-sends.

## Files to edit

| Layer | Files |
|---|---|
| Cron endpoint | [src/app/api/cron/weekly-reports/route.ts](../../../src/app/api/cron/weekly-reports/route.ts) |
| Job logic | [src/lib/services/weekly-report-cron.service.ts](../../../src/lib/services/weekly-report-cron.service.ts) · [parent-report.service.ts](../../../src/lib/services/parent-report.service.ts) · [bulk-reminder.service.ts](../../../src/lib/services/bulk-reminder.service.ts) |
| Channels | [src/lib/notifications.ts](../../../src/lib/notifications.ts) (orchestrator) · [mail.ts](../../../src/lib/mail.ts) / [email.ts](../../../src/lib/email.ts) (SMTP) · [sms.ts](../../../src/lib/sms.ts) · [whatsapp.ts](../../../src/lib/whatsapp.ts) (stub) |
| PDF layout | [src/lib/parent-report/report-doc.tsx](../../../src/lib/parent-report/report-doc.tsx) |
| Branding in emails | [src/lib/branding-for-email.ts](../../../src/lib/branding-for-email.ts) |

## Database tables used

| Table | Kind | Used for |
|---|---|---|
| `tq_weekly_report_runs` | New | One row per job run — the idempotency log |
| `tq_organizations`, `tq_batches`, `tq_batch_enrollments` | New | Who gets reports |
| `tq_assignments`, `tq_assignment_attempts` | New | What the reminders and reports say |
| `tq_otp_codes` | New | OTP codes sent by SMS/email |
| Legacy attempt tables (via services) | Legacy | The scores that go into parent reports |

The channels themselves (SMTP, SMS, WhatsApp) are external services configured by environment variables — see [08-environment-variables.md](../08-environment-variables.md).

## Watch out for

- **The vercel.json cron only fires if the app runs on Vercel.** Production runs on a VPS, so the weekly job must be triggered by a server crontab calling the endpoint with the `CRON_SECRET` header. Verify this exists on the server — flagged in [09-deployment-operations.md](../09-deployment-operations.md).
- To actually send WhatsApp messages, a provider (e.g. a WhatsApp Business API vendor) must be integrated in `whatsapp.ts` — currently it's a stub.
- Never call the channel files directly from features; go through `notifications.ts` so the fallback order stays in one place.
