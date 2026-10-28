# ApproveIt: Planning

Paperless, multi-step approvals with digital verification and live tracking, for SIT Nagpur (later Symbiosis University). ApproveIt is one app inside the **EkLink** suite (with TemplateOS and Attendie).

Companion files: `rules.md` (binding rules), `tracker.md` (progress), `docs/EkLink-Integration-ApproveIt.md` (EkLink spec).

---

## 1. Problem and goal

Today a student prints a form, fills it, gets the class teacher's signature, the class teacher takes it to the HOD office, then it goes to the exam cell. The process is slow and the student cannot see where the paper is.

**Goal:** the student submits once online; each authority approves, rejects, comments or sends it back online; the student sees the live status and the complete history.

## 2. Scope

**In scope (v1):** four application types (Medical, Hackathon, Re-CA, General), configurable approval chains, comments and hold/return, Gmail-style thread, attachments, digital-verification stamp, optional signature, in-app notifications, withdraw, live status, faculty dashboards, final PDF export (phase 5).

**Out of scope:** own login/signup, email or SMS notifications, faculty-leave/delegation handling, legal digital signatures, automatic attendance from Attendie (needs app-to-app contract), real student data, preview-deployment sign-in.

## 3. People and roles

| Who | EkLink role | ApproveIt designation |
|---|---|---|
| Student | `student` | none |
| Class teacher | `faculty` | chosen by the student from a dropdown of all faculty |
| Admin (hackathon attendance) | `staff` | `app_roles.admin_staff` |
| Hack-o-week incharge | `faculty` | `approver_assignments` (step `hackathon_incharge`) |
| HOD (currently HOD CSE) | `hod` | resolved by role + same department; the HOD signs every time personally |
| Director | `director` | resolved by role |
| Exam Dept | `staff` | `app_roles.exam_cell` |
| Workflow admin | `admin` / `staff` | `app_roles.workflow_admin` |

Allowed EkLink roles for the app: `student, faculty, staff, hod, director, admin`.

## 4. Application types and chains

| Type | Chain | Notes |
|---|---|---|
| **Medical attendance consideration** | Student → Class teacher → HOD | Student picks class teacher from dropdown. |
| **Hackathon approval** | Student → Admin → Hack-o-week incharge → HOD → Director | Admin step is **forward-only**: adds attendance comment, cannot reject. |
| **Re-CA application** | Student → Class teacher → HOD → Exam Dept | |
| **General application** | Student → Class teacher → HOD (default, see open questions) | Configurable. |

All details (hackathon info, medical proof, Re-CA reason) go in the **attachments**; the form itself is small: type, subject, class teacher (where needed), up to 10 attachments, optional comment, optional "urgent".

## 5. Workflow rules

- At every approval step the approver may: **Approve** (stamp), **Reject** (comment required, not allowed on forward-only steps), **Hold / Return to student** (comment required), or add a comment.
- **Hold** sets status `returned`; the student edits (adds attachments, replies in the thread) and **resubmits into the same application and the same thread**. After resubmission the application goes back to the step that returned it.
- **Withdraw:** the student can withdraw while `in_review` or `returned`; status becomes `cancelled`.
- **Urgent:** flag that notifies the next approver and sorts the queue. No step is ever skipped in code.
- Final status `approved` when the last step approves; `rejected` ends the application.

### State machine

```
draft ─submit→ in_review ─approve (not last)→ in_review (next step)
                         ─approve (last)────→ approved
                         ─reject────────────→ rejected
                         ─return (hold)─────→ returned ─resubmit→ in_review (same step)
in_review | returned ─withdraw→ cancelled
```

## 6. Digital verification stamp

Every approval carries a compulsory visual stamp, styled like a document-verification badge:

```
Digitally verified by Dr. X (HOD, CSE)
28 Oct 2026, 3:42 PM IST
ID: AP-7F3K-92QD
```

- A **signature image is optional**; if the approver has uploaded one in their profile it appears next to the stamp.
- The ID is random and unique, stored with the step record. A verify page (`/verify/<id>`) is a phase 5 option.
- This is an **internal record, not a legal digital signature**. The UI and the PDF must say so (footer line on the PDF).

