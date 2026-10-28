# ApproveIt × EkLink: Integration Requirements

**For:** the ApproveIt development team
**Status:** every **MUST** in this file is required before ApproveIt is switched to `live` on the EkLink dashboard.
**Companion docs (EkLink repo, `md/`):** `architecture.md` §5.3–5.5, `integration-guide.md`, `rules.md`. This file is the ApproveIt-specific version of them. If this file and EkLink's `rules.md` ever disagree, `rules.md` wins.

---

## 1. Context for the prototype

| Fact | Consequence for you |
|---|---|
| Every app has its **own database** (its own Supabase project). | EkLink never gives you DB access and you never touch EkLink's DB. You only receive an identity token. |
| Every app is hosted on a **different Vercel account**, on `*.vercel.app`. There is no college domain yet. | Apps are on different origins. Cookies cannot be shared. Sign-in works **only** through the one-time-code flow below. |
| The college domain (`eklink.clg.edu.in`, `<app>.eklink.clg.edu.in`) will come later. | **No URL may be hard-coded.** Every URL lives in an environment variable. Moving to the domain must be a config change only. |
| Free tiers everywhere (Supabase, Vercel). | Prototype must still follow the security rules. Use **dummy data only** until the college approves handling real student data. |

## 2. What EkLink does and does not do

EkLink answers one question: **who is this person, what is their base role, and may they enter this app.**

| EkLink provides | ApproveIt must handle itself |
|---|---|
| Login (PRN or college email + password), password reset, force logout | Everything that happens after sign-in |
| Base role: `student`, `faculty`, `staff`, `hod`, `director`, `finance`, `admin` | App-specific permissions and relations (for example "event organiser", "approver for this event") |
| A signed identity token (ES256 JWT, 15 min) | Its own session, its own users table, its own data |
| The app card on the dashboard, role-filtered | The app's own pages, API and database |

ApproveIt **must not** keep its own passwords, signup page or credential table once integrated.

## 3. Registration (send this to the EkLink admin)

The EkLink admin registers the app with `scripts/register-app.mjs` and gives you the `client_id` and `client_secret`. **The secret is shown only once**, so store it straight into Vercel's environment settings.

| Field | Value for ApproveIt |
|---|---|
| slug | `approveit` |
| name | ApproveIt |
| url (dashboard card link) | your production URL, e.g. `https://approveit-xyz.vercel.app` |
| callback URL (production) | `/auth/callback` appended to your production URL |
| callback URL (local) | `http://localhost:3002/auth/callback` |
| allowed roles (proposed, confirm with EkLink team) | `student, faculty, staff, hod, director, admin` (`finance` not needed) |
| icon | `stamp` |
| description | Paperless multi-step approvals with e-sign and tracking. |

Important points about callbacks:

- EkLink does an **exact string match** on `redirect_uri`. No wildcards, no trailing-slash tolerance, no query strings.
- **Vercel preview deployments get a new URL every time, so they cannot sign in.** Use one stable production URL (and localhost). If you need a staging site, give it a fixed alias and ask the EkLink admin to register that callback too.
- If your production URL changes, tell the EkLink admin. Login breaks until the registry is updated.

## 4. Environment variables (server-side only)

```env
# Public base URL of EkLink (given by the EkLink team). No trailing slash.
EKLINK_URL=https://<eklink-deployment>.vercel.app
# Must equal the `iss` claim exactly. Normally identical to EKLINK_URL.
EKLINK_ISSUER=https://<eklink-deployment>.vercel.app
EKLINK_CLIENT_ID=<given once by EkLink admin>
EKLINK_CLIENT_SECRET=<given once by EkLink admin>
EKLINK_REDIRECT_URI=https://approveit-xyz.vercel.app/auth/callback

# This app's own public URL. Use it to build redirects; never trust the Host header.
APP_URL=https://approveit-xyz.vercel.app
# Long random string (>= 32 bytes) used to sign THIS app's own session cookie.
APP_SESSION_SECRET=<openssl rand -base64 48>
```

Rules for these variables:

- Never prefix the secret with `NEXT_PUBLIC_` or `VITE_`. Those are shipped to the browser.
- `.env*` files are in `.gitignore` from the first commit. Local, preview and production use different values.
- If the secret ever leaks, tell the EkLink admin immediately so they can rotate it (`--rotate-secret`).

