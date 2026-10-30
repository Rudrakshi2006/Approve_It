# PHASE 7: Faculty / Staff / HOD applications (General + Leave with balance)

**Order:** Phase 5 merged → **Phase 7** → Phase 6 (hardening and go-live). Phase 6 will audit Phase 7 too.

**Tumhe pehle se chahiye:**
- Phase 5 merged on `main`.
- EkLink test accounts: 1 faculty, 1 staff (department bhari hui), 1 HOD, 1 Director (sab `people` me seeded).
- Ek dummy **holidays list** (date + naam) aur har faculty/staff ka **Saturday group** (`odd` = 1st & 3rd Saturday working, `even` = 2nd & 4th Saturday working). Dummy chalega.

---

## Prompt to paste into Antigravity

````
Read `MD Files/AGENT_PROTOCOL.md` first and follow it for this whole phase. Then re-read `MD Files/rules.md`, `MD Files/planning.md`, `MD Files/tracker.md`, `MD Files/README.md` and the relevant parts of `MD Files/EkLink-Integration-ApproveIt.md`.

# PHASE 7: Faculty / Staff / HOD applications (General + Leave)

Branch: `phase-7-faculty-applications`, from an up-to-date `main`.

## Scope (decided by the developer)

Two new application categories for employees, each with its own chain (configuration, never hard-coded):

**A. General application** (for example MOM, Report, Event proposal, Other)
- Who applies: `faculty`, `staff` (chain: HOD → Director) and `hod` (chain: Director only). `director` can NOT apply.
- Form: category (dropdown), subject (REQUIRED), description/comment (optional), date (optional, dd-mm-yyyy; past and today allowed, FUTURE blocked), time (optional, HH:mm 24-hour; only meaningful with a date; if the date is today the time must not be later than now in IST), attachments (up to 10, same rules as before). No urgent flag.
- HOD step: Approve and forward (comment optional), Reject, Return (comment required on reject and return).
- Director step: Approve (final, comment optional), Reject, Return (comment required on reject and return).

**B. Leave application** (balance-based)
- Who applies: `faculty`, `staff` (chain: HOD → Director) and `hod` (chain: Director only). `director` can NOT apply.
- Form: leave type (Medical or Personal), from date and to date (dd-mm-yyyy; from date must be today or later in IST, past dates blocked; to date >= from date), subject (REQUIRED), description (REQUIRED), attachments (optional, same rules).
- HOD step is **forward-only** like the hackathon admin step: "Verify and forward" (stamped, decision `forwarded`), comment optional, NO reject. Return stays available (comment required).
- Director step: Approve, Reject, Return (comment required on reject and return; optional on approve). Approve is final.
- A returned application goes back to the SAME step that returned it after the applicant edits and resubmits (HOD returned → back to HOD; Director returned → back to Director).

**Leave balance rules**
- Two types only: `medical` and `personal`.
- Each person gets +1 medical and +1 personal for every calendar month. Unused leave carries forward. There is NO yearly reset. A cap of **12 per type** (24 total) applies, stored as a setting, not in code.
- Balance can NEVER go below 0 and is displayed as 0 at minimum. Having 0 balance does NOT stop a person from applying.
- Days counted = working days in [from, to] inclusive, for THAT applicant. Excluded: Sundays; dates in the `holidays` table (national holidays and college holidays); Saturdays that are off for the applicant's `saturday_group` (`odd` group works 1st and 3rd Saturdays, `even` group works 2nd and 4th; the other Saturdays are off for that person). 5th Saturday handling is a setting (default: off for everyone). No half-days. If the range has zero working days, reject with 422.
- Deduction happens ONLY when the Director gives the final approval, inside the same atomic transaction as the approval, from the chosen leave type: `deducted = min(balance, working_days)`, `unpaid = working_days - deducted`. Nothing is deducted on submit, forward, reject, return or withdraw. The step/ledger records `balance_before`, `deducted`, `unpaid`, `balance_after`.
- Overlap rule: a person cannot have two leave applications with overlapping dates in `in_review`, `returned` or `approved` state.

