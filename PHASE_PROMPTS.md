# ApproveIt: Phase Prompts (copy-paste into Antigravity)

## Pehle ye padho (tumhare liye)

**Ek baar setup:** `AGENT_PROTOCOL.md` ko `MD Files/` folder me rakh do. Har phase ke prompt me pehli line wahi file padhne ko bolti hai.

**Har phase ka flow:**

1. Us phase ka prompt (4-backtick wala box) copy karke Antigravity me paste karo.
2. Antigravity **Step A** me summary, doubts aur plan dega. Code nahi likhega. Tum doubts ka jawab do, phir **"start"** likho.
3. Wo task by task banayega, har task ke baad commit + branch push karega. `main` ko haath nahi lagayega.
4. End me wo khud verify karke **Phase Report** dega.
5. Tum neeche wale **"Manual verification"** steps karo.
6. Sab theek ho to likho: **`verified, merge`**. Tab wo `main` me merge karke tag lagayega.
7. Phir agle phase ka prompt paste karo.

**Agar manual test fail ho:** error ka text (ya screenshot) bhejo aur likho "fix this". **Kabhi secret, token ya cookie chat me paste mat karna.**

**Git ka summary:**
- `main` = hamesha chalta hua code. Sirf tumhare "verified, merge" ke baad badlega.
- Har phase ka apna branch: `phase-0-setup`, `phase-1-auth`, ...
- Har task ke baad branch push hota hai (GitHub pe backup).
- `.env.local` kabhi git me nahi jaana chahiye. Agar kabhi `git status` me `.env.local` dikhe to ruko aur mujhse poochho.
- GitHub repo **private** rakhna.

---

# PHASE 0: Setup

**Kya hoga:** repo, `.gitignore`, `.env.example`, Next.js scaffold, packages, test runner. Koi feature ya login code nahi.

**Tumhe pehle se chahiye:** Node 20+, Git installed, GitHub pe khaali **private** repo (URL ready rakho).

````
Read `MD Files/AGENT_PROTOCOL.md` first and follow it for this whole phase. Then read, in this order: `MD Files/EkLink-Integration-ApproveIt.md`, `MD Files/rules.md`, `MD Files/planning.md`, `MD Files/tracker.md`, `MD Files/README.md`.

# PHASE 0: Setup (no features, no auth code)

## Step A (do this first, then STOP and wait for "start")
Reply with: a short summary of Phase 0, any conflicts in the docs, and questions with recommended defaults. Ask at least:
1. The GitHub remote URL (private repo) and whether git user.name / user.email are set.
2. The installed Node version (`node -v`). Node 20+ is required.
3. Confirm: package manager = npm.
Then give a short plan and the branch name `phase-0-setup`.

## Tasks (after "start")

0.1 Git baseline
- Check `git status`. If the folder is not a repo: `git init -b main`.
- Create `.gitignore` FIRST (Node + Next.js defaults) and make sure it ignores `.env*` EXCEPT `.env.example`, plus `.vercel`, `*.pem`, `.DS_Store`, `/coverage`, `.next`, `node_modules`. Prove it: create an empty `.env.local`, run `git check-ignore -v .env.local`, then delete the file.
- First commit on `main`: `.gitignore` + the `MD Files/` folder only. Message: `chore: initial commit with project docs and gitignore`.
- Add the remote, push `main`. Then create and switch to branch `phase-0-setup`. From now on, no commits on `main`.

0.2 Scaffold Next.js in the REPO ROOT (not inside `MD Files/`)
- App Router, TypeScript (strict), ESLint, Tailwind, `src/` directory, import alias `@/*`.
- The folder name `Approve_It` is not a valid npm package name. Use package name `approveit`. If `create-next-app` refuses a non-empty folder, scaffold in a temporary folder and move the files into the root, but never overwrite the `.gitignore` rules from 0.1 (merge them) and never touch `MD Files/`.
- Delete the generated README.md (the real README is in `MD Files/`) and default demo assets/pages.
- Record the installed Next.js version in the tracker decisions log. (Next 16+ uses `proxy.ts`; older versions use `middleware.ts`. We need this in Phase 1.)

0.3 Dependencies (explain each in the commit body)
- runtime: `jose`, `@supabase/supabase-js`, `server-only`, `zod`
- dev: `vitest`, `tsx`
- Do NOT add anything else. (`pdf-lib` comes in Phase 5.)

0.4 Scripts in package.json
`dev` = `next dev -p 3002`, `start` = `next start -p 3002`, `build`, `lint`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`. Add a vitest config with the `@` alias and one tiny smoke test so the runner is proven.

0.5 Folder structure
Create the folders from `planning.md` §12 that will be needed (with `.gitkeep` where empty). Do NOT create empty stub files that look like implemented code.

0.6 `.env.example`
List every variable from integration file §4 plus `SUPABASE_URL` and `SUPABASE_SECRET_KEY`: `EKLINK_URL`, `EKLINK_ISSUER`, `EKLINK_CLIENT_ID`, `EKLINK_CLIENT_SECRET`, `EKLINK_REDIRECT_URI`, `APP_URL`, `APP_SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. NO values. One comment line per variable (what it is, "server only", and for the session secret: `openssl rand -base64 48`). Local dev values hint: `APP_URL=http://localhost:3002`, `EKLINK_REDIRECT_URI=http://localhost:3002/auth/callback` may be written as comments, not values.

0.7 Placeholder home page
Replace the default page with a plain static "ApproveIt (setup)" page. No auth, no data.

0.8 tracker.md
- Tick the Phase 0 items that are code-done. Leave items that need the developer (Supabase project, Vercel project, EkLink registration, client id/secret) unticked.
- Note in the tracker that docs live in `MD Files/` (so "Add docs/EkLink-Integration..." is satisfied by that location).
- Add to the Decisions log: phases follow planning/tracker; chains in `application_types.chain`; `exam_cell` added to `app_roles`; General chain = Class teacher → HOD (configurable); 10 attachments for all types; docs folder; Next.js version.
- Open questions: #1 resolved (General = Class teacher → HOD, configurable). #7: 10 files for all types is decided; 5 MB and file types are still to be confirmed with the college.
- Update "Current phase", "Last updated", and the Changelog.

0.9 Registration draft
In the chat (NOT in a file), write a ready-to-send message for the EkLink admin using the registration table in integration file §3: slug `approveit`, name, production URL as placeholder `https://approveit-xyz.vercel.app`, callbacks (production placeholder + `http://localhost:3002/auth/callback`), allowed roles `student, faculty, staff, hod, director, admin`, icon `stamp`, description. Say that the local callback can be registered first and the production callback added once the Vercel URL is final.

## Git for this phase
Commits (push the branch after each): `chore(repo): scaffold Next.js app`, `chore(deps): add jose, supabase-js, server-only, zod, vitest, tsx`, `chore(env): add .env.example`, `chore(scripts): add scripts and vitest config`, `docs(tracker): update phase 0 status`.