## 5. How sign-in works

```
User clicks the card on EkLink dashboard  (or opens your app URL directly)
  │
  ▼
ApproveIt: no valid session
  │  generate random `state`, store in HttpOnly cookie
  ▼
302  {EKLINK_URL}/authorize?client_id=…&redirect_uri=…&state=…
  │  EkLink: not logged in → login page → back here.  Logged in → continues
  │  EkLink checks: client exists + app live, redirect_uri exact match,
  │                 user active, role allowed, then issues a 60 s single-use code
  ▼
302  {EKLINK_REDIRECT_URI}?code=…&state=…
  │
  ▼
ApproveIt SERVER (never the browser):
  1. state in URL == state in cookie            else reject
  2. POST {EKLINK_URL}/token  {grant_type, code, redirect_uri, client_id, client_secret}
  3. verify returned JWT with EkLink's public keys (JWKS)
  4. find or create the local user by `sub`
  5. create ApproveIt's own session cookie, redirect into the app
```

EkLink endpoints you use:

| Endpoint | Used for |
|---|---|
| `GET  /authorize?client_id&redirect_uri&state` | Browser redirect to start sign-in |
| `POST /token` | Server-to-server exchange of the one-time code (JSON body) |
| `POST /token/refresh` | Server-to-server re-check and new token (JSON body: `client_id`, `client_secret`, `access_token`) |
| `GET  /.well-known/jwks.json` | Public keys for verifying tokens |

Token response: `{ "access_token": "<JWT>", "token_type": "Bearer", "expires_in": 900 }`.

## 6. Token claims

| Claim | Meaning | Notes |
|---|---|---|
| `iss` | EkLink URL | must equal `EKLINK_ISSUER` |
| `aud` | your `client_id` | must equal `EKLINK_CLIENT_ID` |
| `sub` | EkLink user UUID | **the primary key for mapping users** |
| `login_id` | PRN (students) or staff ID | permanent and unique; fallback key |
| `email` | college email | can change; do not use as the primary key |
| `name` | full name | |
| `role` | base role | coarse access only |
| `department` | department or `null` | |
| `batch` | e.g. `2023-27` or `null` | students |
| `section` | single letter or `null` | students |
| `ver` | token version | used by EkLink for force logout |
| `iat`, `exp` | issued / expiry | expires in 15 minutes |

There is no semester claim. If you need it, derive it from `batch` or keep it in your own data.

---

## 7. Requirements (all apps)

### R1. Remove local credentials (MUST)
No password fields, no signup page, no credential table, no hard-coded demo accounts, no "role switcher". Login = redirect to EkLink.

### R2. Secret handling and server-side exchange (MUST)
Redirect, callback, code exchange, refresh and JWT verification all run on **your server** (API route, serverless function or backend). A purely browser-side SPA cannot hold a client secret, so it **must** have a server part.

### R3. `state` (MUST)
Generate at least 32 random bytes per login attempt. Store it in an `HttpOnly; Secure; SameSite=Lax` cookie that lives about 10 minutes. On callback compare it with a constant-time comparison, then delete the cookie. Reject on any mismatch or missing value.

### R4. Verify the token fully (MUST)
Verify on the server, for every token you accept:

- signature using EkLink's JWKS (`ES256` only; do not accept `none` or `HS256`)
- `iss` equals `EKLINK_ISSUER`
- `aud` equals `EKLINK_CLIENT_ID`
- `exp` is in the future (small clock tolerance of about 10 seconds is fine)

Use a JWKS library (`jose` `createRemoteJWKSet`, PyJWT `PyJWKClient`). Do not hand-roll signature checks. Do not copy the public key into your repo, because keys will rotate.

### R5. Map users by `sub` (MUST)
On first sign-in create the local user; on later sign-ins update it. Lookup order: `sub`, then `login_id`, then `email` (the fallbacks exist only to link a pre-seeded record to its `sub` the first time). **Never** match by name. Refresh `name`, `email`, `role`, `department`, `batch`, `section` from the token on every sign-in and refresh.

