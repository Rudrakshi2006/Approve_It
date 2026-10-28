# ApproveIt

Paperless, multi-step approvals with digital verification and live tracking, part of the **EkLink** suite (with TemplateOS and Attendie) for SIT Nagpur.

Students submit applications online (medical attendance consideration, hackathon approval, Re-CA, general). Authorities approve, reject, comment or send back for changes. The student sees where the application is at every moment.

> **Status:** prototype. Use **dummy data only** until the college approves handling real student data.

## Documentation

| File | Purpose |
|---|---|
| [`rules.md`](./rules.md) | Binding rules for developers and the AI agent. Read first. |
| [`planning.md`](./planning.md) | Scope, flows, data model, phases, open questions |
| [`tracker.md`](./tracker.md) | Progress, EkLink test results, decisions |
| [`docs/EkLink-Integration-ApproveIt.md`](./docs/EkLink-Integration-ApproveIt.md) | EkLink integration requirements |

## Features

- Four application types with **configurable approval chains**
- Class teacher chosen from a dropdown (all faculty from the database)
- Up to 10 attachments (PDF/JPG/PNG, 5 MB each) in a private bucket
- Approve / Reject / Hold-and-return with comments at every step
- Gmail-style single thread per application; student resubmits into the same thread
- **Digitally verified** stamp (name, time, unique ID) on every approval; optional signature image
- Live status and full history for the student; withdraw option
- Approver dashboards: Pending, Approved, Rejected, On hold
- In-app notifications (no email)
- Final PDF export (phase 5)

> The digital verification is an **internal electronic record, not a legal digital signature.**

## Approval chains

| Type | Chain |
|---|---|
| Medical | Student → Class teacher → HOD |
| Hackathon | Student → Admin (forward-only) → Hack-o-week incharge → HOD → Director |
| Re-CA | Student → Class teacher → HOD → Exam Dept |
| General | Student → Class teacher → HOD (default, configurable) |

## Tech stack

Next.js (App Router) + TypeScript · Supabase (own project) · `jose` · `zod` · `pdf-lib` · Vercel

## Sign in with EkLink

ApproveIt has **no login of its own**. Authentication is done by EkLink using a one-time-code flow:

1. The user opens ApproveIt (or clicks its card on the EkLink dashboard). With no valid session, `/auth/login` creates a random `state` (stored in an HttpOnly cookie) and redirects to `{EKLINK_URL}/authorize`.
2. EkLink logs the user in (if needed), checks the app, `redirect_uri` and role, and redirects back to `/auth/callback?code=…&state=…` with a 60-second single-use code.
3. The **server** checks `state`, exchanges the code at `{EKLINK_URL}/token` using the client secret, verifies the returned JWT against EkLink's JWKS (`ES256`, issuer, audience, expiry), and creates or updates the person by `sub`.
4. ApproveIt sets its own `HttpOnly` session cookie (max 8 hours).
5. Every ~15 minutes the server calls `/token/refresh`. If EkLink refuses (user deactivated, role removed, force logout), the session is destroyed.
6. Logout clears the cookie and sends the user to `{EKLINK_URL}/dashboard`.

Details and rules: `docs/EkLink-Integration-ApproveIt.md` and `rules.md`.

**Limitations to know:** Vercel preview deployments cannot sign in (callback URL must match exactly); logging out of EkLink ends the ApproveIt session within 15 minutes, not instantly.

## Local setup

**Requirements:** Node.js 20+, a Supabase project, an ApproveIt registration on EkLink (`client_id`, `client_secret`) with callback `http://localhost:3002/auth/callback`.

```bash
git clone <repo-url>
cd approveit
npm install
cp .env.example .env.local      # fill in values; never commit this file
npm run dev -- -p 3002
```

Open `http://localhost:3002`. You will be redirected to EkLink to sign in.

> Local development uses `Secure` cookies; use a browser that allows them on `localhost` (current Chrome/Edge/Firefox do).

### Environment variables (server-side only)

```env
EKLINK_URL=                  # EkLink base URL, no trailing slash
EKLINK_ISSUER=               # must equal the token `iss` (normally same as EKLINK_URL)
EKLINK_CLIENT_ID=            # given once by the EkLink admin
EKLINK_CLIENT_SECRET=        # given once; never prefix with NEXT_PUBLIC_
EKLINK_REDIRECT_URI=         # <APP_URL>/auth/callback (exact match with registry)

APP_URL=                     # this app's public URL
APP_SESSION_SECRET=          # openssl rand -base64 48

SUPABASE_URL=
SUPABASE_SECRET_KEY=         # service-role key, server only
```

No URL is hard-coded in the source. Moving to `*.eklink.clg.edu.in` is a configuration change only.

### Database

1. Run the SQL in `supabase/migrations/` (schema in `planning.md` §10). Row Level Security is enabled on every table with no policies; only the server uses the service key.
2. Create **private** Storage buckets for attachments and signatures.
3. Pre-seed `people` from the CSV the EkLink admin imported (`login_id, name, college_email, role, department`), so approvers and faculty exist before their first login.
4. Seed `application_types` (chains) and the initial `app_roles` / `approver_assignments`.

## Deployment

1. Deploy `main` to Vercel under the stable production URL.
2. Set all environment variables in Vercel (never in Git).
3. Make sure `EKLINK_REDIRECT_URI` equals the callback registered in EkLink exactly.
4. If the production URL changes, tell the EkLink admin; sign-in breaks until the registry is updated.

## Security summary

- Secrets only in server environment variables; nothing sensitive in the browser, logs or URLs
- State check, full JWT verification, 8-hour session cap, 15-minute refresh
- Authorisation re-checked on the server for every request
- RLS on every table; append-only approval history
- Security headers: `nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`, CSP

Found a leaked secret? Tell the EkLink admin immediately so it can be rotated.

## Contact

Registration, secrets, roles or EkLink behaviour: the EkLink admin / EkLink repo maintainers.
