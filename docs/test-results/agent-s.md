# Agent S — Functional test results

## Summary
- 4 journeys tested (J1, J2, J13, J16)
- 4 PASS / 0 FAIL / 0 PARTIAL (all primary acceptance criteria met)
- Top 3 findings:
  1. Zod validation errors return HTTP 422 and leak developer-style messages (e.g. `"mobile: Too small: expected string to have >=10 characters"`) — spec implied 400 + user-friendly text. (MEDIUM)
  2. `/api/student/branding` returns `primaryColor:"not-a-color"` for Sunrise — branding PUT endpoint accepts arbitrary strings for the color field with no validation. Would break the CSS variable injection downstream. (MEDIUM)
  3. JWT/`me` payload reports `role:"student"` for an org OWNER. Org context (`org.role`) is correct, but the top-level `role` is misleading and inconsistent with the admin login response (where `role:"admin"`). Could confuse client routing logic that gates on `role` alone. (LOW)

## Journey results

### J1 — Owner login + dashboard
**Status**: PASS
- Step 1 (`POST /api/auth/login`): 200, sets `tq_session` cookie, returns `{id:2010, role:"student", orgId:1, orgRole:"OWNER"}`
- Step 2 (`GET /api/auth/me`): 200, includes `org:{id:1, name:"Sunrise Coaching Centre", role:"OWNER"}`
- Step 3 (`GET /coaching/dashboard` HTML): 200, 68 KB, contains "Good afternoon" and "Sunrise" — no PrismaClient errors in the page body
- Step 4 (`GET /api/coaching/team`): 200, returns Demo Owner as OWNER + 3 pending invites
- Note: top-level `role` is `"student"` for an OWNER — see Finding 3.

### J2 — Mobile OTP login
**Status**: PASS (with minor wording/status nits)
- Happy path: OTP request → 200 + `audienceLabel:"Sunrise Coaching Centre"` + `devOtp`; verify → 200 + redirect `/coaching/dashboard`; subsequent `me` carries org context. All cookies set correctly.
- Edge — unknown mobile `0000000000`: 404 with exact expected wording.
- Edge — wrong code: 400 `"That code didn't match. Try again."` exactly as expected.
- Edge — short mobile `"123"`: HTTP **422** (not 400). Body `{"ok":false,"error":"mobile: Too small: expected string to have >=10 characters"}` — Zod default messaging, not user-friendly.

### J13 — Sales-led admin onboarding
**Status**: PASS
- Admin login (`role:"admin"`): 200
- `POST /api/admin/organizations`: 201 returning `{orgId:12, ownerUserId:2041, welcomeToken, welcomeUrl, emailDelivered:true}`
- `GET /api/coaching/welcome/[token]`: 200, returns invite `{name, email, orgName}`
- `POST /api/coaching/welcome/[token]` with `{password:"sales123"}`: 200, redirect `/coaching/setup`, JWT cookie set
- `GET /api/auth/me` as new owner: org context present, `role:"OWNER"`, `needsProfile:true`
- `GET /api/admin/organizations/12`: 200, `ownerHasPassword:true`, subscription TRIAL/Starter, sales fields persisted
- `POST .../resend-invite`: **409** `"Owner has already set their password."` — matches expected
- `PATCH .../organizations/12` with stage ACTIVE + notes: 200, persisted (re-fetched value confirmed)

### J16 — Student branding API
**Status**: PASS (with data-quality finding)
- Anonymous: `GET /api/student/branding` → 200 with `data:null` ✅
- As owner (demo-owner): 200 with `data:null` ✅ (owner not treated as student in white-label org)
- As real Sunrise student (Priya, student_id 2011, mobile 9000011111): 200 with full branding payload including `whiteLabelAllowed:true`, `isPro:false`, `displayName:"Sunrise Coaching Agent V"`.
  - **Observation**: returned `primaryColor:"not-a-color"` (invalid CSS value, persisted from earlier session). PUT endpoint is not validating color format.

## Findings (cross-journey)

### Finding 1: Zod validation returns HTTP 422 with developer-style messages
**Severity**: MEDIUM
**Journey + step**: J2 edge — bad mobile (also likely affects other endpoints using the shared Zod handler in `lib/api-utils.ts`)
**What I expected**: HTTP 400 with a short user-friendly message ("Enter a valid 10-digit mobile number.").
**What happened**: HTTP 422 with `"mobile: Too small: expected string to have >=10 characters"` — leaks the field name + raw Zod error.
**Reproduction**:
```
curl -s -X POST http://localhost:3000/api/coaching/login/otp \
  -H 'Content-Type: application/json' -d '{"mobile":"123"}'
# {"ok":false,"error":"mobile: Too small: expected string to have >=10 characters"} HTTP 422
```
**Suggested root cause**: Generic Zod error formatter in api-utils returning 422 and joining issue.path + issue.message. Spec / scenarios doc explicitly expects 400 with friendlier copy.

### Finding 2: `/api/student/branding` returns unvalidated color string
**Severity**: MEDIUM
**Journey + step**: J16 — student fetch
**What I expected**: `primaryColor` to be either null or a syntactically valid CSS color (hex/oklch/etc.).
**What happened**: For Sunrise (org 1) the API returned `primaryColor:"not-a-color"`. This will inject an invalid value into a CSS variable on the client, silently breaking themed components for that org's students.
**Reproduction**: Login as student 2011 via OTP → `GET /api/student/branding`.
**Suggested root cause**: The branding PUT handler (`/api/coaching/settings/branding` or equivalent) doesn't run a CSS color check on `primaryColor`/`secondaryColor`. Should reject obviously invalid strings or sanitize before persisting to `brandingJson`.

### Finding 3: Top-level `role` field misleadingly says "student" for org OWNER
**Severity**: LOW
**Journey + step**: J1 step 1 + J1 step 2
**What I expected**: A `role` consistent with the user's actual app role, or omit the field for users in an org (where `org.role` is the source of truth).
**What happened**: `/api/auth/login` for an OWNER returns `role:"student"` (because owner rows still live in the legacy `student` table). The admin login returns `role:"admin"`. Client routing that checks `role === "admin"` works, but code that gates on `role === "owner"` or similar would fail; the inconsistency is a footgun.
**Reproduction**:
```
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo-owner@testquest.local","password":"demo1234"}'
# role:"student", orgRole:"OWNER"
```
**Suggested root cause**: Login handler derives `role` from the source table (`student`) rather than from org membership. Either rename the field (e.g. `userType`) or surface `orgRole` consistently.

### Finding 4 (informational, not a bug): J16 step 2 spec phrasing slightly off
**Severity**: LOW / docs only
**Journey + step**: J16 step 2
**Observation**: Spec says "As owner: expect 200 with `data:null` (owner isn't a student in an org with white-label allowed)". This was satisfied, but is worth noting because the owner DOES have an org with white-label and the result depends on the owner being filtered out as non-student. If the handler logic ever changes to "any user with an org", this contract breaks. No action needed today.

## Cleanup
- Deleted org IDs: [12]
- Deleted student/user IDs: [2041]
- Verified: `tq_organizations.id=12` row count 0, `student.student_id=2041` row count 0
- Also deleted associated rows in: `tq_subscriptions`, `tq_org_memberships`, `tq_invite_tokens`, `tq_team_invites`
- Sunrise (org 1), Acme (org 7), and admin row left untouched
- Test scripts removed: no `prisma/migration/_test-S-*.ts` remain (verified)