If people must exist in your app before they have ever logged in (for example approvers, faculty lists, organisers), **pre-seed them from the same CSV that the EkLink admin imported** (`login_id, name, college_email, role, department`) and let the first sign-in attach `sub`. Do not rely on "who has logged in so far".

### R6. Your own session (MUST)
- Cookie: `HttpOnly; Secure; SameSite=Lax; Path=/`. Never put tokens or user objects in `localStorage` or `sessionStorage`.
- Contents: your own signed JWT or opaque session id. It may carry the EkLink access token (needed for refresh) and `tok_exp`.
- Two clocks: the EkLink token lives 15 minutes (identity freshness); your session cookie has an absolute cap of **8 hours**.

### R7. Refresh every 15 minutes (MUST)
When the EkLink token is within about 60 seconds of expiry, call `POST /token/refresh` from the server.

- Success: store the new token, update role and profile fields from it.
- Any failure (`400`, `401`, `403`): destroy the session and send the user to sign-in. This is how deactivation, role removal and admin force-logout take effect.

Cookies can only be written in route handlers / API functions / middleware, not while rendering pages. Do the refresh there.

### R8. Authorisation on the server for every request (MUST)
Use the `role` claim only for coarse access ("may this person open the app"). App-specific permissions (organiser, approver, template admin, room allocator) live in **your** database, keyed by `login_id` (or `sub`), and are checked in your **server** code on every API call. Hiding a button is not security.

### R9. Logout (MUST)
Clear your session cookie, then send the user to `{EKLINK_URL}/dashboard`. Do not try to log the user out of EkLink from your server.

### R10. Your database (MUST)
- Your own Supabase project. Row Level Security **enabled on every table**.
- The browser never gets a key that can read or write your data. The `SUPABASE_SECRET_KEY` (service-role key) lives only in server environment variables.
- Do not duplicate what EkLink owns: no passwords, no password hashes.

### R11. Never log secrets (MUST)
No `console.log` of tokens, codes, secrets or full cookies, even temporarily. Do not put tokens in URLs. Do not return the EkLink access token to the browser.

### R12. Error handling (MUST)
Callback failure (bad state, rejected code, bad token, `access_denied`) shows a simple error page with a "Back to EkLink" link. It must not loop endlessly back to `/authorize`.

### R13. Config, not code (MUST)
All EkLink and app URLs come from environment variables. Switching to `*.eklink.clg.edu.in` must not require a code change.

### R14. Security headers (SHOULD)
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` (or `X-Frame-Options: DENY`), and a CSP appropriate for your framework.


---

## 8. ApproveIt-specific implementation

ApproveIt is in the planning stage, so integrate EkLink **from the first commit**. Do not build a login system at all.

### 8.1 Design decisions you must make with EkLink in mind

| Topic | Requirement |
|---|---|
| Person records | Create a `people` table keyed by `login_id` (unique) with nullable `eklink_sub`, `name`, `email`, `eklink_role`, `department`, `batch`, `section`. **Pre-seed it from the EkLink CSV** so approvers exist before they first log in (R5). |
| Approval chain | Store the chain as **configuration** (a `workflows` table / JSON), for example `faculty_incharge → admin_staff → hod → director`. The chain is not hard-coded, so SlotIt and others can reuse it. |
| Who approves a step | Resolve from your own data, not from EkLink. "Faculty incharge of this event" is an `approver_assignments` row (application type + event/club → `login_id`). "HOD" is the person with EkLink role `hod` and the same `department` as the applicant. "Director" is role `director`. "Admin staff" is `staff` with an `app_roles` entry. |
| Application types | Medical leave, hackathon / event participation, etc. Each type is a row (name, form fields, chain, attendance rule). |
| Attendance check | A step may require verifying attendance (threshold, HOD may override with a reason). In the prototype let the admin-staff step enter or confirm the percentage manually. Automatic retrieval from Attendie needs the app-to-app contract (section 11). |
| E-signature | Authorities "sign" inside the app (drawn or uploaded signature image, plus timestamp and `login_id`). This is an **internal record, not a legal digital signature**, and the UI must not claim otherwise. Store signature images in your own Supabase Storage, private bucket. |
| Tracking | Every application keeps a step history: who acted, when, what decision, comment. Append-only. The student can see where it is stuck. |
| Urgent cases | Model "urgent" as a flag that notifies the next approver and sorts the queue. Do not skip steps in code. Skipping is a configured workflow, approved by the college. |

### 8.2 Suggested tables (all with RLS enabled, no policies; server uses `SUPABASE_SECRET_KEY`)

```sql
create table people (
  login_id    text primary key,
  eklink_sub  uuid unique,
  name text not null, email text not null,
  eklink_role text not null, department text, batch text, section text,
  updated_at  timestamptz not null default now()
);

