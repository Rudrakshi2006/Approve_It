# ApproveIt: Agent Protocol

**Read this file at the start of EVERY session, before anything else.**
It tells you HOW to work. The other docs tell you WHAT to build.

---

## 1. Who is who

- **The developer** is one person, building ApproveIt alone. She decides. You write code.
- A separate planning assistant ("the brain") wrote the docs and the phase prompts. You never talk to it. If the docs are unclear, ask the developer.
- Talk to the developer in **short, simple English**. Explain what you are doing and why, in plain words. No jargon walls.

## 2. Files and where they are

All project docs are in the folder **`MD Files/`** (repo root is `Approve_It/`):

| File | Role |
|---|---|
| `MD Files/EkLink-Integration-ApproveIt.md` | EkLink auth/integration contract. **Authoritative for login, sessions, tokens, security.** Every MUST is mandatory. |
| `MD Files/rules.md` | Binding coding and security rules. |
| `MD Files/planning.md` | Scope, flows, data model, phases. |
| `MD Files/tracker.md` | Task tracker. You update it. |
| `MD Files/README.md` | Project README. You keep it current. |
| `MD Files/prompt.md` | Original brief. Background only. |
| `MD Files/AGENT_PROTOCOL.md` | This file. |

Do **not move or rename** the docs. The only docs you may edit are `tracker.md` and `README.md` (and this protocol only if the developer asks).

**Precedence:** EkLink's own `rules.md` (not in this repo) > `MD Files/rules.md` > `planning.md` > everything else. For auth specifically, the integration file is authoritative.
**If two files disagree, STOP and ask.** Never silently pick one.

The Next.js app lives in the **repo root** (`src/`, `package.json`, ...), never inside `MD Files/`.

## 3. Decisions already made (do not re-ask)

1. Phases follow `planning.md` / `tracker.md` (Phase 0 to 6).
2. Approval chains live in `application_types.chain` (JSON). There is no separate `workflows` table.
3. `app_roles.app_role` allows: `admin_staff`, `exam_cell`, `workflow_admin`.
4. General application chain = Class teacher → HOD, configurable (a data change, not a code change).
5. Up to **10 attachments for every application type**. PDF/JPG/PNG, 5 MB each (5 MB and types still to be confirmed with the college; keep these values in one config constant).
6. Class teacher is chosen by the student from a dropdown of all faculty. No further discussion.
7. HOD signs personally every time. No "HOD office" step.
8. Login only through EkLink. In-app notifications only. Dummy data only. No app-to-app calls.
9. Stamp is an internal record, not a legal digital signature. Never claim otherwise.

## 4. The working loop (every phase)

**Step A: Understand and plan (no code yet).**
Re-read the docs and the phase prompt. Reply with:
(a) a short summary of what you will build in this phase,
(b) conflicts or gaps you found in the docs,
(c) numbered **questions** (with your recommended default for each),
(d) a short plan (tasks in order, files you will create, git branch name).
Then **STOP and wait** for the developer to say **"start"**.

**Step B: Build, one task at a time.**
Take tasks in order. After each task: run checks, commit, push the branch, tick `tracker.md` (see §7). Do not start a later phase. Do not add features that are not in the phase prompt.

**Step C: Verification gate (§6).** Run it yourself, fully.

**Step D: Report (§8).** Then **STOP**. Wait for the developer to test manually and say **"verified, merge"** (or to ask for fixes).

## 5. Ask, do not assume

**You MUST stop and ask the developer when:**
- a requirement is unclear, missing, or two docs disagree;
- a choice changes data model, security, or user-visible behaviour and is not covered by the docs;
- you want to add a dependency that is not in the approved stack (`next`, `react`, `typescript`, `@supabase/supabase-js`, `jose`, `server-only`, `zod`, `pdf-lib`, plus test/lint tooling);
- a rule seems impossible to meet;
- something fails and the only fix would weaken a check;
- you are about to do a destructive action (see §9).

**How to ask:** numbered questions, each with your recommended default and one line of reasoning. Maximum about 5 per batch. Then wait. Do not ask things already listed in §3.
**Never** invent login IDs, URLs, secrets, college rules, or "temporary" workarounds. If something is unknown, make it **configurable** (a table row or an env var) and tell the developer what to fill in.

## 6. Verification gate (end of every phase)

You must actually **run** each item and report the real result. "Should work" is not a result.

1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass. Paste the final summary lines.
2. Every task in the phase prompt is done, or listed as **not done** with the reason.
3. **Rules audit:** go through the relevant items of `rules.md` §1, §2, §3, §4, §5, §7 and the integration file's R1 to R14. For each, say PASS / FAIL / N/A with the file path as evidence.
4. **Secret scan:** search the working tree and `git diff main...HEAD` for client secrets, service keys, tokens (`eyJ`), `sb_secret`, `service_role`, `.env` content. Confirm `git ls-files | grep -i "\.env"` shows only `.env.example`.
5. **Log scan:** search for `console.log` / `console.error` that could print tokens, cookies, codes, secrets, or whole request objects.
6. **Tests required by the phase** exist and pass.
7. `tracker.md` is updated; `git status` is clean; the branch is pushed.
8. For anything you could **not** test (needs a real EkLink login, a browser, a deployed URL), write **NOT TESTED** and give the developer exact manual steps.

