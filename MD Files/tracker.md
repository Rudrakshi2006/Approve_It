# ApproveIt: Tracker

**How to use:** tick tasks as they are finished (`- [x]`), add a changelog line, and record EkLink test results in §3. Antigravity must update this file after every task (see `rules.md` §0).

**Current phase:** 1, Auth & people (code complete; awaiting developer manual testing)
**Overall status:** Phase 1 code and automated tests complete.
**Last updated:** 2026-10-28

---

## 1. Phase checklist

### Phase 0, Setup
- [x] Create repo; add `rules.md`, `planning.md`, `tracker.md`, `README.md`
- [x] Add `docs/EkLink-Integration-ApproveIt.md` to the repo (stored in `MD Files/`)
- [x] `.gitignore` covers `.env*` from the first commit
- [x] `.env.example` lists every variable (no values)
- [ ] Create Supabase project (RLS on for every table)
- [ ] Create Vercel project (one stable production URL)
- [ ] Send registration details to the EkLink admin (slug `approveit`, name, URL, callbacks, roles, icon `stamp`, description)
- [ ] Receive `client_id` and `client_secret`; store straight into Vercel env settings (never in chat or Git)
- [x] Set local dev port 3002 and local callback `http://localhost:3002/auth/callback`

### Phase 1, Auth & people
- [x] `src/lib/eklink.ts` (JWKS verify, code exchange, refresh)
- [x] `src/lib/session.ts` (own session cookie, 8 h cap)
- [x] `/auth/login` (state ≥32 bytes, cookie)
- [x] `/auth/callback` (state check, exchange, verify, upsert, session)
- [x] `/auth/refresh` (safe `next`, destroy session on failure)
- [x] `/auth/logout` (clear cookie, go to EkLink dashboard)
- [x] `/auth/error` page with "Back to EkLink" link
- [x] `proxy.ts` convenience redirect
- [x] `people` table + CSV import/pre-seed (faculty, staff, HOD, director, students)
- [x] `upsertPerson` links `sub` by `login_id`
- [x] Security headers (R14)
- [ ] EkLink tests 1–12 run (see §3)

### Phase 2, Medical flow end-to-end
- [ ] Migrations: `application_types`, `applications`, `application_steps`, `attachments`
- [ ] Seed `medical` chain (class teacher → HOD)
- [ ] Student dashboard with 4 tabs (Medical active)
- [ ] Medical form: class-teacher dropdown from `people` (faculty), attachments (≤10, PDF/JPG/PNG, 5 MB), comment, urgent
- [ ] Attachment upload to private bucket, server-side validation, signed URLs
- [ ] Applicant snapshot on submit
- [ ] Step engine: resolve approver, transitions, current-approver check
- [ ] Approver inbox: Pending / Approved / Rejected / On hold
- [ ] Review screen with approve / reject / return + comment
- [ ] Digital-verification stamp with unique ID (compulsory)
- [ ] Student live-status page with full history
- [ ] Unit tests: approver resolution and transitions
- [ ] API tests: unauthenticated `401`, wrong user `403`

### Phase 3, Thread, hold, withdraw, signature
- [ ] `application_messages` thread (single chronological log)
- [ ] Return (hold) → student edits and resubmits into the same application
- [ ] Withdraw (applicant only, while `in_review` or `returned`)
- [ ] Profile page: semester confirm, optional signature upload (private bucket)
- [ ] Stamp includes signature when present

### Phase 4, Other types
- [ ] Hackathon chain (admin forward-only → incharge → HOD → director)
- [ ] Server blocks reject on forward-only step
- [ ] Re-CA chain (class teacher → HOD → exam cell)
- [ ] General application chain
- [ ] `app_roles` + `approver_assignments` admin screens
- [ ] Urgent flag sorts queue and notifies

### Phase 5, Notifications & PDF
- [ ] `notifications` table + tab + unread badge
- [ ] Notifications fired for all events in `planning.md` §8
- [ ] Final PDF export (cover page, timeline, stamps, merged attachments, "internal record, not a legal digital signature" footer)
- [ ] Optional `/verify/<id>` page

### Phase 6, Hardening & go-live
- [ ] Permission tests for every rule in `rules.md` §2
- [ ] Search repo, browser DevTools (Application, Network) for secret, tokens, service key: none present
- [ ] README "Sign in with EkLink" section complete
- [ ] Final production URL and roles sent to the EkLink team
- [ ] EkLink admin switches ApproveIt to `live`
- [ ] No secrets in Git history (rotate if any)

---

## 2. Definition of done (EkLink spec §10)

- [ ] All MUST requirements implemented; tests 1–12 passed
- [ ] App registered in EkLink; status `live`
- [ ] No secrets in Git history
- [ ] `.env.example` lists every variable from the spec
- [ ] README has a "Sign in with EkLink" section
- [ ] Final production URL and roles told to the EkLink team

## 3. EkLink integration test results

Fill in with the EkLink admin. Result: `Pass` / `Fail` / `-` (not run).