create table app_roles (                       -- ApproveIt-only designations
  login_id text not null references people(login_id),
  app_role text not null check (app_role in ('admin_staff','workflow_admin')),
  primary key (login_id, app_role)
);

create table approver_assignments (
  id bigint generated always as identity primary key,
  application_type text not null,
  scope_key text,                              -- e.g. event or club id; null = default
  step_key text not null,                      -- e.g. 'faculty_incharge'
  approver_login_id text not null references people(login_id)
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  applicant_login_id text not null references people(login_id),
  payload jsonb not null,
  status text not null check (status in ('draft','in_review','approved','rejected','returned','cancelled')),
  current_step int not null default 0,
  urgent boolean not null default false,
  created_at timestamptz not null default now()
);

create table application_steps (               -- append-only history
  id bigint generated always as identity primary key,
  application_id uuid not null references applications(id),
  step_index int not null, step_key text not null,
  actor_login_id text not null,
  decision text not null check (decision in ('approved','rejected','returned','forwarded')),
  comment text, signature_path text,
  at timestamptz not null default now()
);
```

### 8.3 Server rules that matter most for this app

- The **current approver check** happens on the server for every approve/reject: the signed-in `login_id` must equal the resolved approver of `applications.current_step`. Never trust a `step` or `approver` sent by the browser.
- Applicants can read only their own applications. Approvers can read only applications currently or previously assigned to them. Admin roles are checked against your own tables.
- Role `student` may create applications. Roles `faculty`, `staff`, `hod`, `director` may also create their own (for example faculty leave) if you add those types.
- Write one `application_steps` row for every action (including "viewed" if you need it). Never update or delete history rows.

`src/lib/people.ts`

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { EklinkClaims } from "./eklink";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

export async function upsertPerson(c: EklinkClaims) {
  // Match a pre-seeded record by login_id and attach `sub`; otherwise create it.
  const { error } = await db.from("people").upsert({
    login_id: c.login_id, eklink_sub: c.sub, name: c.name, email: c.email,
    eklink_role: c.role, department: c.department, batch: c.batch, section: c.section,
    updated_at: new Date().toISOString(),
  }, { onConflict: "login_id" });
  if (error) throw new Error("person_upsert_failed");
}
```

### 8.4 Reference implementation (Next.js App Router + Supabase)

Recommended stack for new EkLink apps: **Next.js (App Router) + Supabase**, the same as EkLink, so the team can help each other and reuse these files unchanged. `jose` is the only extra auth dependency.

```text
npm i jose @supabase/supabase-js server-only
```

Extra environment variables:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=<server only>
# Only if you also use Supabase from the browser (not needed for auth):
# NEXT_PUBLIC_SUPABASE_URL=...  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   (RLS must still be on)
```

`src/lib/eklink.ts`

```ts
import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type EklinkClaims = {
  sub: string; login_id: string; email: string; name: string; role: string;
  department: string | null; batch: string | null; section: string | null; ver: number; exp: number;
};

const jwks = createRemoteJWKSet(new URL(`${process.env.EKLINK_URL}/.well-known/jwks.json`));

export async function verifyEklinkToken(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: process.env.EKLINK_ISSUER!,
    audience: process.env.EKLINK_CLIENT_ID!,
    algorithms: ["ES256"],
    clockTolerance: 10,
  });
  return payload as unknown as EklinkClaims;
}

