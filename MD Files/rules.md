# ApproveIt: Rules & Regulations

**Audience:** the developer and the AI coding agent (Antigravity). Read this file fully before writing any code.
**Precedence:** EkLink's own `rules.md` > this file > `planning.md` > everything else.
`docs/EkLink-Integration-ApproveIt.md` is the EkLink integration spec; its **MUST** items are mirrored below. If anything here conflicts with it, stop and ask.

---

## 0. How to work (for Antigravity)

1. Read order at the start of every session: `rules.md` → `planning.md` → `tracker.md` → `docs/EkLink-Integration-ApproveIt.md`.
2. Work on **one task at a time**, taken from `tracker.md`. Do not start a later phase early.
3. After each finished task: tick it in `tracker.md`, add a one-line changelog entry. Never mark a task done if its tests were not run.
4. If a requirement is unclear, **ask**; do not guess and do not work around a rule.
5. Make small, reviewable commits. Message format: `feat|fix|chore|docs(scope): summary`.
6. Do not add dependencies without a reason written in the commit message. Approved base stack: Next.js (App Router), TypeScript, Supabase (`@supabase/supabase-js`), `jose`, `server-only`, `pdf-lib` (phase 5), `zod` for input validation.
7. Never "fix" a failing security check by weakening it.

## 1. Non-negotiables (MUST)

| # | Rule |
|---|---|
| N1 | **No local login.** No password field, signup page, credential table, hard-coded demo account or role switcher. Login = redirect to EkLink. |
| N2 | **Everything auth-related runs on the server** (redirect, callback, code exchange, refresh, JWT verification). The client secret never reaches the browser. |
| N3 | **`state`**: ≥32 random bytes, `HttpOnly; Secure; SameSite=Lax` cookie, ~10 min, constant-time comparison, deleted after use. Reject on mismatch or missing. |
| N4 | **Verify every EkLink token**: signature via JWKS (`jose` `createRemoteJWKSet`, `ES256` only), `iss == EKLINK_ISSUER`, `aud == EKLINK_CLIENT_ID`, `exp` in the future (≤10 s tolerance). Never hand-roll, never copy the public key into the repo. |
| N5 | **Map users by `sub`** (fallback `login_id`, then `email`, only to link a pre-seeded record). Never match by name. Refresh profile fields from the token on every sign-in and refresh. |
| N6 | **Own session cookie**: `HttpOnly; Secure; SameSite=Lax; Path=/`, absolute cap 8 hours. Nothing in `localStorage` / `sessionStorage`. |
| N7 | **Refresh** the EkLink token (server-side, `POST /token/refresh`) when within ~60 s of expiry. Any failure → destroy session → sign-in. |
| N8 | **Authorise on the server on every request.** The `role` claim only decides "may open the app". App permissions live in ApproveIt's own tables. Hiding a button is not security. |
| N9 | **Logout** = clear own cookie, then go to `{EKLINK_URL}/dashboard`. |
| N10 | **RLS enabled on every table.** Browser never receives a key that can read/write data. `SUPABASE_SECRET_KEY` lives only in server env. Never store passwords or hashes. |
| N11 | **Never log** tokens, codes, secrets, service keys or full cookies. No tokens in URLs. Never return the EkLink access token to the browser. |
| N12 | **Callback errors** show a simple error page with a "Back to EkLink" link. Never loop back to `/authorize`. |
| N13 | **No hard-coded URLs.** Every EkLink/app URL comes from an env variable. Moving to `*.eklink.clg.edu.in` must be a config-only change. |
| N14 | **Dummy data only** until the college approves handling real student data. |

## 2. Authorisation rules (ApproveIt-specific)

- **Current-approver check:** on every approve / reject / forward / return, the signed-in `login_id` must equal `applications.current_approver_login_id`, and the application must be `in_review`. Never accept `step`, `approver` or `login_id` from the browser.
- **Visibility:** an applicant sees only their own applications. An approver sees only applications currently or previously assigned to them. Admin screens check `app_roles` in the database.
- **Who may create applications:**
  - `student` for student types (`medical`, `hackathon`, `re_ca`, `general`).
  - `faculty` and `staff` for employee types (`employee_general`, `employee_leave`).
  - `hod` for HOD types (`hod_general`, `hod_leave`).
  - `director` can never create applications.
  - *Clarification:* Earlier notes listing "no faculty-leave features" meant *approver absence and delegation handling*; employee leave applications with a balance ledger are fully supported as of Phase 7.
- **Resolving approvers** happens on the server from ApproveIt's own data and the verified session, never from client input:
  - `class_teacher` → `applications.class_teacher_login_id` (chosen by the student; must exist in `people` with role `faculty`)
  - `hod` → person with EkLink role `hod` and the **same department** as the applicant
  - `director` → role `director`
  - `admin_staff`, `exam_cell` → `staff` with the matching `app_roles` entry
  - `hackathon_incharge` → row in `approver_assignments`