**Display rules**
- All dates shown anywhere (forms, lists, review screens, PDF) use `dd-mm-yyyy`. Stored internally as ISO dates. IST for "today".
- HOD and Director must see, highlighted and prominent on the leave review screen: the applicant's remaining **Medical** and **Personal** balance (current), the requested type, working days counted, which days were excluded and why, the balance after approval, and a clear warning chip if some days will be unpaid ("2 days will be unpaid").

**Signature tick box (all flows, including the student flows from earlier phases)**
- On every approver action panel (approve, forward, reject, return) show a checkbox "Include my signature". It is shown only if the approver has a signature in their profile and is **unticked by default**. The server adds `signature_path` to the step row only when `include_signature` is true AND the person has a signature; ticking without one → 422. This replaces the earlier auto-include behaviour. Old step rows are never changed (append-only).
- The "Digitally verified" stamp stays compulsory on every approver action. The applicant's own submission does not get a stamp (same as students).

**Screens**
- **Apply side** (faculty, staff, hod): a "My applications" area with TWO blocks: **General** and **Leave**. Each block: "New application" button + the person's own applications with status. The Leave block also shows the person's own balance card (Medical left, Personal left).
- **Approver side:** one "Approvals" area with up to three sections, each with the tabs **Pending action / Approved by you / Rejected by you / Returned by you** (and a counts dashboard):
  1. **Student applications** (the existing inbox; shown to class teachers, admin_staff, exam_cell, incharge, HOD, Director as today);
  2. **General (faculty and staff)**: shown to HOD and Director only;
  3. **Leave (faculty and staff)**: shown to HOD and Director only.
  A plain faculty who only approves student applications sees only section 1. HOD and Director see all three. Visibility rule unchanged: only applications currently or previously assigned to the user.
- Same live status page, thread, attachments and notifications as before.

**Out of scope for this phase:** cancelling an approved leave, delegation, half-days, urgent flag for these types, email.

## Step A (do this first, then STOP and wait for "start")
Reply with summary, conflicts, questions (with recommended defaults) and plan. Note that this phase changes scope: `rules.md` §2 says only students create applications and `planning.md` §2 lists "faculty-leave/delegation handling" as out of scope. The developer's intent: *approver absence and delegation* stays out of scope; *leave applications by employees* are now in scope. Ask / confirm at least:
1. **Type keys and chain selection.** Proposal: types `employee_general`, `employee_leave` (applicants faculty and staff: HOD → Director) and `hod_general`, `hod_leave` (applicant HOD: Director only). The server picks the key from the applicant's EkLink role and the chosen kind; the browser never sends a type key it controls. Each type stores `applicant_roles` in its config. Reuse `chain_snapshot`.
2. **Staff and HOD resolution.** The HOD is resolved by the applicant's `department`. If the applicant has no department, or zero or several HODs match: block submit with a clear message and guess nothing. Confirm.
3. **Data model proposal** (show the SQL in the plan, wait for approval): `people.saturday_group` (`odd`/`even`, nullable; a leave application is blocked with a clear message if it is null); `holidays(date primary key, name)`; `app_settings(key, value jsonb)` for cap per type (12), monthly accrual (1), fifth-Saturday rule, and the General categories list (MOM, Report, Event proposal, Other); `leave_ledger` (append-only, UPDATE/DELETE blocked by trigger, RLS on, revoke from anon/authenticated) with kinds `opening`, `accrual`, `deduction`, `adjustment`, a unique key on (person, type, period) for accruals, `application_id`, `note`, `created_by`, and fields to record `unpaid_days` and the before/after snapshot. Leave details (type, from, to, working_days, excluded days) and General details (category, date, time) live in `applications.payload` validated by zod and are SNAPSHOTTED at submit.
4. **Accrual method.** Proposal: no cron. Accruals are materialised lazily and idempotently: before every balance read and before every deduction (inside the same transaction), credit one row per missing month per type after the opening month, each `min(1, cap - currentBalance)`. The clock must be injectable for tests. Opening balance per person per type is set by an admin with an "as of" month (dummy seed: 6 medical + 6 personal so accrual is visible).
5. **Who can see a person's balance?** Proposal: the person, `workflow_admin`, and a current or past approver of that person's leave application. Nobody else.
6. **Time format** for the General form: 24-hour `HH:mm`. Confirm.
7. **Holidays source.** Proposal: admin screen + CSV import (`date,name` with dd-mm-yyyy). Ask for the dummy list or use a short dummy set.
8. **Leave overlap and recompute.** On resubmit after a return, the working days are recomputed on the server. Confirm.