## Do NOT
Write any auth code, DB code, SQL, or UI beyond the placeholder page. Do not create `.env.local` with values. Do not deploy.

## Verification gate
Run protocol §6: lint, typecheck, test, build; `git ls-files | grep -i "\.env"` shows only `.env.example`; `npm run dev` starts on port 3002 and the placeholder page loads (check with a quick local request if you can). Then write the Phase 0 Report and STOP.
````

### Manual verification (Phase 0)

1. **GitHub:** repo private hai, `main` aur `phase-0-setup` dono branch dikh rahi hain.
2. Terminal: `git status` → "nothing to commit". `git ls-files | findstr /i ".env"` (Mac/Linux: `grep -i ".env"`) → sirf `.env.example`.
3. Ek khaali `.env.local` banao, `git status` me wo **nahi** dikhna chahiye. Phir delete kar do.
4. `npm install` → `npm run dev` → browser me `http://localhost:3002` kholo → "ApproveIt (setup)" dikhe.
5. `npm test`, `npm run build` dono pass.
6. **Tumhare apne kaam (Antigravity nahi kar sakta):**
   - **Supabase:** naya project (name `approveit`, region India ke paas, jaise Mumbai). DB password password-manager me save karo. Project URL aur **secret key** (service role) sirf apni local `.env.local` me daalo, chat me kabhi nahi.
   - **Vercel:** naya project banao (apne Vercel account me), GitHub repo connect karo. Production URL note karo. Env variables tab Phase 6 me daalenge. Abhi deploy fail ho to chalega.
   - **EkLink admin ko registration message bhejo** (jo Antigravity ne draft kiya).
   - Jab `client_id` aur `client_secret` mile, seedhe `.env.local` aur Vercel env me daalo (secret sirf ek baar dikhta hai).
   - `.env.local` banane ke liye `.env.example` copy karo aur values bharo. `APP_SESSION_SECRET` ke liye terminal me `openssl rand -base64 48` chalao.
7. Sab ok to: **`verified, merge`**.

---

# PHASE 1: Auth and people (EkLink login, DB foundation)

**Kya hoga:** EkLink se login, session, refresh, logout, error page, `people` table, dummy CSV seed, security headers, tests. Koi application feature nahi.

**Tumhe pehle se chahiye:** Phase 0 merged, `.env.local` poori bhari hui (EkLink ki client id/secret sahit), Supabase project ready. Agar EkLink credentials abhi nahi mile, tab bhi code aur unit tests ban sakte hain; sirf manual login test baad me hoga.

````
Read `MD Files/AGENT_PROTOCOL.md` first and follow it for this whole phase. Then re-read `MD Files/EkLink-Integration-ApproveIt.md` (especially R1 to R14, §8.4, §9), `MD Files/rules.md`, `MD Files/planning.md`, `MD Files/tracker.md`.

# PHASE 1: Auth and people

Branch: `phase-1-auth`, created from an up-to-date `main`.

## Step A (do this first, then STOP and wait for "start")
Reply with summary, conflicts, questions (with recommended defaults) and plan. Ask at least:
1. Which EkLink test accounts exist (login_id, role, department) so the dummy CSV can include them? (Real login only works if the login_id matches a real EkLink account. Ask for IDs only, never passwords.)
2. Dummy email domain to use for fake people.
3. Which login_id should be the first `workflow_admin` and which should be `admin_staff` / `exam_cell` (placeholders are fine for now).
4. The case "person found by email but login_id differs from the token": propose a safe behaviour. Do NOT rewrite a primary key silently.
5. `department` strings must match exactly between a student and their HOD (for example both "CSE"). Ask what exact strings EkLink uses.

## Tasks (after "start")

1.1 Env validation: `src/lib/env.ts` (server-only, zod). Validate all variables from `.env.example` lazily on first use. On failure throw an error that names the missing variable but NEVER prints any value. `APP_SESSION_SECRET` must be at least 32 bytes.

1.2 `src/lib/eklink.ts`: start from integration §8.4 (JWKS verify with `jose` `createRemoteJWKSet`, ES256 only, issuer, audience, clockTolerance 10, `exchangeCode`, `refreshEklinkToken`). Improvements required: network timeouts (`AbortSignal.timeout`), generic error messages (never include response bodies, tokens, codes), and make the key resolver injectable so tests can use a local key set.

1.3 `src/lib/session.ts`: own session cookie `approveit_session` (HS256, `HttpOnly; Secure; SameSite=Lax; Path=/`, 8-hour absolute cap). `getSession()` returns null when the EkLink token has expired. Nothing in localStorage/sessionStorage. The EkLink access token is only ever inside the signed cookie and never returned to the browser.

1.4 `src/lib/people.ts` and `src/lib/db.ts`: Supabase server client (service key, `persistSession:false`). `upsertPerson` looks up by `eklink_sub`, then `login_id`, then lower-case email (only to link a pre-seeded record that has no sub yet), then updates or creates. Refresh name, email, role, department, batch, section on every sign-in and refresh. NEVER overwrite `semester` or `signature_path`. Never match by name.