- **Hackathon admin step is forward-only:** it has no reject option. Enforce this on the server (`can_reject: false` in the workflow config), not only in the UI.
- **Hold ("returned")** is available at every approval step and requires a comment.
- **Withdraw** is allowed only for the applicant, only while `in_review` or `returned`, and is logged.
- **Urgent** is a flag that notifies and sorts. It never skips a step in code.

## 3. Data rules

- Approval chains are **configuration** (`application_types.chain`), not hard-coded `if` statements.
- `application_steps` is **append-only**. Never update or delete rows. Every action writes one row (submitted, resubmitted, approved, rejected, returned, forwarded, withdrawn).
- Snapshot the student's details (name, PRN, batch, semester, section, department) into the application at submit time. Later profile changes must not alter old applications.
- Attachments: max **10** per application, **PDF / JPG / PNG** only, **5 MB** each, validated on the server (extension, MIME type, size). Private bucket. Show files through short-lived signed URLs generated on the server. Never use original file names as storage paths; use generated ids.
- Signatures: private bucket, optional per user. Never public.
- Timestamps stored in UTC, displayed in IST.
- Semester is not in the EkLink token. It is derived from `batch` or confirmed by the student in their profile; never assume.

## 4. Digital verification wording and behaviour

- Every approver action carries a **"Digitally verified"** stamp. It is **compulsory** and cannot be skipped.
- The stamp contains: approver name, role/designation, date-time (IST), and a unique **verification ID**. A signature image is **optional** and is added to the stamp only if the approver has uploaded one.
- This is an **internal electronic record, not a legal digital signature (no certificate-based signing).** The UI, PDFs and docs must **never claim** otherwise. Do not use the words "legally valid", "certified" or "DSC".
- Verification IDs are random, unique and stored in `application_steps.verification_id`.

## 5. Security rules

- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` (or `X-Frame-Options: DENY`), plus a CSP suited to Next.js.
- Validate every request body and query with `zod`. Reject unknown fields.
- Redirect targets (`next=`) must start with `/`, must not start with `//` and must not contain `\`.
- Rate-limit login-related routes if possible (EkLink's limiter does not protect this app).
- `.env*` files are git-ignored from the first commit. If a secret is ever committed, rotate it and tell the EkLink admin.
- Never paste secrets into chat, issues, screenshots or the AI agent's prompt.
- No preview-deployment sign-in. Use the one stable production URL and `http://localhost:3002`.

## 6. UI / UX rules

- Student sees **live status** for every application: current step, who it is waiting on, full history with comments and stamps.
- Every step supports a comment. Reject and Hold require a comment.
- One **thread per application** (Gmail-style): comments, replies, attachment additions and returns all appear in one chronological log.
- Notifications are **in-app only** (notification tab with unread badge). No email, SMS or push.
- Student details are **auto-filled** from the profile; the student never types name, PRN, batch, semester or section into a form.
- Mobile-friendly layout. Plain language. Hindi/English mix is not required in the UI; use simple English.
- Every screen has loading, empty and error states.
- No faculty-leave or delegation features (explicitly out of scope).

## 6a. Code conventions

- TypeScript strict mode. No `any` without a comment.
- Folder layout follows `planning.md` §12.
- Files that touch secrets or the database import `"server-only"`.
- One responsibility per module. Business rules (who is the next approver, what a decision does) live in `src/lib/workflow/`, not in route handlers or components.
- Error responses: `401` not signed in, `403` signed in but not allowed, `404` not found or not visible to this user, `422` invalid input. Never leak internal errors or stack traces.
- Tests: unit tests for workflow resolution and state transitions are required. API tests for every permission rule in §2.

## 7. Forbidden

- Creating a login page, "demo mode", hard-coded accounts or a bypass flag, even for development.
- Using `NEXT_PUBLIC_` / `VITE_` for any secret.
- Using the Supabase service key or any data key in client code.
- Calling other apps (Attendie, TemplateOS) directly. No app-to-app auth exists yet; agree a contract with the EkLink team first.
- Storing the EkLink access token anywhere except the server-signed session cookie.
- Editing or deleting `application_steps` rows.
- Claiming legal validity for the digital verification.
- Using real student data.

## 8. Definition of done (per task)

1. Works on `localhost:3002` signed in through EkLink.
2. Permission rules in §2 are enforced on the server and covered by a test.
3. No secrets or tokens in code, logs, URLs, browser storage or network responses.
4. `tracker.md` updated.
5. No TODO that hides a security gap.