## 7. Student details (auto-filled)

Shown to every approver with each application: **name, PRN, batch, semester, section, department, application type.**
Source: EkLink token (`name`, `login_id` = PRN, `batch`, `section`, `department`). **Semester is not in the token**: derive from `batch` with a documented rule or let the student confirm it in their profile (stored in `people.semester`). The values are **snapshotted** into the application on submit.

## 8. Notifications (in-app only)

| Event | Notified |
|---|---|
| Submitted / resubmitted | Current approver |
| Forwarded to next step | Next approver, student |
| Approved (final) / rejected | Student |
| Returned (hold) | Student |
| Withdrawn | Current approver |
| New comment | The other party |

Notification tab with unread badge. Simple fetch on open and on navigation is enough; no realtime required.

## 9. Tech stack

Next.js (App Router) + TypeScript, Supabase (own project, RLS on, server uses `SUPABASE_SECRET_KEY`), `jose` for JWT, `zod` for validation, `pdf-lib` for PDF export. Hosted on Vercel (one stable production URL, `localhost:3002` for development).

Auth: EkLink one-time-code flow exactly as in `docs/EkLink-Integration-ApproveIt.md` §5 and §8.4 (login, callback, refresh, logout routes, `session.ts`, `eklink.ts`, `people.ts`, `proxy.ts`, `/auth/error`).

## 10. Data model

All tables: RLS enabled, no policies; only the server (service key) reads/writes.

```sql
create table people (
  login_id     text primary key,            -- PRN or staff ID
  eklink_sub   uuid unique,                 -- attached on first sign-in
  name text not null, email text not null,
  eklink_role  text not null,
  department   text, batch text, section text,
  semester     int,                         -- derived or student-confirmed
  signature_path text,                      -- optional, private bucket
  updated_at   timestamptz not null default now()
);

create table app_roles (
  login_id text not null references people(login_id),
  app_role text not null check (app_role in ('admin_staff','exam_cell','workflow_admin')),
  primary key (login_id, app_role)
);

create table approver_assignments (
  id bigint generated always as identity primary key,
  application_type text not null,
  scope_key text,                           -- event/club id; null = default
  step_key text not null,                   -- e.g. 'hackathon_incharge'
  approver_login_id text not null references people(login_id)
);

create table application_types (
  key text primary key,                     -- 'medical' | 'hackathon' | 're_ca' | 'general'
  name text not null,
  enabled boolean not null default true,
  chain jsonb not null                      -- ordered steps, see below
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  type text not null references application_types(key),
  subject text not null,
  applicant_login_id text not null references people(login_id),
  applicant_snapshot jsonb not null,        -- name, PRN, batch, semester, section, department
  class_teacher_login_id text references people(login_id),
  payload jsonb not null default '{}',      -- comment from student, extras
  status text not null check (status in ('draft','in_review','approved','rejected','returned','cancelled')),
  current_step int not null default 0,
  current_approver_login_id text references people(login_id),  -- resolved on the server
  urgent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table application_steps (            -- APPEND-ONLY history
  id bigint generated always as identity primary key,
  application_id uuid not null references applications(id),
  step_index int not null, step_key text not null,
  actor_login_id text not null,
  decision text not null check (decision in
    ('submitted','resubmitted','approved','rejected','returned','forwarded','withdrawn')),
  comment text,
  verification_id text unique,              -- for approved/forwarded/rejected/returned by approvers
  signature_path text,                      -- optional
  at timestamptz not null default now()
);

create table application_messages (         -- the Gmail-style thread
  id bigint generated always as identity primary key,
  application_id uuid not null references applications(id),
  author_login_id text not null references people(login_id),
  body text not null,
  created_at timestamptz not null default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  uploaded_by text not null references people(login_id),
  message_id bigint references application_messages(id),
  storage_path text not null,               -- generated id, never the original name
  original_name text not null, mime text not null, size_bytes int not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz                    -- soft remove, only before resubmit
);

create table notifications (
  id bigint generated always as identity primary key,
  recipient_login_id text not null references people(login_id),
  application_id uuid references applications(id),
  kind text not null, message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
```