export async function exchangeCode(code: string) {
  const r = await fetch(`${process.env.EKLINK_URL}/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code", code,
      redirect_uri: process.env.EKLINK_REDIRECT_URI,
      client_id: process.env.EKLINK_CLIENT_ID,
      client_secret: process.env.EKLINK_CLIENT_SECRET,
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("code_exchange_failed");
  return (await r.json()).access_token as string;
}

export async function refreshEklinkToken(oldToken: string) {
  const r = await fetch(`${process.env.EKLINK_URL}/token/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.EKLINK_CLIENT_ID,
      client_secret: process.env.EKLINK_CLIENT_SECRET,
      access_token: oldToken,
    }),
    cache: "no-store",
  });
  return r.ok ? ((await r.json()).access_token as string) : null;
}
```

`src/lib/session.ts`

```ts
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.APP_SESSION_SECRET!);
export const SESSION_COOKIE = "approveit_session";
export const SESSION_MAX_AGE = 8 * 3600;

export type Session = {
  sub: string; login_id: string; name: string; email: string;
  eklink_role: string; department: string | null; batch: string | null; section: string | null;
  tok: string; tok_exp: number; exp: number;
};

export const cookieOpts = (maxAge: number) =>
  ({ httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge });

export async function signSession(s: Session) {
  return new SignJWT(s as unknown as Record<string, unknown>).setProtectedHeader({ alg: "HS256" }).sign(secret);
}

export async function readSession(raw?: string): Promise<Session | null> {
  if (!raw) return null;
  try { return (await jwtVerify(raw, secret, { algorithms: ["HS256"] })).payload as unknown as Session; }
  catch { return null; }
}

/** Read-only helper for Server Components and Route Handlers. It cannot refresh (cookies are read-only
 *  while rendering). Returns null when the EkLink token needs a refresh; send the user to /auth/refresh. */