If any check fails: fix it, rerun the whole gate. If you cannot fix it, say so honestly. **Never** mark a task done if its tests were not run. **Never** weaken a check to make it pass.

## 7. Git rules

- Branches: `main` is always working and is changed **only after the developer says "verified, merge"**. Work happens on `phase-N-<short-name>` branches created from an up-to-date `main`.
- **Never** commit directly to `main` (exception: the one-time initial commit in Phase 0). **Never** `git push --force`, `git reset --hard`, `git rebase` on pushed commits, `--no-verify`, or rewrite history.
- Commits are small and meaningful. Format: `feat|fix|chore|docs|test|refactor(scope): summary`. A commit that adds a dependency explains why in the body.
- Stage files **explicitly** (`git add <paths>`), not blindly. Before every commit run `git status` and `git diff --staged` and check: no `.env*` (except `.env.example`), no secrets, no stray build output, no `node_modules`.
- **Push the phase branch after every completed task** (`git push -u origin <branch>` the first time). This is the developer's backup.
- A task is "complete" only when its checks passed (§6 items 1, 4, 5 at minimum).
- **Merge** (only on "verified, merge"): `git checkout main && git pull`, `git merge --no-ff <branch>`, `git push origin main`, `git tag phase-N-done`, `git push origin phase-N-done`. Ask whether the developer prefers a GitHub Pull Request instead.
- **If a secret is ever committed or pushed:** stop immediately, tell the developer, and explain that it must be rotated (EkLink secret: tell the EkLink admin; Supabase key: regenerate in the dashboard). Do not try to hide it with a quiet follow-up commit.
- If the repo has no remote yet, ask for the GitHub URL. Recommend a **private** repo.

## 8. Phase report format

```
## Phase N Report
1. Built: bullet list with file paths
2. Decisions: what I decided, what the developer decided
3. Verification: table (check | command | result)
4. Rules audit: table (rule | PASS/FAIL/N/A | evidence)
5. NOT TESTED: list, each with manual steps for the developer
6. Known limitations / follow-ups (none may hide a security gap)
7. Git: branch, last commit hash, pushed (yes/no), tracker updated (yes/no)
```
End with: **"Waiting for your manual test. Say 'verified, merge' or tell me what failed."**

## 9. Hard stops (never do these)

- **Never ask for, type, or store the developer's EkLink password or any real credentials.** The developer does all real sign-ins herself.
- **Never ask the developer to paste secrets, tokens or cookies into the chat.** Tell her which variable to fill in `.env.local` herself. Never print the values of env variables.
- Never create a login page, demo mode, hard-coded account, role switcher or bypass flag, not even for local testing.
- Never use `NEXT_PUBLIC_` for anything sensitive. Never use the service key in client code.
- Never call other EkLink apps directly. Never use real student data.
- Never edit or delete `application_steps` rows, in code or SQL helpers.
- Never run destructive commands (`rm -rf` outside build folders, dropping tables, `git push --force`, `git reset --hard`) without asking first.
- Never run SQL against the developer's Supabase project yourself unless she gave you a CLI setup. Default: write migration files and tell her how to run them in the Supabase SQL editor.
- Never claim you tested something in a browser or against EkLink if you did not.

## 10. Engineering conventions (short)

- Next.js App Router, TypeScript strict, server-first. Dev port **3002** (`npm run dev`).
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`).
- Files that touch secrets or the DB start with `import "server-only"`.
- Business rules live in `src/lib/workflow/`, not in route handlers or components.
- Data access goes through a small repository layer (`src/lib/db.ts` + repos) so a common DB can replace it later. Components never call Supabase directly.
- Validate every request body/query with `zod` (reject unknown fields). Status codes: 401 not signed in, 403 signed in but not allowed, 404 not found or not visible, 422 invalid input. Never leak internals.
- Every screen has loading, empty and error states. Mobile-friendly. Simple English UI text.
- Time stored UTC, shown IST (`Asia/Kolkata`).
- Styling: Tailwind (from `create-next-app`) is fine. No other UI library without asking.
- No `any` without a comment. No TODO that hides a security gap.

## 11. Keeping `tracker.md` current

After each task: tick the checkbox, add a one-line changelog row (`| YYYY-MM-DD | what changed |`), update "Current phase" and "Last updated" (use today's real date). Record new decisions in the Decisions log. You may fill the **Notes** column of the test tables (for example "covered by unit tests"), but only the developer / EkLink admin fills the **Result** column.
