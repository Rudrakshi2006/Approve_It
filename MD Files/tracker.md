# ApproveIt: Tracker

**How to use:** tick tasks as they are finished (`- [x]`), add a changelog line, and record EkLink test results in §3. Antigravity must update this file after every task (see `rules.md` §0).

**Current phase:** 7, Employee applications (General & Leave with Balance)
**Overall status:** Phase 4 & Phase 5 merged to main. Working on Phase 7.
**Last updated:** 2026-10-30

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
- [x] Migrations: `application_types`, `applications`, `application_steps`, `attachments`
- [x] Seed `medical` chain (class teacher → HOD)
- [x] Student dashboard with 4 tabs (Medical active)
- [x] Medical form: class-teacher dropdown from `people` (faculty), attachments (≤10, PDF/JPG/PNG, 5 MB), comment, urgent
- [x] Attachment upload to private bucket, server-side validation, signed URLs
- [x] Applicant snapshot on submit
- [x] Step engine: resolve approver, transitions, current-approver check
- [x] Approver inbox: Pending / Approved / Rejected / On hold
- [x] Review screen with approve / reject / return + comment
- [x] Digital-verification stamp with unique ID (compulsory)
- [x] Student live-status page with full history
- [x] Unit tests: approver resolution and transitions
- [x] API tests: unauthenticated `401`, wrong user `403`

### Phase 3, Thread, hold, withdraw, signature
- [x] `application_messages` thread (single chronological log)
- [x] Return (hold) → student edits and resubmits into the same application
- [x] Withdraw (applicant only, while `in_review` or `returned`)
- [x] Profile page: semester confirm, optional signature upload (private bucket)
- [x] Stamp includes signature when present
- [x] Red theme digital verification stamp on rejection with decision recorded seal
- [x] Large aesthetic green tick and red cross badges for official stamp look
- [x] Approver review toggle checkbox to attach/omit profile signature image

### Phase 4, Other types
- [x] Seed `hackathon`, `re_ca`, `general` chains
- [x] Hackathon form: event name, dates, city/college, team size, role, proof
- [x] Re-CA form: subject, faculty, original CA date, reason, proof
- [x] General form: freeform reason, recipient picker
- [x] All 4 forms active on student dashboard
- [x] Role-based approvers (Exam Cell, Director) tested
- [x] Admin / HOD view: reassign approver, view department status
- [x] Strict date validations (Hackathon future-only, Re-CA past-only, Medical past-only)
- [x] Ramesh Pawar Admin Staff dedicated portal tabs (`Pending Verification`, `Forwarded / Done`)

### Phase 5, Notifications & PDF Export Dossier
- [x] In-app notification bell with real-time unread count and priority sorting
- [x] Official multi-page PDF export dossier with embedded approver signature images & verification stamps
- [x] Public verification portal (`/verify/[id]`) with tamper check
- [x] Discussion thread in-flow @mentions with targeted notification dispatch

### Phase 7, Employee applications & Leave ledger
- [x] 7.0 Docs updates (`rules.md`, `planning.md`, `tracker.md`, `README.md`)
- [ ] 7.1 `src/lib/dates.ts` strict `dd-mm-yyyy`, IST timezone & working days engine
- [ ] 7.2 Database migration `0005_phase7_faculty_applications.sql` & seeds
- [ ] 7.3 `src/lib/leave/` pure logic (`working-days.ts`, `balance.ts`, `deduct.ts`, `overlap.ts`)
- [ ] 7.4 Workflow engine extension (Director atomic deduction, forward-only HOD leave, return routing)
- [ ] 7.5 API endpoints (`POST /api/leave/preview`, employee submit, decision with signature checkbox)
- [ ] 7.6 Apply-side UI ("My Applications" General and Leave blocks with live balance card & preview)
- [ ] 7.7 Approver-side UI (3-section Approvals inbox, Leave review screen with balance & unpaid warning, forward-only panel)
- [ ] 7.8 Admin screens (`/admin/leave-balances`, `/admin/holidays`, `/admin/settings`)
- [ ] 7.9 Notifications & PDF export extension (balance snapshot, working days, excluded breakdown)
- [ ] 7.10 Comprehensive Vitest test suite (dates, working days, accrual, deduction, chains, permissions)

### Phase 6, Hardening & go-live
- [ ] EkLink handshake in production (all 12 tests in §3 green)
- [ ] Real CSV import in production (faculty, staff, students)
- [ ] Responsive design check (mobile approver flow)
- [ ] Empty states, loading skeletons, error toasts
- [ ] Handover: export/import guide for EkLink admin

---

## 2. Changelog

- **2026-10-30**: Phase 7 initiated on branch `phase-7-faculty-applications`. Updated docs, planning scope, and tracker.
- **2026-10-30**: Phase 4 and Phase 5 merged to `main`. Completed all 4 student workflows, strict date validations, DD-MM-YYYY formatting, discussion thread @mentions, admin staff dedicated portal, and official multi-page PDF export dossier with embedded signatures. All 100 tests passing.
- **2026-10-29**: Phase 3 merged to `main` (tag `phase-3-done`). Completed unified thread timeline, hold/return & resubmit flow, applicant withdrawal, profile semester snapshot confirmation, private signature image upload with drag-and-drop, red digital stamp for rejections, large green tick/red cross seal badges, and approver signature attachment toggle.
- **2026-10-29**: Phase 2 merged to `main` (tag `phase-2-done`). Real SIT Nagpur faculty and student IDs pre-seeded in Supabase.
- **2026-10-28**: Phase 1 merged to `main` (tag `phase-1-done`). Auth flow and security controls established.
- **2026-10-27**: Phase 0 merged to `main` (tag `phase-0-done`). Project initialization complete.