## Tasks (after "start")

7.0 Docs (the developer approves editing these, and only these): update `rules.md` §2 ("Who may create applications": students for student types; `faculty`/`staff`/`hod` for the employee types; `hod` for the `hod_*` types; `director` never) and clarify that "no faculty-leave features" means approver absence/delegation; update `planning.md` §2, §3, §4, §10, §11, §13 (new Phase 7); add a Phase 7 section to `tracker.md` and the decisions log; update the README features and chains table. List every doc edit in the report.

7.1 `src/lib/dates.ts` (pure, no I/O): strict `dd-mm-yyyy` parse and format (real calendar dates only), ISO conversion, IST "today" and "now" with an injectable clock, weekday and "nth Saturday of the month" helpers, `isFuture`, `isPast`. Used everywhere dates are shown or validated.

7.2 Migration `000X_faculty_applications.sql` per the approved model: new columns/tables, RLS enabled on every new table with NO policies, `revoke all ... from anon, authenticated`, append-only trigger on `leave_ledger`, seeds for the four types (chains as in Scope) and for `app_settings`. Dummy holidays and dummy `saturday_group` values for seeded faculty/staff go into seed files, not code.

7.3 `src/lib/leave/` (pure logic + repo calls): `working-days.ts` (count and the excluded-days list with reasons), `balance.ts` (materialise accruals, read balance, clamp at 0, cap), `deduct.ts` (min(balance, days), unpaid, snapshot), `overlap.ts`. Everything unit-testable with a fake repo and a fake clock.

7.4 Workflow engine: extend chains/transitions only through config flags that already exist (`can_reject`, `comment_required_on_reject`, `comment_required_on_forward`, `decision_label`). The leave Director approval runs the deduction in the SAME atomic transaction with the same optimistic guard as other transitions, so a double click or two tabs can never deduct twice. A returned leave that is resubmitted does not touch the ledger.

