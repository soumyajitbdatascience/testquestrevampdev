# Feature: Student signup, login & password reset

> **What this file tells you:** how students create accounts and sign in, which files to edit to change any of it, and which database tables hold the data.

## What it does

A student creates an account with their name, email, password, and class (6–12), or signs in with one click using their Google account. Once signed in they stay signed in on that browser. If they forget their password, they enter their email, receive a reset link, and choose a new password. The same account works on the mobile app, because both apps read the same student records.

## How it works

Signup writes a new row to the legacy `student` table (shared with the mobile app), hashing the password with bcrypt (a one-way scrambler, so the real password is never stored). Login checks the email and password, then issues a JWT — a signed token proving who you are — stored in an httpOnly cookie (a cookie page JavaScript cannot read). Login also checks whether this email is an admin (`tq_admins`) or a coaching-centre member (`tq_org_memberships`) to decide which role to sign the token with. Google login verifies a Google-issued token instead of a password. Forgot-password saves a one-time token and expiry **on the student's own row** and emails a reset link; reset-password consumes that token and stores the new hash.

## Files to edit

| Layer | Files |
|---|---|
| Screens | [src/app/signup/page.tsx](../../../src/app/signup/page.tsx) · [src/app/login/page.tsx](../../../src/app/login/page.tsx) · [src/app/forgot-password/page.tsx](../../../src/app/forgot-password/page.tsx) · [src/app/reset-password/page.tsx](../../../src/app/reset-password/page.tsx) |
| API routes | `src/app/api/auth/` → [signup](../../../src/app/api/auth/signup/route.ts) · [login](../../../src/app/api/auth/login/route.ts) · [google](../../../src/app/api/auth/google/route.ts) · [logout](../../../src/app/api/auth/logout/route.ts) · [me](../../../src/app/api/auth/me/route.ts) · [forgot-password](../../../src/app/api/auth/forgot-password/route.ts) · [reset-password](../../../src/app/api/auth/reset-password/route.ts) |
| Logic | [src/lib/legacy-students.ts](../../../src/lib/legacy-students.ts) (find/create/update student, reset tokens) · [src/lib/auth.ts](../../../src/lib/auth.ts) (hashing, JWT, sessions) · [src/lib/mail.ts](../../../src/lib/mail.ts) (reset email) |
| Route guard | [src/middleware.ts](../../../src/middleware.ts) (redirects logged-out visitors) |

## Database tables used

| Table | Kind | Used for |
|---|---|---|
| `student` | Legacy (shared with mobile) | The account itself — read on login, inserted on signup, updated on profile/password changes. Reset token + expiry are columns on this table. |
| `vw_students` | View | Clean read-only window onto `student` |
| Legacy class table (via view) | Legacy | Validating the chosen class at signup |
| `tq_admins` | New (Prisma) | Checked at login to see if the email is a platform admin |
| `tq_org_memberships` | New (Prisma) | Checked at login to see if the email belongs to a coaching centre |

## Watch out for

- **`tq_password_reset_tokens` exists in [prisma/schema.prisma](../../../prisma/schema.prisma) but is NOT used.** The real reset flow uses token columns on the legacy `student` table. Don't be misled by the unused model.
- **Never read `student.encrypt_password`** — some old rows hold plain-text passwords in that column. The app only uses the bcrypt-hashed column.
- `JWT_SECRET` signs every session. Rotating it logs everyone out (see [10-accounts-checklist.md](../10-accounts-checklist.md)).
- Google login needs `GOOGLE_CLIENT_ID` to match the Google Cloud OAuth client.