export async function getSession(): Promise<Session | null> {
  const s = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  if (s.tok_exp <= Math.floor(Date.now() / 1000)) return null;
  return s;
}
```

`src/app/auth/login/route.ts`

```ts
import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  const state = randomBytes(32).toString("base64url");
  const url = new URL("/authorize", process.env.EKLINK_URL);
  url.searchParams.set("client_id", process.env.EKLINK_CLIENT_ID!);
  url.searchParams.set("redirect_uri", process.env.EKLINK_REDIRECT_URI!);
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set("eklink_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/auth", maxAge: 600 });
  return res;
}
```

`src/app/auth/callback/route.ts`

```ts
import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { exchangeCode, verifyEklinkToken } from "@/lib/eklink";
import { SESSION_COOKIE, SESSION_MAX_AGE, cookieOpts, signSession } from "@/lib/session";
import { upsertPerson } from "@/lib/people";            // your own DB code (see `people.ts` in this section)

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const to = (path: string) => NextResponse.redirect(new URL(path, process.env.APP_URL));

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const saved = request.cookies.get("eklink_state")?.value;

  let res = to("/auth/error?e=state");
  if (code && state && saved && same(state, saved)) {
    try {
      const token = await exchangeCode(code);
      const c = await verifyEklinkToken(token);
      await upsertPerson(c);
      const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
      const jwt = await signSession({
        sub: c.sub, login_id: c.login_id, name: c.name, email: c.email, eklink_role: c.role,
        department: c.department, batch: c.batch, section: c.section, tok: token, tok_exp: c.exp, exp,
      });
      res = to("/");
      res.cookies.set(SESSION_COOKIE, jwt, cookieOpts(SESSION_MAX_AGE));
    } catch {
      res = to("/auth/error?e=signin");
    }
  }
  res.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
  return res;
}
```

`src/app/auth/refresh/route.ts` (refresh must happen where cookies can be written)

```ts
import { type NextRequest, NextResponse } from "next/server";
import { refreshEklinkToken, verifyEklinkToken } from "@/lib/eklink";
import { SESSION_COOKIE, cookieOpts, readSession, signSession } from "@/lib/session";
import { upsertPerson } from "@/lib/people";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
  const s = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const fail = () => {
    const r = NextResponse.redirect(new URL("/auth/login", process.env.APP_URL));
    r.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return r;
  };
  if (!s) return fail();
  const fresh = await refreshEklinkToken(s.tok);
  if (!fresh) return fail();                               // deactivated / role removed / force logout
  const c = await verifyEklinkToken(fresh);
  await upsertPerson(c);
  const jwt = await signSession({ ...s, tok: fresh, tok_exp: c.exp, eklink_role: c.role, name: c.name,
    email: c.email, department: c.department, batch: c.batch, section: c.section });
  const res = NextResponse.redirect(new URL(safeNext, process.env.APP_URL));
  res.cookies.set(SESSION_COOKIE, jwt, cookieOpts(Math.max(s.exp - Math.floor(Date.now() / 1000), 1)));
  return res;
}
```

`src/app/auth/logout/route.ts`

```ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;                                   // client then goes to `${EKLINK_URL}/dashboard`
}
```

`src/proxy.ts` (called `middleware.ts` before Next 16). This is only a convenience redirect. **Real checks happen again in your server code.**

```ts
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/auth", "/_next", "/favicon.ico"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (!request.cookies.get("approveit_session")) return NextResponse.redirect(new URL("/auth/login", request.url));
  return NextResponse.next();
}
```

Where the token is close to expiring, let the page's data layer redirect to `/auth/refresh?next=<current path>` when `getSession()` returns `null` but the session cookie still exists. For `fetch` calls from client code, return `401` and let the client navigate to `/auth/refresh` or `/auth/login`.

Also create a simple `/auth/error` page (message + "Back to EkLink" link to `${EKLINK_URL}/dashboard`).

---

## 9. Test checklist (must all pass before the app goes `live`)

Record the result of each in EkLink's `tracker.md` (the EkLink admin does this with you).

| # | Test | Expected |
|---|---|---|
| 1 | Open the app URL with no session | Redirected to EkLink; after login, lands back inside the app, signed in |
| 2 | Click the app card on the EkLink dashboard while logged in | Lands in the app with no second login |
| 3 | Callback with a wrong or missing `state` | Rejected, no session created |
| 4 | Reuse the same `code` a second time | `/token` rejects it; the app shows an error |
| 5 | Wait for the code to expire (> 60 s) then use it | Rejected |
| 6 | Tamper with `redirect_uri` in the `/authorize` URL | EkLink shows "Invalid redirect"; no code issued |
| 7 | Sign in as a role that is **not** in the app's allowed roles | EkLink shows "No access" |
| 8 | Feed the app an expired token, a token with another `aud`, and an unsigned/`HS256` token | All rejected |
| 9 | Admin deactivates the user (or force-logs-out), then wait for the next refresh | Session ends; user is sent to sign-in |
| 10 | Call an API endpoint with no cookie, and with a cookie of another role | `401` / `403` from the server, not just hidden UI |
| 11 | Search the repo and the browser (DevTools → Application, Network) for the client secret, tokens, service key | Not present anywhere |
| 12 | Logout | Cookie cleared, user lands on the EkLink dashboard, back button shows no private data |

## 10. Definition of done

- [ ] All MUST requirements implemented, test checklist 1–12 passed.
- [ ] App registered in EkLink, `status` switched to `live` by the EkLink admin.
- [ ] No secrets in Git history. If one was ever committed, it has been rotated.
- [ ] `.env.example` in your repo lists every variable from section 4 (no values).
- [ ] README of your repo has a short "Sign in with EkLink" section describing the flow and the local setup.
- [ ] You told the EkLink team the final production URL and the roles you actually need.

## 11. Known limitations of the prototype (so nobody is surprised)

| Limitation | What it means for you |
|---|---|
| No single logout | Logging out of EkLink does not end your session instantly. It ends within your next refresh (≤ 15 min). Keep to R7. |
| No cookie SSO across apps | Different Vercel accounts and `vercel.app` domains cannot share cookies. The redirect hop to EkLink is normal and invisible when the user is already signed in. |
| EkLink's rate limiter is per serverless instance | Do not rely on EkLink to protect your own endpoints. Rate-limit your own login-related routes if you can. |
| EkLink has no user-directory API yet | You cannot ask EkLink "list all faculty". Pre-seed from the CSV (see R5). Tell the EkLink team if you need a directory endpoint. |
| EkLink has no app-to-app (service-to-service) auth yet | Do not build direct calls between apps for now. Agree the contract first (e.g. Attendie → ApproveIt) and raise it with the EkLink team. |
| Preview deployments cannot sign in | See section 3. |

## 12. Who to contact

Questions about registration, secrets, roles or EkLink behaviour: the EkLink admin / EkLink repo maintainers. If something in this file is unclear or blocks you, raise it before working around it. Any change to the rules needs a tracker entry on the EkLink side.