7.5 API (zod strict, server decides everything):
- `POST /api/leave/preview` → working days, excluded days with reasons, current balance, projected balance, unpaid days (for the form's live preview). The submit endpoint recomputes everything on the server; it never trusts preview numbers from the browser.
- create/submit endpoints for General and Leave; roles allowed: `faculty`, `staff`, `hod`. `director` and `student` → 403.
- decision endpoint accepts only `{ action, comment, include_signature }`.

7.6 Apply-side UI: "My applications" with the General and Leave blocks, the two forms, balance card, live preview of days and unpaid warning, `dd-mm-yyyy` inputs with clear validation messages, status page with the existing live status, thread and attachments.

7.7 Approver-side UI: the three-section Approvals layout with the four tabs per section; General review screen; Leave review screen with the highlighted balance card and the unpaid warning; action panels per step config (HOD leave: "Verify and forward" and "Return" only; no Reject button, and the server enforces it); signature tick box on all action panels in every flow.

7.8 Admin screens (server-side `workflow_admin` check): `/admin/leave-balances` (list people with balances, set opening balance with as-of month, adjust ± with a required reason as a ledger row that can never push a balance below 0, set `saturday_group`), `/admin/holidays` (list/add/delete, CSV import), and a small settings view (cap, accrual, fifth-Saturday rule, General categories) with zod validation.

7.9 Notifications: reuse the Phase 5 events for the new types (submitted/resubmitted → current approver; forwarded → next approver and applicant; final approve/reject → applicant; return → applicant; withdrawn → current approver; comment → other party).

7.10 PDF: extend the Phase 5 export to both new categories. Cover shows the applicant (name, login id, role, department), category or leave type, dates in dd-mm-yyyy, subject and description. Leave PDFs also show working days, the excluded days, and the balance snapshot (before / deducted / unpaid / after). Timeline with the same stamp pattern ("Digitally verified by ..., IST time, ID"), the signature image only for steps where `include_signature` was used, attachments merged, and the footer on every page: "Internal electronic record. Not a legal digital signature." Same permission and status rules as Phase 5.

### Tests (required)
- `dates`: strict dd-mm-yyyy parsing (31-02-2026, 1-1-2026, 2026-01-01 rejected), IST midnight boundaries, "today" allowed / past blocked for leave, "future" blocked / today allowed for General, time later than now today blocked.
- `working-days` worked cases with a fixed calendar. Example for November 2026 (1 Nov is a Sunday; Saturdays fall on 7, 14, 21, 28) with a holiday on 05-11-2026: range 02-11-2026 to 09-11-2026 = **6 days for the `odd` group** and **5 for `even`**; range 13-11-2026 to 16-11-2026 = **2 for `odd`** and **3 for `even`**; a range with only Sundays/holidays → 422; 5th Saturday follows the setting.
- `balance`: accrual +1 per month per type, idempotent when run twice, cap 12, never below 0, injectable clock, accrual materialised before deduction.
- `deduct`: balance 2 and 6 working days → deducted 2, unpaid 4, balance 0; balance 10 and 3 days → deducted 3, unpaid 0; ledger rows and snapshot correct; no deduction on submit/forward/reject/return/withdraw; resubmit after a return does not deduct; two concurrent Director approvals → exactly one deduction.
- Chains end-to-end in memory for all four new types, with return at each step and resubmission to the same step; HOD leave step cannot reject (403, on the server); Director cannot create applications (403); student cannot use the employee endpoints (403); applicant without department or without `saturday_group` → clear 422.
- Overlap rule; balance visibility (outsider → 404/403); signature tick box (unticked → no `signature_path`; ticked without a saved signature → 422; ticked with one → path stored); `leave_ledger` UPDATE/DELETE blocked; admin screens 401/403; holiday CSV validation.
- PDF: valid for both categories, shows dd-mm-yyyy dates and the balance snapshot, footer on every page, permission cases.
- Re-run and keep green ALL earlier tests (A1 to A12 and the Phase 1 EkLink tests).

## Git for this phase
Commit and push after each of: docs (7.0), dates (7.1), migration+seeds (7.2), leave logic (7.3), engine (7.4), API (7.5), apply UI (7.6), approver UI (7.7), admin (7.8), notifications and PDF (7.9, 7.10), tests/docs.

## Do NOT
Let the balance go below 0. Deduct before the Director's final approval. Hard-code holidays, Saturday groups, caps, categories or chains. Trust a day count, balance or type key coming from the browser. Let a director apply. Add a reject option on the HOD leave step (not even hidden). Show another person's balance to someone who has no link to that application. Claim legal validity anywhere. Use date formats other than dd-mm-yyyy in the UI.

## Verification gate
Protocol §6, with the rules audit on `rules.md` §2 (every bullet), §3, §4, §6, §7. Add to the report a table: each Scope bullet above → where it is implemented and which test covers it. Then write the Phase 7 Report and STOP.
````

---

## Manual verification (Phase 7), tumhare liye

**Setup:**
1. Supabase SQL Editor me naya migration (`000X_faculty_applications.sql`) run karo, phir `npm run seed:people -- --yes` (aur jo naye seed scripts bane unke commands jo Antigravity bataye).
2. Admin (`workflow_admin`) login → `/admin/holidays` me ek dummy holiday daalo: **05-11-2026**.
3. `/admin/leave-balances`: faculty ka Saturday group `odd` set karo, Medical **2** aur Personal **6** (as-of pichla mahina). Doosre faculty (ya staff) ka group `even`.

**General application (faculty):**
4. Faculty login → My applications → **General** block → New. Category dropdown me MOM, Report, Event proposal, Other.
5. Subject khaali chhodke submit → error. Date `31-02-2026` → error. Future date → error. Aaj ki date → ok. Aaj ki date ke saath abhi se aage ka time → error. Date aur time dono khaali → ok.
6. Submit → HOD login → Approvals → **General (faculty and staff)** → Pending action me dikhe. Approve and forward (comment optional) → stamp → Director ke paas.
7. Director ne **Return** kiya (comment ke saath) → faculty edit karke resubmit → wapas **Director ke paas** hi aaye.
8. Director approve → faculty ko **Approved**, 2 stamps.
9. Staff account se bhi General bhejo → HOD ke paas jaye. **HOD** khud bheje → seedha Director ke paas. **Director** login karke apply ka option nahi dikhna chahiye, API pe bhi 403.

**Leave (faculty):**
10. Leave block pe apna balance card dikhe: Medical 2, Personal 6.
11. Form: Medical, from **02-11-2026**, to **09-11-2026**. Live preview: **odd group = 6 working days** (5 Nov holiday, 8 Nov Sunday excluded, 7 Nov 1st Saturday working). Same range `even` group wale account se: **5 days**.
12. Range `13-11-2026` se `16-11-2026`: odd = **2**, even = **3**.
13. Aaj se pehle ki date → error. Aaj ki date (30-10-2026) → allowed. Sirf Sunday wali range → error "no working days". Date format sab jagah **dd-mm-yyyy**.
14. Subject ya description khaali → error. Balance 0 ho tab bhi apply ho jana chahiye.
15. Wahi dates wali doosri leave dobara bhejo → overlap error.
16. Submit → **HOD** login → Approvals → **Leave** → application kholo: **Medical aur Personal balance bada aur highlighted** dikhe, requested days (6), "After approval: Medical 0", aur warning "**4 days will be unpaid**" (kyunki medical balance 2 hai). **Reject button nahi** hona chahiye. "Verify and forward" dabao (comment optional) → stamp.
17. **Director** login → wahi balance card dikhe → **Approve**. Ab faculty ka Medical balance **0** dikhe (kabhi negative nahi), Personal waisa hi 6. Ledger/history me deducted 2, unpaid 4.
18. Naya leave (Personal, 3 din) → Director **Reject** karo → balance **nahi** badla. Ek aur leave → HOD **Return** (comment ke saath) → faculty edit + resubmit → wapas **HOD ke paas** aaye. Balance tab bhi nahi badla.
19. Ek leave Withdraw karo → balance nahi badla.
20. Doosre faculty ke login se pehle faculty ka leave application URL kholo → 404, aur uska balance nahi dikhna chahiye.

**Signature tick box:**
21. Approver ke profile me signature upload hai. Approve karte waqt **"Include my signature"** (default unticked). Bina tick → stamp me signature nahi. Tick → stamp me aaye. Signature wale ke bina approver ko checkbox hi nahi dikhna chahiye. Student application ke approval me bhi yahi behaviour ho.

**Layout aur PDF:**
22. Plain faculty (sirf class teacher) ko Approvals me sirf **Student applications** dikhe. HOD aur Director ko teeno sections, har ek me Pending action / Approved by you / Rejected by you / Returned by you.
23. Approved General aur Leave ka **Download PDF**: dd-mm-yyyy dates, leave type, working days, balance (before / deducted / unpaid / after), har approver ka stamp (ID + IST time), signature sirf jahan tick kiya tha, har page pe "Internal electronic record. Not a legal digital signature."
24. Notifications: har step par sahi insaan ko notification, kisi extra ko nahi.
25. **Accrual check:** `/admin/leave-balances` me ek person ka opening balance pichle **mahine** ka as-of set karo (Medical 6) → balance **7** dikhe (is mahine ka +1). Opening **12** rakho → 12 hi rahe (cap).

Sab theek to: **`verified, merge`**. Uske baad Phase 6 (hardening).