### Chain config (`application_types.chain`)

```json
[
  { "step_key": "class_teacher", "label": "Class Teacher",
    "resolver": { "kind": "applicant_selected" },
    "can_reject": true, "comment_required_on_reject": true },
  { "step_key": "hod", "label": "HOD",
    "resolver": { "kind": "role_same_department", "role": "hod" },
    "can_reject": true }
]
```

Resolver kinds: `applicant_selected`, `role_same_department`, `role`, `app_role`, `assignment`.
Hackathon example: `admin_staff` (`app_role`, `can_reject:false`, attendance comment) → `hackathon_incharge` (`assignment`) → `hod` → `director`.

## 11. Pages and routes

**Auth (from the EkLink spec):** `/auth/login`, `/auth/callback`, `/auth/refresh`, `/auth/logout`, `/auth/error`.

**Student:** `/` dashboard (tabs: Medical, Hackathon, Re-CA, General) · `/apply/[type]` form · `/applications/[id]` live status + thread + attachments (edit/resubmit when returned, withdraw) · `/notifications` · `/profile` (details, semester, optional signature).

**Approver (faculty/staff/hod/director):** `/inbox` with sidebar tabs Dashboard, Pending, Approved, Rejected, On hold · `/inbox/[id]` review screen (student details, attachments, thread, actions) · `/notifications` · `/profile`.

**Workflow admin:** `/admin/assignments`, `/admin/people` (CSV import), `/admin/types` (view/edit chains).

## 12. Folder structure

```
src/
  app/
    auth/{login,callback,refresh,logout,error}/
    (student)/ …   (approver)/inbox/ …   admin/ …
    api/applications/…  api/notifications/…  api/attachments/…
  lib/
    eklink.ts  session.ts  people.ts  db.ts  validate.ts
    workflow/   resolve-approver.ts  transitions.ts  chains.ts
    stamp/      verification-id.ts  render-stamp.ts
    storage.ts  notifications.ts
  proxy.ts
docs/EkLink-Integration-ApproveIt.md
supabase/ migrations/*.sql   seed/*.sql
```

## 13. Phases

| Phase | Deliverable |
|---|---|
| **0. Setup** | Repo, `.gitignore`, `.env.example`, Supabase project, Vercel project, EkLink registration request, docs in repo. |
| **1. Auth & people** | EkLink login/callback/refresh/logout, session, `people` table + CSV import, `/auth/error`, security headers. EkLink tests 1–12 pass. |
| **2. Medical flow end-to-end** | Application form with class-teacher dropdown, attachments, step engine, class teacher + HOD inbox, approve/reject/return, student live status, stamp. |
| **3. Thread, hold, withdraw, signature** | Gmail-style thread, resubmit into same application, withdraw, optional signature in profile. |
| **4. Other types** | Hackathon chain (forward-only admin), Re-CA, General, assignments admin screen. |
| **5. Notifications & PDF** | Notification tab, unread badge, final PDF export (cover + timeline + stamps + merged attachments), optional `/verify/<id>`. |
| **6. Hardening & go-live** | Full permission tests, README, EkLink checklist, `live` switch, URL and roles confirmed with EkLink admin. |

## 14. Open questions

1. **General application** chain: default is Class teacher → HOD. Confirm.
2. **Semester:** derive from `batch` (agree the rule) or student-confirmed field?
3. **Hack-o-week incharge:** one global person or per event/club (`scope_key`)?
4. **Exam cell and Admin staff:** who are the `login_id`s to seed into `app_roles`?
5. **Faculty/staff CSV:** get the same CSV the EkLink admin imported (`login_id, name, college_email, role, department`).
6. **Production URL** and the final role list to send to the EkLink admin.
7. **File limits:** 10 files, 5 MB each, PDF/JPG/PNG; confirm with the college.
8. **Multiple HODs** after Symbiosis rollout: HOD resolved by department; define the rule if a department has none or several.