| # | Test | Expected | Result | Date | Notes |
|---|---|---|---|---|---|
| 1 | Open app URL with no session | Redirected to EkLink; after login back inside the app | - | | Needs manual test with real EkLink login |
| 2 | Click app card on EkLink dashboard while logged in | Lands in app, no second login | - | | Needs manual test from EkLink dashboard |
| 3 | Callback with wrong/missing `state` | Rejected, no session | - | | Covered by unit tests in session-and-redirect.test.ts & callback-route.test.ts |
| 4 | Reuse the same `code` | `/token` rejects; app shows error | - | | Needs manual test with EkLink admin |
| 5 | Use an expired code (>60 s) | Rejected | - | | Needs manual test with EkLink admin |
| 6 | Tamper `redirect_uri` in `/authorize` | EkLink shows "Invalid redirect"; no code | - | | Needs manual test with EkLink admin |
| 7 | Sign in with a role not allowed | EkLink shows "No access" | - | | Covered by unit tests in callback-route.test.ts & auth-guards.test.ts |
| 8 | Expired token, other `aud`, unsigned/`HS256` token | All rejected | - | | Covered by unit tests in eklink-token.test.ts |
| 9 | Admin deactivates or force-logs-out user; wait for refresh | Session ends; user sent to sign-in | - | | Needs manual test with EkLink admin |
| 10 | API with no cookie; API with another role's cookie | `401` / `403` from server | - | | Covered by unit tests in auth-guards.test.ts |
| 11 | Search repo and browser for secret, tokens, service key | Not present | - | | Automated secret & diff scan clean |
| 12 | Logout | Cookie cleared; lands on EkLink dashboard; back button shows no private data | - | | Needs manual browser test with EkLink |

### ApproveIt-specific tests

| # | Test | Expected | Result |
|---|---|---|---|
| A1 | Student opens another student's application by id | `404` | - |
| A2 | Approver who is not the current approver tries to approve | `403` | - |
| A3 | Browser sends a forged `step` or `approver` | Ignored; server decides | - |
| A4 | Reject on hackathon admin step | Blocked on server | - |
| A5 | Reject / return without a comment | `422` | - |
| A6 | Upload 11th attachment, non-PDF/image file, file over 5 MB | Rejected | - |
| A7 | Edit/delete an `application_steps` row via any route | Not possible | - |
| A8 | Student edits application while `in_review` | Blocked | - |
| A9 | Student resubmits after return | Same application, same thread, back to same step | - |
| A10 | Withdraw after final approval | Blocked | - |
| A11 | Change profile data after submit | Old application snapshot unchanged | - |
| A12 | Stamp present on every approval; ID unique | Yes | - |

## 4. Decisions log

| Date | Decision |
|---|---|
| 2026-10-28 | Login only through EkLink; no ApproveIt login. |
| 2026-10-28 | ApproveIt keeps its own database; faculty list pre-seeded from the EkLink CSV into `people` (no common DB yet). |
| 2026-10-28 | Class teacher is chosen by the student from a dropdown of all faculty. |
| 2026-10-28 | Notifications are in-app only. |
| 2026-10-28 | "Digitally verified" stamp is compulsory; signature image is optional. Stamp is an internal record, not a legal digital signature. |
| 2026-10-28 | HOD signs personally every time; no separate HOD-office step in the chain. |
| 2026-10-28 | Hackathon admin step is forward-only (no reject). |
| 2026-10-28 | Hold = `returned`; student resubmits in the same application and thread. |
| 2026-10-28 | Applicant can withdraw while `in_review` or `returned`. |
| 2026-10-28 | No faculty-leave or delegation handling. |
| 2026-10-28 | Final PDF export built in phase 5. |
| 2026-10-28 | Stack: Next.js App Router, Supabase, `jose`. Built with Antigravity. |
| 2026-10-28 | Phases follow planning/tracker (Phase 0 to 6). |
| 2026-10-28 | Approval chains configured in `application_types.chain` (JSON); no separate workflows table. |
| 2026-10-28 | `exam_cell` added to `app_roles.app_role` alongside `admin_staff`, `workflow_admin`. |
| 2026-10-28 | General application chain = Class teacher → HOD (configurable data change). |
| 2026-10-28 | Up to 10 attachments for every application type (PDF/JPG/PNG, 5 MB each). |
| 2026-10-28 | Project documentation centralized in `MD Files/`. |
| 2026-10-28 | Installed Next.js version 16.4.3 (App Router, uses `proxy.ts`). |

## 5. Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | General application chain (default Class teacher → HOD) | Developer | Resolved (Class teacher → HOD, configurable) |
| 2 | Semester: derive from `batch` or student-confirmed? | Developer | Open |
| 3 | Hack-o-week incharge: global or per event? | Developer | Open |
| 4 | Who are Admin staff and Exam cell `login_id`s? | Developer / college | Open |
| 5 | Get the EkLink CSV (`login_id, name, college_email, role, department`) | EkLink admin | Open |
| 6 | Final production URL and role list | Developer / EkLink admin | Open |
| 7 | File limits (10 files decided; 5 MB, PDF/JPG/PNG to confirm with college) | Developer / college | Decided (10 files; limits to confirm) |
| 8 | HOD resolution when a department has none or several HODs | Developer | Open |

## 6. Changelog

| Date | Change |
|---|---|
| 2026-10-28 | Planning done. Created `rules.md`, `planning.md`, `tracker.md`, `README.md`. |
| 2026-10-28 | Phase 0 scaffold: Next.js 16.4.3, dependencies, .gitignore, .env.example, scripts, vitest config, smoke test, placeholder home page. |
| 2026-10-28 | Phase 1 auth & people: env validation, eklink JWKS client, 8h sessions, auth routes (/login, /callback, /refresh, /logout, /error), proxy.ts, auth guards, migration 0001, dummy CSV seed script, security headers, and 33 automated tests. |