1.5 Routes (all server-side):
- `/auth/login`: random `state` (32 bytes), cookie `HttpOnly; Secure; SameSite=Lax; ~10 min`, redirect to `{EKLINK_URL}/authorize`. If a valid session already exists, go to `/`.
- `/auth/callback`: handle EkLink `error` param; constant-time `state` check; exchange code; verify token; `upsertPerson`; check the role is one of `student, faculty, staff, hod, director, admin`; create session; delete state cookie. Any failure → `/auth/error?e=<code>`. NEVER redirect back to `/authorize` from here (no loops).
- `/auth/refresh`: validate `next` (starts with `/`, not `//`, no `\`, and not under `/auth`). Wrap EVERYTHING in try/catch: any failure (EkLink says no, verify fails, DB error) destroys the session cookie and goes to `/auth/login`. Keep the session's 8-hour cap.
- `/auth/logout`: POST only. Clears the cookie, then 303 redirect to `{EKLINK_URL}/dashboard`. Use a `<form method="post">` button in the UI.
- `/auth/error`: simple page, friendly message per error code, and a "Back to EkLink" link to `{EKLINK_URL}/dashboard` (built on the server from env).

1.6 `src/proxy.ts` (or `middleware.ts` if the installed Next version needs it): convenience redirect only, as in §8.4. Public paths: `/auth`, `/_next`, `/favicon.ico`.

1.7 `src/lib/auth.ts` helpers used by every page and API:
- `requirePageSession()`: no cookie → redirect `/auth/login`; cookie but expired EkLink token → redirect `/auth/refresh?next=<path>`.
- `requireApiSession()`: returns 401 JSON when not signed in (the client then navigates to `/auth/refresh` or `/auth/login`).
- coarse role check against the allowed roles → 403.
- `getAppRoles(login_id)` reads `app_roles` from the DB.

1.8 Minimal pages and API for testing only:
- `/`: shows "Signed in as <name> (<role>)" and a Logout button. Nothing else.
- `GET /api/me` → `{ login_id, name, role }` (never the token).
- `GET /api/admin/ping` → requires app_role `workflow_admin` (DB check), else 403. (Used to test test #10; we replace it later.)

1.9 Migration `supabase/migrations/0001_people_and_roles.sql`: tables `people` (exactly as `planning.md` §10, including `semester` and `signature_path`), `app_roles` (check allows `admin_staff, exam_cell, workflow_admin`), `approver_assignments`. For EVERY table: `alter table ... enable row level security;` with NO policies, and `revoke all on table ... from anon, authenticated;`. Add an index on `lower(email)`.

1.10 Seed:
- `supabase/seed/people.dummy.csv` with header `login_id,name,college_email,role,department`. Obviously fake data: 1 HOD (CSE), 1 director, about 6 faculty (one is the future Hack-o-week incharge), 2 staff (future admin_staff and exam_cell), about 5 students (all CSE). Include the real EkLink test accounts the developer named in Step A.
- `supabase/seed/app_roles.dummy.csv` (login_id, app_role) with the first `workflow_admin`, `admin_staff`, `exam_cell`.
- `scripts/seed-people.ts` + npm script `seed:people`: validates rows with zod, upserts by `login_id` (idempotent), never overwrites `eklink_sub`, `semester` or `signature_path`, prints COUNTS only (no emails), refuses to run unless `--yes` is passed. Prefer Node's `--env-file=.env.local` over adding `dotenv`.

1.11 Security headers (in `next.config`): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, CSP with `frame-ancestors 'none'`, `Permissions-Policy` (deny camera/mic/geo), `poweredByHeader:false`, and `Cache-Control: no-store` on all pages and API routes (not on `_next/static`). CSP: use the strictest policy that works with Next.js (nonce-based if practical; otherwise `'unsafe-inline'` for scripts with a note in the tracker). Allow the Supabase host in `img-src` and `connect-src` (read from env). If you add `form-action`, include the `EKLINK_URL` origin because logout redirects there. Never put secrets or the full env in the CSP.

1.12 Tests (vitest), required:
- token verification with a locally generated ES256 key set: valid, expired, wrong `aud`, wrong `iss`, HS256-signed, `alg:none`, tampered payload → only the valid one passes (integration test #8);
- `state` check: match, mismatch, missing, length mismatch (test #3);
- `next` validation table (`//evil.com`, `/\evil`, `https://x.com`, `/auth/login`, `/ok`);
- session sign/read: valid, tampered, expired, wrong secret;
- `upsertPerson` matching order and "never overwrites semester/signature_path" using a fake db;
- callback route with mocks: bad state → error redirect and NO session cookie; role not allowed → error;
- `requireApiSession` / role / app-role checks → 401 and 403 (test #10).

1.13 Docs: update `README.md` "Sign in with EkLink" and local-setup sections to match what you built (include how to run the migration in the Supabase SQL editor and how to run the seed). In `tracker.md` tick tasks, and fill the **Notes** column of EkLink tests (for example "covered by unit tests") but leave the **Result** column empty.

## Git for this phase
Commit and push after each of: env+eklink+session (1.1 to 1.3), people+db (1.4), auth routes (1.5), proxy+helpers+pages (1.6 to 1.8), migration+seed (1.9 to 1.10), headers (1.11), tests (1.12), docs (1.13). Use messages like `feat(auth): ...`, `feat(db): ...`, `test(auth): ...`.

## Do NOT
Create any login form, password field, demo account or bypass. Log tokens/codes/secrets/cookies. Put the EkLink token in a URL, response body, or browser storage. Hard-code any URL (use env). Build any application feature. Copy the reference code blindly: it is a starting point, and the improvements above are mandatory.

## Verification gate
Protocol §6 plus: write a table mapping EkLink tests 1 to 12 → "covered by unit test X" or "needs manual test with EkLink admin". Run a grep proving there is no `NEXT_PUBLIC_` secret and no hard-coded `vercel.app` or `localhost` URL in `src/` (only in `.env.example` comments/docs). Then write the Phase 1 Report and STOP.
````

### Manual verification (Phase 1)

**Pehle setup:**
1. Supabase dashboard → **SQL Editor** → `supabase/migrations/0001_people_and_roles.sql` ka content paste → **Run**.
2. **Table Editor** me `people`, `app_roles`, `approver_assignments` dikhne chahiye, har ek pe **RLS enabled**.
3. Terminal: `npm run seed:people -- --yes` → counts dikhe. `people` table me rows aa gayi.
4. `.env.local` poora bhara hai (EkLink wali values EkLink admin se mili hui).
5. `npm test` → sab green. (Ye test #3, #8, #10 ka bada hissa automatic cover karta hai.)

**Ab EkLink ke saath test (tracker ke 12 tests):**

| Test | Tum kya karo |
|---|---|
| **1** | Incognito me `http://localhost:3002` kholo → EkLink login page → login → wapas ApproveIt me "Signed in as ..." |
| **2** | EkLink dashboard pe login rehte hue ApproveIt ka card click karo → direct andar (doosra login nahi) |
| **3** | Seedha `http://localhost:3002/auth/callback?code=abc&state=xyz` kholo → error page. DevTools → Application → Cookies me `approveit_session` **nahi** banni chahiye |
| **4, 5** | EkLink admin ke saath. Network tab me "Preserve log" on karke login karo, callback URL copy karo. Wahi URL dobara kholo → error. 60 sec baad bhi error |
| **6** | EkLink admin ke saath: `/authorize` URL me `redirect_uri` badlo → EkLink "Invalid redirect" dikhaye |
| **7** | Aisi role ka account jo allowed list me nahi (jaise `finance`) → EkLink "No access" |
| **8** | `npm test` (automatic) |
| **9** | EkLink admin user ko deactivate ya force-logout kare, phir max 15 min wait → ApproveIt me page reload → sign-in pe bhej de |
| **10** | `curl -i http://localhost:3002/api/me` → **401**. Student ke login ke baad browser me `/api/admin/ping` kholo → **403** |
| **11** | `git grep -n -i "client_secret"` me sirf variable ke naam dikhen, value nahi. DevTools → Application → Local/Session Storage **khaali**. Network tab me kisi response me `eyJ` (token) nahi |
| **12** | Logout dabao → EkLink dashboard pe pahuncho. Browser **Back** dabao → private page nahi dikhna chahiye, login pe bhej de |

Jo tests EkLink admin ke saath kiye, unka result `tracker.md` ke **Result** column me tum (ya EkLink admin) bharo.

**Extra checks:**
- Student account se login → DevTools → Application → Cookies: `approveit_session` pe **HttpOnly** aur **Secure** tick hone chahiye.
- Network tab me kisi bhi response me tumhara token ya `client_secret` nahi hona chahiye.

Sab theek to: **`verified, merge`**.

---

# PHASE 2: Medical flow end-to-end

**Kya hoga:** DB tables, chain engine, student ka Medical form (attachments ke saath), approver inbox aur review screen, stamp, student ka live status. Baaki 3 tabs "Coming soon".

**Tumhe pehle se chahiye:** Phase 1 merged. EkLink pe kam se kam **1 student, 1 faculty, 1 HOD (student ke same department ka)** test account, aur ye teeno `people` seed me honi chahiye (login_id match).

````
Read `MD Files/AGENT_PROTOCOL.md` first and follow it for this whole phase. Then re-read `MD Files/rules.md` (§2, §3, §4, §6a), `MD Files/planning.md` (§4 to §7, §10, §11), `MD Files/tracker.md`.

# PHASE 2: Medical flow end-to-end

Branch: `phase-2-medical`, from an up-to-date `main`.

## Step A (do this first, then STOP and wait for "start")
Reply with summary, conflicts, questions with recommended defaults, and plan. Ask / confirm at least:
1. **Semester rule.** Proposal: derive a *suggested* semester from `batch` (for example `2023-27`) and today's date: academic year starts in July; `idx = (month>=7 ? year : year-1) - startYear`; `semester = 2*idx + (month>=7 ? 1 : 2)`, clamped to 1..8. The student confirms or changes it in their profile (stored in `people.semester`); the confirmed value wins. At submit, the value used is snapshotted. Ask the developer to confirm.
2. **Chain snapshot.** Proposal: add `applications.chain_snapshot jsonb not null` (copied from `application_types.chain` at submit), so editing a chain never breaks applications already in flight. This adds a column that `planning.md` §10 does not list. Ask for approval.
3. **Attachments on Vercel.** Vercel functions accept only about 4.5 MB request bodies, but our limit is 5 MB per file. Proposal: the server validates the request (count, declared name/type/size) and issues a Supabase **signed upload URL** for one file; the browser uploads straight to the private bucket; the server then FINALISES: re-checks the real size, checks the file's magic bytes (PDF `%PDF`, JPEG `FFD8FF`, PNG `89504E47`), inserts the `attachments` row, and deletes the object if invalid. Ask for approval or an alternative.
4. **HOD resolution.** Proposal: exactly one person with role `hod` and the same `department` as the applicant. If there are zero or several, the submit is blocked with a clear message ("No HOD configured for your department, contact admin") and nothing is guessed. Confirm.
5. **Draft behaviour.** Proposal: a draft application is created when the student first adds a file or saves; submit moves it to `in_review`. Confirm.
6. Check the `people` seed: do the student's `department` and the HOD's `department` match exactly?

## Tasks (after "start")

### 2A. Data and engine (no UI yet)
2.1 Migration `0002_applications.sql`: `application_types`, `applications` (plus `chain_snapshot` if approved), `application_steps`, `application_messages`, `attachments`, `notifications` exactly as `planning.md` §10. RLS enabled and `revoke all ... from anon, authenticated` on every table. Add:
- a trigger that RAISES on any UPDATE or DELETE of `application_steps` (append-only enforced in the database, test A7);
- a check: `decision <> 'approved' or verification_id is not null` (stamp compulsory);
- private Storage bucket `attachments` (`public = false`) created in SQL.
Seed the `medical` type: chain = class_teacher (`applicant_selected`, `can_reject:true`, `comment_required_on_reject:true`) → hod (`role_same_department`, role `hod`, `can_reject:true`). Other types are seeded in Phase 4.

2.2 `src/lib/workflow/chains.ts`: zod schema for the chain JSON, loader, validation. `resolve-approver.ts`: implement ALL five resolver kinds now (`applicant_selected`, `role_same_department`, `role`, `app_role`, `assignment`), using injected data access so they are unit-testable. Resolution happens only on the server from DB data.

2.3 `src/lib/workflow/transitions.ts`: pure decision logic for `submit`, `approve`, `reject`, `return`. Input: application, chain, actor login_id, action, comment. Output: the new state (status, current_step, current approver) or a typed error. Enforce: application is `in_review`; actor === `current_approver_login_id`; `can_reject`; comment required on reject and return (→ 422); approve on the last step → `approved`; otherwise advance to the next step and re-resolve the approver. The same person can legitimately hold two steps; never skip a step.

2.4 Atomic persistence: one transition = update application + insert step row (+ stamp id) in ONE database transaction (a Postgres function called via `rpc`, or an equivalent you propose in Step A), guarded by an optimistic check on `(id, status='in_review', current_step, current_approver_login_id)` so two tabs or a double-click can never double-approve. If zero rows match → 409.

2.5 Repository layer (`src/lib/db.ts` + `src/lib/repos/*`): all queries live here behind small interfaces, so tests can use an in-memory fake and a common DB can replace Supabase later.

2.6 `src/lib/stamp/verification-id.ts`: id format `AP-XXXX-XXXX` from an unambiguous alphabet (no 0/O/1/I), generated with `crypto.randomInt`, retried on unique-constraint collision. `src/lib/semester.ts` (pure, per the confirmed rule). Time helper for IST display.

### 2B. Student side
2.7 `/` (student): four tabs Medical / Hackathon / Re-CA / General. Only Medical is active, others show "Coming soon" (disabled). List of the student's own applications with status.
2.8 `/apply/medical`: fields = subject, class teacher dropdown (all `people` with role `faculty`), optional comment, optional urgent, attachments (max 10, PDF/JPG/PNG, 5 MB; limits in ONE config constant). Student details are shown read-only (name, PRN, batch, semester, section, department) and are NEVER typed by the student. Snapshot them into `applicant_snapshot` at submit.
2.9 Attachment flow as approved in Step A. Server-side validation of count, extension, MIME, size and magic bytes. Storage path = generated uuid (never the original name). Files shown only through short-lived signed URLs (about 60 s) generated on the server after a visibility check.
2.10 `/applications/[id]` (applicant only; anyone else gets 404): live status, a step-by-step progress view (done / current / pending), "Waiting for <name>", the history log with comments and stamps, attachments.

### 2C. Approver side
2.11 `/` redirects faculty/staff/hod/director to `/inbox`. `/inbox` with sidebar tabs: Dashboard (counts), Pending (urgent first, then oldest first), Approved, Rejected, On hold. Visibility: only applications that are currently assigned to the user or in which the user has a step row.
2.12 `/inbox/[id]` review screen: student details (snapshot), subject, urgent badge, attachments, history log, and actions: **Approve**, **Reject** (comment required), **Hold / return to student** (comment required), optional comment. The decision API takes ONLY `{ action, comment }`. The server decides the step and approver and ignores anything else (test A3).
2.13 `VerifiedStamp` component: "Digitally verified by <name> (<designation>)", date-time in IST, `ID: AP-XXXX-XXXX`, plus the small line "Internal electronic record. Not a legal digital signature." Shown for every approver action. The word "legally valid", "certified" or "DSC" must not appear anywhere.
2.14 Routes use `zod` strict schemas. Status codes per protocol §10.

### 2D. Tests (required)
- unit: each resolver kind; transitions (approve not last, approve last, reject, return, wrong actor, wrong status, missing comment); semester rule; verification id format and collision retry; chain schema;
- API/permission tests with the in-memory repo: A1 (other student's application → 404), A2 (non-current approver → 403), A3 (forged step/approver ignored), A5 (reject/return without comment → 422), A6 (11th file, wrong type, over 5 MB, fake extension with wrong magic bytes → rejected), A8 (student cannot edit while `in_review`), A12 (stamp present, ids unique); unauthenticated → 401; concurrency: two simultaneous approvals → exactly one wins;
- a DB-level check described in the report: how the developer can confirm the `application_steps` trigger blocks UPDATE/DELETE (A7).

## Git for this phase
Commit and push after each numbered task group: migration (2.1), engine (2.2 to 2.6, with tests), student UI (2.7 to 2.10), approver UI (2.11 to 2.14), tests and docs. Do not merge.

## Do NOT
Trust any step/approver/login_id from the browser. Put business rules inside route handlers or components. Expose a service key or any signed upload token longer than needed. Use original file names as storage paths. Build the thread, withdraw, resubmit or signature upload (Phase 3), other types (Phase 4), notifications or PDF (Phase 5).

## Verification gate
Protocol §6, and in the rules audit cover `rules.md` §2 (every bullet), §3, §4. Then write the Phase 2 Report and STOP.
````

### Manual verification (Phase 2)

**Setup:** Supabase SQL Editor me `0002_applications.sql` run karo. Seed dobara chalao agar naye test accounts jode (`npm run seed:people -- --yes`). Dekho: `application_types` me `medical` row hai.

**Happy path (2-3 browser: normal + incognito + doosra browser):**
1. **Student** login → Medical tab → form: subject likho, class teacher dropdown se faculty chuno, 2 files attach (ek PDF, ek JPG) → Submit.
2. Application page: status "In review, waiting for <teacher>". Tumhara naam, PRN, batch, semester, section khud bhare dikhen. Tumne kuch type nahi kiya.
3. **Faculty (class teacher)** login → `/inbox` → Pending me application → kholo → files open hoti hain → **Approve**. Stamp dikhna chahiye: naam, IST time, `ID: AP-....`, aur "Internal electronic record. Not a legal digital signature."
4. Student ka page refresh → ab "waiting for HOD" aur pehla stamp.
5. **HOD** login → Approve → student ke page pe **Approved**, 2 stamps, alag-alag ID.
6. Faculty ke **Approved** tab me application dikhe.

**Negative tests:**
- Naya application banao → faculty se **Reject** karo bina comment ke → error. Comment ke saath → status Rejected, student ko reason dikhe.
- Naya application → faculty se **Hold** (comment ke saath) → faculty ke **On hold** tab me dikhe, student ka status "Returned".
- Student A ka application URL student B ke login se kholo → **404**.
- Faculty jo class teacher nahi hai, uska direct URL `/inbox/<id>` kholo → 404 ya 403.
- 11 files, `.exe` file, ya 5 MB se badi file upload karke dekho → reject.
- Ek PDF ka naam badalkar `.exe` ko `.pdf` kar do (fake) → reject hona chahiye.
- DevTools console me ek approve request forge karo (extra field `step: 5` ya `approver: "xyz"` ke saath) → server ignore kare, ya 422.
- **A7:** Supabase SQL Editor me `update application_steps set comment='x' where id = 1;` → **error** aana chahiye (trigger). `delete from application_steps where id = 1;` → error.
- Supabase Table Editor me `application_steps`: har action ke liye ek row, kuch overwrite nahi hui.
- Do tabs me ek hi application pe ek saath Approve dabao → sirf ek chale, doosre ko error.

Sab theek to: **`verified, merge`**.

---

# PHASE 3: Thread, hold and resubmit, withdraw, signature

**Kya hoga:** Gmail jaisa thread (comments + replies + files + returns ek jagah), hold ke baad student edit karke usi application me resubmit, withdraw, profile page (semester confirm, optional signature), stamp me signature.

````
Read `MD Files/AGENT_PROTOCOL.md` first and follow it for this whole phase. Then re-read `MD Files/rules.md` (§2, §3, §4, §6), `MD Files/planning.md` (§5, §6, §7), `MD Files/tracker.md`.

# PHASE 3: Thread, hold/resubmit, withdraw, signature

Branch: `phase-3-thread-signature`, from an up-to-date `main`.

## Step A (do this first, then STOP and wait for "start")
Reply with summary, conflicts, questions with defaults, plan. Ask / confirm at least:
1. After a **return**, may the student change the class teacher? Proposal: NO, it is locked after the first submit (changing it would change who approves step 1).
2. Signature rules. Proposal: PNG/JPG only, max 1 MB, validated by magic bytes, allowed for roles faculty/staff/hod/director only, stored in the private bucket `signatures`. Every upload gets a NEW object path (versioned, never overwritten), `people.signature_path` points to the latest, and an approval stores the path that was used at that moment in `application_steps.signature_path`, so old stamps never change. Also offer a "draw on canvas" option that produces a PNG? Ask whether she wants it now or later.
3. Who may post thread replies, and when? Proposal: the applicant and any approver who is the current approver or has a step on this application, only while status is `in_review` or `returned`. Closed after approved / rejected / cancelled. Plain text only, max 2000 characters.
4. Confirm the order of events on resubmit: `resubmitted` step row, status `in_review`, back to the SAME step the application was returned from, approver re-resolved for that step.

## Tasks (after "start")

3.1 Unified thread: `src/lib/thread.ts` builds ONE chronological list from `application_steps` (decisions + stamps), `application_messages` (replies) and attachment additions. One shared component used on the student page and the approver review page. Messages render as escaped plain text (no HTML, no markdown links executed).
3.2 Replies: `POST /api/applications/[id]/messages` with zod validation, permission per Step A answer 3, attachments may be linked to a message (`attachments.message_id`) within the 10-file limit.
3.3 Return (hold) end-to-end: approver Hold (comment required, stamp issued) → status `returned`. Student sees a banner "Returned by <name>: <comment>", and may: edit subject and own comment, add attachments, remove attachments (soft remove via `removed_at`; limit of 10 counts only non-removed files; removed files stay in history), and reply in the thread. Student **cannot** edit while `in_review` (test A8).
3.4 Resubmit: `POST /api/applications/[id]/resubmit` (applicant only, only while `returned`). Writes a `resubmitted` step row, sets `in_review`, same step, same application, same thread (test A9). Atomic with the same optimistic guard as Phase 2.
3.5 Withdraw: `POST /api/applications/[id]/withdraw` (applicant only, only while `in_review` or `returned`, optional reason). Writes a `withdrawn` step row, status `cancelled`. After approved / rejected / cancelled → blocked (test A10).
3.6 `/profile` for every role: read-only details (name, login_id, email, role, department, batch, section). Students: semester field showing the suggested value and a confirm/change control (valid 1..8), saved to `people.semester`. Approver roles: signature upload (and draw if approved), preview via a short-lived signed URL, "remove" (sets `people.signature_path` to null but never deletes old objects).
3.7 Stamp with signature: on approve / forward / reject / return, if the approver has a signature, copy its path into the step row at that moment; the stamp component shows the image (signed URL generated on the server, only inside views the viewer is allowed to see). Signature is optional; the stamp itself is not.
3.8 Snapshots stay frozen: changing profile data after submit must not change old applications (test A11).

### Tests (required)
Thread ordering and merging; reply permissions (outsider → 404/403, closed statuses → 409/403); A8, A9 (same application id, same thread, back to the same step), A10, A11; signature validation (type, size, magic bytes, student role not allowed); signature versioning (old stamp keeps old path after a new upload); soft-remove limit logic; concurrency on resubmit/withdraw.

## Git for this phase
Commit and push after each of: thread (3.1, 3.2), return/resubmit/withdraw (3.3 to 3.5), profile and signature (3.6 to 3.8), tests/docs.

## Do NOT
Update or delete `application_steps` rows. Allow editing while `in_review`. Render user text as HTML. Make the signature bucket public. Overwrite an existing signature object. Build other application types or notifications.

## Verification gate
Protocol §6 with the rules audit on `rules.md` §2, §3, §4, §6. Then write the Phase 3 Report and STOP.
````

### Manual verification (Phase 3)

1. Student ne application bheja → faculty **Hold** karta hai ("Add doctor's note") → student ko banner dikhe, status "Returned".
2. Student: ek file add karo, ek purani file hatao, thread me reply likho → **Resubmit**. Wahi application wahi thread me dikhe, status "In review, waiting for <wahi teacher>". Thread me order: submitted → hold (stamp) → reply → resubmitted.
3. In-review status me student edit karne ki koshish kare (subject badalna, file add/remove) → **blocked**.
4. Student **Withdraw** kare → status "Cancelled". Faculty ke inbox se nikal jaye (ya Cancelled me dikhe).
5. Ek application poori approve ho jaye → ab student **Withdraw** try kare → blocked.
6. Student profile: semester confirm karo. Phir ek naya application bhejo → approver ko wahi semester dikhe. Profile me semester badlo → **purane** application me semester nahi badalna chahiye.
7. Faculty profile me signature upload karo (PNG). Application approve karo → stamp ke saath signature dikhe. Signature badal ke dusra application approve karo → naye me naya signature, **purane stamp me purana**.
8. Signature ka image URL direct kholne ki koshish (copy kiya hua signed link ~1-2 min baad) → expire ho gaya ho.
9. Student role se signature upload ka option nahi dikhna chahiye; API se try kare to 403.
10. Thread me `<b>test</b>` likho → text jaisa dikhe, bold nahi hona chahiye.

Sab theek to: **`verified, merge`**.

---

# PHASE 4: Other application types, admin screens

**Kya hoga:** Hackathon (admin forward-only), Re-CA, General, admin screens (assignments, people, types), urgent sorting.

**Tumhe pehle se chahiye:** Phase 3 merged. Admin staff, Exam cell aur Hack-o-week incharge ke login_id (ya placeholders), aur test accounts: ek director, ek admin_staff, ek exam_cell, ek incharge.

````
Read `MD Files/AGENT_PROTOCOL.md` first and follow it for this whole phase. Then re-read `MD Files/rules.md` (§2), `MD Files/planning.md` (§3, §4, §5, §10 chain config, §11), `MD Files/tracker.md`.

# PHASE 4: Other types and admin screens

Branch: `phase-4-types-admin`, from an up-to-date `main`.

## Step A (do this first, then STOP and wait for "start")
Reply with summary, conflicts, questions with defaults, plan. Ask / confirm at least:
1. **Hack-o-week incharge:** one global person (`scope_key = null`) or per event? Proposal: global now. Changing later must be a data change in `approver_assignments`. If per event, ask how the student picks the event.
2. **Login IDs** for `admin_staff`, `exam_cell`, the incharge, and the first `workflow_admin` (placeholders allowed, but they must be rows in the DB, not code).
3. **Admin step comment:** proposal: the "attendance comment" is mandatory for the admin_staff forward step (`comment_required_on_forward: true` in chain config). Confirm.
4. **Admin step actions:** proposal: forward (stamped, decision `forwarded`) and hold/return are allowed; reject is NOT. Confirm.
5. **Chain editing UI:** proposal: `/admin/types` shows chains and lets the admin enable/disable a type; editing chain JSON is allowed only through a zod-validated editor and affects NEW applications only (because of `chain_snapshot`). Confirm or reduce to read-only.
6. **Urgent and notifications:** proposal: this phase adds the urgent flag, queue sorting and badge; the "notify next approver" part is wired in Phase 5 when the `notifications` feature exists. Confirm.
7. Who may be a `workflow_admin` and may that person also see applications? Proposal: workflow_admin only gets admin screens, no extra application visibility.

## Tasks (after "start")

4.1 Seed `hackathon`, `re_ca`, `general` types (migration `0003` or a seed script; chains exactly as `planning.md` §4 and §10):
- hackathon: `admin_staff` (`app_role`, `can_reject:false`, attendance comment) → `hackathon_incharge` (`assignment`) → `hod` (`role_same_department`) → `director` (`role`)
- re_ca: class teacher → hod → `exam_cell` (`app_role`)
- general: class teacher → hod
Extend the chain schema with `can_reject`, `comment_required_on_reject`, `comment_required_on_forward`, `decision_label`.
4.2 Transitions: add the forward-only behaviour. Reject on a step with `can_reject:false` is refused ON THE SERVER with 403 and a clear code (test A4). Forward writes a `forwarded` step row with a stamp. Return stays available.
4.3 Forms: Hackathon (no class teacher dropdown), Re-CA and General (with dropdown). Same attachment rules (10 files). Enable the three tabs. Urgent flag at submit.
4.4 Approver UI: admin_staff step shows a "Forward" button and an "Attendance comment" field and no Reject button; exam_cell and director steps work as normal approvals. Urgent applications sort first with a visible badge in Pending.
4.5 Admin screens (server-side check of `app_roles.workflow_admin` on every request; others get 403):
- `/admin/assignments`: list/add/remove `approver_assignments` and `app_roles` rows (confirmation on delete);
- `/admin/people`: CSV import (`login_id,name,college_email,role,department`): validate with zod, show a preview and counts, then confirm; upsert by `login_id`, never overwrite `eklink_sub`, `semester`, `signature_path`;
- `/admin/types`: per Step A answer 5.
Remove the temporary `/api/admin/ping` once a real admin route covers the same test.
4.6 Config flags, not code: nothing about who approves a step may be hard-coded in TypeScript.

### Tests (required)
Resolver tests for `app_role` and `assignment` (missing assignment → clear blocked-submit error); full end-to-end flows in memory for ALL four types (happy path + reject + return at various steps); A4; forward without attendance comment → 422; admin screens: non-admin → 403, unauthenticated → 401; CSV import: bad header, duplicate login_id, bad role, too large; urgent sorting; chain edit affects only new applications; a chain with `can_reject:false` cannot reject via any route.

## Git for this phase
Commit and push after each of: seeds+schema (4.1), transitions (4.2), forms+UI (4.3, 4.4), admin screens (4.5), tests/docs.

## Do NOT
Hard-code approvers or chains. Let an admin step reject by hiding a button only. Skip a step for urgent applications. Add notifications or PDF.

## Verification gate
Protocol §6 with the rules audit on `rules.md` §2, §3, §7. Then write the Phase 4 Report and STOP.
````

### Manual verification (Phase 4)

1. **Hackathon:** student se Hackathon form bhejo → **admin_staff** login → sirf "Forward" + "Attendance comment" dikhe, **Reject button nahi**. Comment ke bina Forward → error. Comment ke saath → stamp, status ab Hack-o-week incharge ke paas.
2. DevTools se Reject request manually bhejo (admin step pe) → server **403**.
3. Incharge → HOD → Director approve karo → student ko **Approved**, 4 stamps.
4. **Re-CA:** class teacher → HOD → exam_cell approve → Approved.
5. **General:** class teacher → HOD approve.
6. **Urgent:** 2 application bhejo, doosra urgent → approver ke Pending me urgent upar, badge ke saath.
7. **Admin screens:** `workflow_admin` account se `/admin/assignments`, `/admin/people`, `/admin/types` khulen. Normal faculty se kholo → 403.
8. Incharge badlo (assignment me doosri faculty daalo) → naya hackathon application naye incharge ke paas jaye. Code change nahi.
9. CSV import: galat header ya galat role wali file upload → saaf error, kuch save nahi.
10. Chain disable karke dekho (kisi type ko disable) → student ko wo tab band dikhe.

Sab theek to: **`verified, merge`**.

---

# PHASE 5: Notifications and PDF export

**Kya hoga:** in-app notification tab + unread badge, urgent notifications, final PDF export (cover, timeline, stamps, attachments), optional `/verify/<id>`.

````
Read `MD Files/AGENT_PROTOCOL.md` first and follow it for this whole phase. Then re-read `MD Files/planning.md` (§6, §8), `MD Files/rules.md` (§3, §4, §6), `MD Files/tracker.md`.

# PHASE 5: Notifications and PDF

Branch: `phase-5-notifications-pdf`, from an up-to-date `main`.

## Step A (do this first, then STOP and wait for "start")
Reply with summary, conflicts, questions with defaults, plan. Ask / confirm at least:
1. **Who can export the PDF and when?** Proposal: anyone who can see the application (applicant, current and past approvers), and only when status is `approved`. Ask whether rejected applications can also be exported.
2. **Fonts.** `pdf-lib` standard fonts cannot draw non-Latin characters (for example Hindi names or comments) and would crash. Proposal: add `@pdf-lib/fontkit` and bundle an open-license Unicode font (for example Noto Sans, OFL) in the repo. This adds a dependency and a font file; ask for approval.
3. **Vercel limits.** Merging up to 10 attachments may be slow on the free plan. Proposal: build it on request, measure the time with the largest allowed case (10 files, 5 MB each) and report. If it is too slow, propose options instead of silently dropping attachments.
4. **`/verify/<id>` (optional).** Proposal: requires an EkLink sign-in and shows only: verification id, approver name and role, time, application subject and status. No attachments. Ask whether to build it now.
5. Confirm notification wording and that `urgent` adds an "URGENT" prefix.

## Tasks (after "start")

5.1 `src/lib/notifications.ts`: create notifications INSIDE the same transaction as the transition they belong to (no lost or duplicate notifications). Events exactly as `planning.md` §8: submitted/resubmitted → current approver; forwarded to next step → next approver and student; final approval / rejection → student; returned → student; withdrawn → current approver; new comment → the other party. Urgent applications: the next approver's notification is marked URGENT (this completes the Phase 4 urgent item).
5.2 `/notifications`: list (newest first, 20 per page), unread highlighted, click → marks as read and opens the application, "Mark all as read". Header bell with unread count (server-rendered; refresh on navigation; no realtime). API: `GET /api/notifications`, `POST /api/notifications/[id]/read`. A user can only read and mark their OWN notifications (others → 404).
5.3 Final PDF `GET /api/applications/[id]/pdf` (permission per Step A), built with `pdf-lib`:
- cover page: application id, type, subject, status, dates (IST), student details snapshot;
- timeline pages: every step and thread message in order; each approver action as a stamp box (name, designation, IST time, `ID: AP-XXXX-XXXX`, signature image if the step row has one);
- attachments merged: PDF pages copied in; JPG/PNG embedded one per page, scaled to fit; a small separator header "Attachment n: <original name>";
- a footer on EVERY page: "Internal electronic record. Not a legal digital signature.";
- if one attachment is corrupt, insert a placeholder page saying so and continue (never fail the whole export);
- filename `ApproveIt-<short id>.pdf`, correct `Content-Type`, `Cache-Control: no-store`.
5.4 "Download PDF" button on the application pages when allowed.
5.5 (If approved in Step A) `/verify/<id>` as described.

### Tests (required)
Notification matrix: every event in `planning.md` §8 → correct recipients, nothing extra; rollback test (if the transition fails, no notification exists); recipient isolation (404 for another user's notification); unread count; PDF: valid PDF bytes, more than one page, footer text present, non-Latin names do not crash, corrupt attachment handled, permission cases (outsider 404, wrong status refused), generation time measured and reported.

## Git for this phase
Commit and push after each of: notifications core (5.1), notification UI (5.2), PDF (5.3, 5.4), verify page (5.5), tests/docs.

## Do NOT
Send emails, SMS or push messages. Add realtime. Claim legal validity anywhere in the PDF or UI. Expose a PDF to someone who cannot see the application. Drop attachments silently.

## Verification gate
Protocol §6 with the rules audit on `rules.md` §2, §3, §4, §6. Then write the Phase 5 Report and STOP.
````

### Manual verification (Phase 5)

1. Student application bheje → **class teacher** ke login me bell pe **1** unread. Click → application khule, badge ghat jaye.
2. Teacher approve kare → **student** ko "forwarded to HOD" notification, **HOD** ko naya notification.
3. Urgent application → HOD ke notification pe **URGENT** likha ho.
4. Hold, reject, final approve, withdraw, naya comment: har case me sahi insaan ko notification (aur kisi extra insaan ko nahi).
5. Doosre student ke notification ki id se direct API call → 404.
6. Poori approved application pe **Download PDF** → PDF kholo:
   - pehla page: details sahi, student ka naam/PRN
   - timeline me har approver ka stamp (ID, IST time), signature agar thi
   - attachments (PDF + image) merge hue
   - **har page pe** "Internal electronic record. Not a legal digital signature."
7. Hindi naam ya Hindi comment wala application bana ke PDF nikalo → crash nahi, text sahi dikhe.
8. Pending application pe PDF button nahi (ya blocked) dikhna chahiye. Bahari insaan ke liye URL direct → 404.
9. Report me jo generation time likha hai (10 files wala case) use dekh lo. Agar bahut slow hai to mujhse poochho.

Sab theek to: **`verified, merge`**.

---

# PHASE 6: Hardening and go-live

**Kya hoga:** poori security audit, permission tests, docs final, production deploy checklist, EkLink admin ke saath final tests, `live`.

````
Read `MD Files/AGENT_PROTOCOL.md` first and follow it for this whole phase. Then re-read ALL docs fully: `MD Files/EkLink-Integration-ApproveIt.md`, `MD Files/rules.md`, `MD Files/planning.md`, `MD Files/tracker.md`, `MD Files/README.md`.

# PHASE 6: Hardening and go-live

Branch: `phase-6-hardening`, from an up-to-date `main`.

## Step A (do this first, then STOP and wait for "start")
Reply with summary, conflicts, questions with defaults, plan. Ask / confirm at least:
1. **Rate limiting** for login-related routes: serverless instances do not share memory. Propose options (simple in-memory per instance as best effort, or a small Supabase table counter) with trade-offs.
2. **Docs layout.** Proposal: move the docs to the standard layout (`README.md`, `rules.md`, `planning.md`, `tracker.md` in the repo root, EkLink spec in `docs/`, `prompt.md` and `AGENT_PROTOCOL.md` out of the public repo or into `docs/`) and fix the links. Ask for approval (this is the only phase where docs may be moved).
3. The final **production URL** and whether production should use a separate Supabase project from development (recommended once any real data is planned; dummy data only for now).
4. Confirm the role list to send to EkLink: `student, faculty, staff, hod, director, admin`.
5. Should the dummy seed data and dummy CSV stay in the repo? (They are fake, so normally yes.)

## Tasks (after "start")

6.1 **Permission matrix.** Create `docs/permission-matrix.md` (or the equivalent path after Step A answer 2): every rule of `rules.md` §2 and every test A1 to A12 → the automated test that covers it (file and test name). Any rule without an automated test gets one now.
6.2 **Secrets audit:** a script `scripts/check-secrets.mjs` that (a) greps tracked files for secret patterns, (b) scans the full git history (`git rev-list --all`) for the same patterns and for any committed `.env`, (c) after `npm run build`, searches `.next/static` and `.next/server` client chunks for the actual values of every server env variable (read from the environment, never printed). Report PASS/FAIL only.
6.3 **Logging audit:** list every `console.*` call and confirm none can print a token, code, secret, cookie, service key or full request/session object.
6.4 **Headers verification:** a script that starts the app and checks the response headers on `/`, an API route and `/auth/error` (nosniff, referrer policy, frame protection, CSP, no-store, no `X-Powered-By`).
6.5 `npm audit`: report high and critical findings. Do NOT run `npm audit fix --force`. Propose fixes and ask.
6.6 Rate limiting as agreed in Step A for `/auth/login`, `/auth/callback`, `/auth/refresh`.
6.7 **UX audit:** every screen has loading, empty and error states; custom `not-found` and `error` pages; layout works at 360 px width; plain simple English; the words "legally valid", "certified", "DSC" appear nowhere.
6.8 **Config audit:** diff `.env.example` against integration §4 and the Supabase vars; confirm no hard-coded URLs in `src/`; remove leftover test/diagnostic routes; confirm the 5 MB / 10 files / types constants are in one place.
6.9 **Docs:** finish `README.md` (Sign in with EkLink, local setup, migrations, seed, deployment, limitations). `tracker.md`: tick everything that is really done, fill the Notes column, update decisions and open questions. Do not touch the Result columns of tests that need EkLink.
6.10 **Go-live checklist** (write it in the chat, do not execute): Vercel environment variables (list names only), `EKLINK_REDIRECT_URI` must equal the registered callback exactly, production URL registered with the EkLink admin, Supabase migrations applied to the production project, seed/roles loaded, `APP_URL` correct, redeploy. Plus a ready-to-send message to the EkLink admin: final production URL, roles actually needed, request to switch ApproveIt to `live`.
6.11 Suggest a release tag `v1.0.0` for after the developer's final confirmation.

## Git for this phase
Commit and push after each of: tests+matrix (6.1), audit scripts (6.2 to 6.5), rate limit (6.6), UX+config (6.7, 6.8), docs (6.9, 6.10).

## Do NOT
Weaken any check to get a green result. Auto-fix dependency vulnerabilities with force. Deploy for the developer. Change the Result column of EkLink tests.

## Verification gate
Protocol §6, plus run the whole definition of done (`tracker.md` §2 and `rules.md` §8) and report each item. Then write the Phase 6 Report and STOP.
````

### Manual verification (Phase 6, go-live)

**Deploy:**
1. Vercel → Project → **Settings → Environment Variables**: `.env.example` ke saare variables production values ke saath daalo (`APP_URL` = final Vercel URL, `EKLINK_REDIRECT_URI` = `<APP_URL>/auth/callback`).
2. Final URL EkLink admin ko do (agar badla ho). Wo callback registry me update karega. **Exact match** zaroori hai.
3. Supabase production project me migrations chalao, seed/roles load karo.
4. Redeploy karo.

**Production pe test (EkLink admin ke saath):**
5. EkLink ke **12 tests** production URL pe dobara chalao, aur `tracker.md` me **Result** `Pass` likho.
6. **A1 se A12** manually ek baar chalao (ya jo automated nahi the).
7. Mobile phone se pura flow: apply → approve → PDF.
8. DevTools (Application + Network) me secret, token, service key **nahi** hone chahiye.
9. `git log -p | findstr /i "secret"` jaisa quick check, ya Antigravity ki `check-secrets` script ka PASS result dekho.
10. Agar kabhi secret commit hua tha to use **rotate** karao.

Sab pass ho to EkLink admin `live` kare, aur tum likho: **`verified, merge`**. Phir release tag `v1.0.0`.
