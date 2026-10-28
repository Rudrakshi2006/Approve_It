# PROMPT: Build ApproveIt (start here)

You are the lead developer for **ApproveIt**, a paperless multi-step approval app that is part of the **EkLink** college app suite (SIT Nagpur now, Symbiosis University later). I am the only developer on this app. Work step by step, and keep me informed.

## 0. Read these files FIRST, in this order (do not write code before reading all)

1. `EkLink-Integration-ApproveIt.md`: the auth/integration contract. **Authoritative for login, sessions, tokens, security.** Every **MUST** is mandatory. If anything conflicts with EkLink's own `rules.md`, EkLink's `rules.md` wins.
2. `rules.md`: ApproveIt's coding and security rules.
3. `planning.md`: scope, flows, data model, phases.
4. `tracker.md`: task tracker. Update it as you finish work.
5. `README.md`: keep it current (must include a "Sign in with EkLink" section).

If two files disagree, stop and ask me. Do not silently pick one.

## 1. Product summary

- ApproveIt = students submit applications; approvers review, sign ("digitally verified" stamp), comment, forward, return, or reject. Student sees live status.
- **Login happens ONLY in EkLink.** ApproveIt has no login page, no signup, no passwords, no demo accounts, no role switcher. Login = redirect to EkLink (Next.js App Router + `jose` + Supabase, as in section 8.4 of the integration file).
- ApproveIt has its **own Supabase DB** (RLS on every table, server uses service key only). Common DB with other apps comes later, so keep the data layer clean and replaceable.
- Other EkLink apps (TemplateOS, Attendie) are built by teammates. **Do not build app-to-app calls.**
- **Notifications are in-app only** (a notification tab). No email.
- Use **dummy data only**.

## 2. Student tabs and approval flows

Chains are **configuration (workflows table), not hard-coded**.

| Tab | Chain |
|---|---|
| Medical attendance consideration | Student → Class teacher (picked from dropdown of all faculty) → HOD (signs personally) → Done. Up to **10 attachments** (pdf/image). |
| Hackathon approval | Student → Admin staff (only adds attendance comment + forwards, **cannot reject**) → Hack-o-week incharge → HOD → Director |
| Re-CA application | Student → Class teacher → HOD → Exam Dept |
| General application | **Chain not decided yet. Ask me before building.** |

Notes:
- There is **no separate "HOD office" step**. The HOD signs personally every time. Currently there is only one HOD (HOD CSE).
- Student details (name, PRN, batch, semester, section) are auto-filled from the profile. Never ask the student to type them.
- Faculty dropdown list is maintained **inside ApproveIt** (requested and maintained separately), not from an EkLink directory. Pre-seed `people` from the EkLink CSV (R5).

## 3. Approver actions and behaviour

- Every approver can: **approve, reject, comment, hold / return to student for edits** (except Admin staff in the hackathon flow: no reject).
- Each application is a **Gmail-like single thread with a log** (append-only `application_steps`; never update or delete history).
- Student can **withdraw** an application and sees **live status** (where it is stuck).
- **Digitally verified stamp** (Adobe-style, includes ID + timestamp + `login_id`) is **compulsory** for every approver's approval. Signature image is **optional**; faculty uploads/draws their own in their profile; store in a **private** Supabase Storage bucket.
- The stamp is an **internal record, not a legal digital signature**. UI must never claim otherwise.
- **Final PDF export** of the completed application (with thread, stamps, signatures).
- No leave / faculty-absence handling.
- Urgent = a flag that notifies the next approver and sorts the queue. Never skip steps in code.

## 4. Non-negotiable engineering rules

- All EkLink and app URLs and secrets come from **env variables** (section 4 of the integration file). Provide `.env.example` with every variable and no values. `.env*` in `.gitignore` from the first commit.
- Server-side authorisation on **every** request. The signed-in `login_id` must equal the resolved approver of the current step. Never trust step/approver sent by the browser.
- `role` from the token = coarse access only. App permissions (admin_staff, workflow_admin, approver assignments) live in my DB.
- Never log tokens, codes, secrets or full cookies. Never return the EkLink token to the browser.
- Refresh EkLink token server-side near expiry; any refresh failure = destroy session. Session cap 8 hours.
- Error page with "Back to EkLink" link; no redirect loops.
- Security headers (R14).
- Stack: Next.js (App Router) + Supabase, TypeScript. Only extra auth dependency: `jose`.

## 5. Work plan (do in this order, one phase at a time)

**Phase 1: Foundation + auth (no features yet)**
1. Scaffold Next.js project, folder structure, `.gitignore`, `.env.example`, security headers.
2. Implement `src/lib/eklink.ts`, `session.ts`, `people.ts`, routes `/auth/login`, `/auth/callback`, `/auth/refresh`, `/auth/logout`, `/auth/error`, and the `proxy.ts` / middleware, per section 8.4.
3. Supabase schema (section 8.2) with RLS enabled on all tables + a seed script that loads `people` from a dummy CSV (`login_id, name, college_email, role, department`).
4. Make test checklist items 1 to 12 passable. Tell me which ones I need to test manually with the EkLink admin.

**Phase 2: Core workflow engine**
5. `workflows`, `application_types`, `approver_assignments` tables; chain resolver; server-side step guard; append-only step log.
6. Application create / submit / withdraw / return-and-resubmit.

**Phase 3: Student side**
7. Four tabs, auto-filled profile, attachments (max 10, pdf/image, size and type validation), live status, thread view.

**Phase 4: Approver side**
8. Queues (urgent first), approve/reject/comment/hold, stamp + optional signature, profile signature upload, in-app notifications.

**Phase 5: Output + polish**
9. Final PDF export, admin screens (faculty list, assignments), README, tracker, definition-of-done check (section 10).

After **each phase**: update `tracker.md`, summarise what was done, what I must test, and wait for my "go" before the next phase.

## 6. Open questions: ASK ME, do not assume

1. General application: what is the approval chain?
2. Semester rule (there is no semester claim in the token): derive from `batch` or store in my DB?
3. Hack-o-week incharge: one global person, or assigned per event?
4. Login IDs for admin staff and Exam Dept / exam cell.
5. The EkLink CSV and the final production URL (use a placeholder like `https://approveit-xyz.vercel.app` until given).

Where the answer is not yet known, build it **configurable** (a row in a table or an env var) so the answer is a data change, not a code change.

## 7. How to work with me

- Explain briefly in simple language what you are doing and why. I am building this alone.
- Before large changes or anything not covered by the files, show a short plan and wait for approval.
- Never skip a MUST to save time. If something blocks you, raise it instead of working around it.
- Keep commits small and meaningful. Never commit secrets.

**Start now:** read the files in section 0, then reply with (a) a 10-line summary of what you understood, (b) any conflicts you found between the files, and (c) your plan for Phase 1. Do not write code until I confirm.
