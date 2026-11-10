-- 0006_eklink_sync.sql: EkLink sync mirror (SYNC_CONTRACT.md sections 4-6, SYNC_PLAN.md 4.4)
--
-- Additive only. Idempotent (safe to run more than once). Nothing is deleted.
--   1. people: new EkLink-owned columns (platform_role, member_type, codes, is_active, ...)
--   2. the 15 ApproveIt-only test accounts are flagged is_test = true (NOT deactivated / deleted)
--   3. directory_units mirror (organization / institute / department)
--   4. approver_jobs mirror (EkLink approver_assignments)
--   5. sync_state (single row)
--   6. every foreign key that references people(login_id) gets ON UPDATE CASCADE
--      (ON DELETE behaviour unchanged). The append-only triggers on application_steps and
--      leave_ledger are relaxed ONLY for a pure login_id rename, so the cascade can run.
--   7. app_settings.approver_source = { <application type>: 'legacy' | 'eklink' } (all 'legacy')
--   8. admin_remove_test_accounts(text[], boolean): step 5b helper, only DEFINED here (not run)
--
-- Undo: supabase/rollback/0006_eklink_sync_down.sql

begin;

-- ---------------------------------------------------------------------------
-- 1. people: new columns
-- ---------------------------------------------------------------------------
alter table people add column if not exists platform_role   text;
alter table people add column if not exists member_type     text;
alter table people add column if not exists org_code        text;
alter table people add column if not exists institute_code  text;
alter table people add column if not exists department_code text;
alter table people add column if not exists semester        int;
alter table people add column if not exists designation     text;
alter table people add column if not exists is_active       boolean not null default true;
alter table people add column if not exists is_test         boolean not null default false;
alter table people add column if not exists is_demo         boolean not null default false;
alter table people add column if not exists deactivated_at  timestamptz;
alter table people add column if not exists updated_at      timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'people_member_type_check' and conrelid = 'public.people'::regclass
  ) then
    alter table people
      add constraint people_member_type_check
      check (member_type is null or member_type in ('faculty', 'staff', 'student'));
  end if;
end $$;

create index if not exists idx_people_is_active       on people (is_active);
create index if not exists idx_people_is_test         on people (is_test) where is_test;
create index if not exists idx_people_department_code on people (org_code, institute_code, department_code);

-- ---------------------------------------------------------------------------
-- 2. Flag the 15 ApproveIt-only test accounts (step 5b removes them later, by script)
-- ---------------------------------------------------------------------------
update people
set is_test = true
where login_id in (
  'STU1001', 'STU1002', 'STU1003', 'STU1004', 'STU1005',
  'FAC2001', 'FAC2002', 'FAC2003', 'FAC2004', 'FAC2005', 'FAC2006',
  'STA5001', 'STA5002',
  'HOD3001',
  'DIR4001'
)
and is_test = false;

-- ---------------------------------------------------------------------------
-- 3. directory_units mirror
--    path: 'SIU' | 'SIU/SIT' | 'SIU/SIT/CSE' (computed by the app, unique)
-- ---------------------------------------------------------------------------
create table if not exists directory_units (
  id             bigint generated always as identity primary key,
  level          text not null check (level in ('organization', 'institute', 'department')),
  org_code       text not null,
  institute_code text,
  code           text not null,
  name           text not null,
  is_active      boolean not null default true,
  is_demo        boolean not null default false,
  path           text not null,
  updated_at     timestamptz not null default now()
);

create unique index if not exists idx_directory_units_path on directory_units (path);

alter table directory_units enable row level security;
revoke all on table directory_units from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. approver_jobs mirror (EkLink approver_assignments; never deleted, ended by valid_to)
-- ---------------------------------------------------------------------------
create table if not exists approver_jobs (
  eklink_id       uuid primary key,
  person_login_id text references people(login_id) on update cascade on delete set null,
  person_sub      uuid,
  title           text not null,
  scope_level     text not null check (scope_level in ('organization', 'institute', 'department')),
  org_code        text,
  institute_code  text,
  department_code text,
  scope_key       text,
  valid_from      date not null default current_date,
  valid_to        date,
  updated_at      timestamptz not null default now()
);

create index if not exists idx_approver_jobs_title      on approver_jobs (title);
create index if not exists idx_approver_jobs_person     on approver_jobs (person_login_id);
create index if not exists idx_approver_jobs_person_sub on approver_jobs (person_sub);

alter table approver_jobs enable row level security;
revoke all on table approver_jobs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. sync_state (single row, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists sync_state (
  id                smallint primary key default 1 check (id = 1),
  last_event_id     bigint not null default 0,
  last_pull_at      timestamptz,
  last_push_at      timestamptz,
  last_full_sync_at timestamptz,
  last_error        text,
  last_result       jsonb,
  updated_at        timestamptz not null default now()
);

insert into sync_state (id) values (1) on conflict (id) do nothing;

alter table sync_state enable row level security;
revoke all on table sync_state from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6a. Allow the append-only tables to receive a pure login_id rename (ON UPDATE CASCADE).
--     Every other UPDATE and every DELETE is still rejected exactly as before.
-- ---------------------------------------------------------------------------
create or replace function prevent_application_steps_mutation()
returns trigger as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'actor_login_id') = (to_jsonb(old) - 'actor_login_id') then
    return new; -- login_id rename cascaded from people
  end if;
  raise exception 'application_steps is append-only: updates and deletes are prohibited';
end;
$$ language plpgsql;

create or replace function prevent_leave_ledger_modification()
returns trigger as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'login_id') = (to_jsonb(old) - 'login_id') then
    return new; -- login_id rename cascaded from people
  end if;
  raise exception 'leave_ledger is append-only. UPDATE and DELETE operations are prohibited.';
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 6b. Recreate every FK that references people(login_id) with ON UPDATE CASCADE.
--     Found dynamically, so constraints added outside the migrations are covered too.
--     Known from 0001-0005: app_roles.login_id, approver_assignments.approver_login_id,
--     applications.applicant_login_id / class_teacher_login_id / current_approver_login_id,
--     application_steps.actor_login_id, application_messages.author_login_id,
--     attachments.uploaded_by, notifications.recipient_login_id, leave_ledger.login_id.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_cols text;
  v_on_delete text;
begin
  for r in
    select c.oid, c.conname, c.conrelid::regclass as tbl, c.conkey, c.confdeltype
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'public.people'::regclass
      and c.confupdtype <> 'c'
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord)
      into v_cols
    from unnest(r.conkey) with ordinality as k(attnum, ord)
    join pg_attribute a on a.attrelid = r.tbl and a.attnum = k.attnum;

    v_on_delete := case r.confdeltype
      when 'c' then 'cascade'
      when 'n' then 'set null'
      when 'd' then 'set default'
      when 'r' then 'restrict'
      else 'no action'
    end;

    execute format(
      'alter table %s drop constraint %I, add constraint %I foreign key (%s) references people(login_id) on update cascade on delete %s',
      r.tbl, r.conname, r.conname, v_cols, v_on_delete
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Approver source per application type (default: legacy for every type)
-- ---------------------------------------------------------------------------
insert into app_settings (key, value)
select 'approver_source', coalesce(jsonb_object_agg(key, 'legacy'), '{}'::jsonb)
from application_types
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Step 5b helper (NOT run by this migration): removes ApproveIt-only test accounts and
--    their test records in ONE transaction. Called only by scripts/remove-test-accounts.ts
--    after it has written a backup. p_apply = false is a dry run (counts only).
--    Refuses unless every id is flagged is_test, no open real application waits on a test
--    account, no real record references a test account, and a current Admin Staff job
--    (active, non-test person) exists. service_role only.
-- ---------------------------------------------------------------------------
create or replace function admin_remove_test_accounts(p_login_ids text[], p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_not_test text[];
  v_apps uuid[];
  v_open_waiting int;
  v_admin_staff int;
  v_foreign int;
  v_counts jsonb;
begin
  if p_login_ids is null or cardinality(p_login_ids) = 0 then
    raise exception 'admin_remove_test_accounts: no login ids given';
  end if;

  select array_agg(x) into v_not_test
  from unnest(p_login_ids) as x
  where not exists (select 1 from people p where p.login_id = x and p.is_test);
  if v_not_test is not null then
    raise exception 'refusing: not flagged is_test (or missing): %', array_to_string(v_not_test, ', ');
  end if;

  select coalesce(array_agg(a.id), '{}'::uuid[]) into v_apps
  from applications a
  where a.applicant_login_id = any(p_login_ids);

  select count(*) into v_open_waiting
  from applications a
  where a.status in ('in_review', 'returned')
    and not (a.id = any(v_apps))
    and a.current_approver_login_id = any(p_login_ids);
  if v_open_waiting > 0 then
    raise exception 'refusing: % open application(s) of real users wait on a test account', v_open_waiting;
  end if;

  select count(*) into v_admin_staff
  from approver_jobs j
  join people p on p.login_id = j.person_login_id
  where j.title = 'Admin Staff'
    and j.valid_from <= current_date
    and (j.valid_to is null or j.valid_to >= current_date)
    and p.is_active
    and not p.is_test;
  if v_admin_staff = 0 then
    raise exception 'refusing: no current Admin Staff approver job (EkLink) held by an active real person';
  end if;

  select
      (select count(*) from applications a
        where not (a.id = any(v_apps))
          and (a.class_teacher_login_id = any(p_login_ids) or a.current_approver_login_id = any(p_login_ids)))
    + (select count(*) from application_steps s
        where not (s.application_id = any(v_apps)) and s.actor_login_id = any(p_login_ids))
    + (select count(*) from application_messages m
        where not (m.application_id = any(v_apps)) and m.author_login_id = any(p_login_ids))
    + (select count(*) from attachments t
        where not (t.application_id = any(v_apps)) and t.uploaded_by = any(p_login_ids))
    + (select count(*) from leave_ledger l
        where l.login_id = any(p_login_ids) and l.application_id is not null
          and not (l.application_id = any(v_apps)))
    into v_foreign;
  if v_foreign > 0 then
    raise exception 'refusing: % record(s) of real users reference a test account', v_foreign;
  end if;

  v_counts := jsonb_build_object(
    'people', (select count(*) from people where login_id = any(p_login_ids)),
    'applications', cardinality(v_apps),
    'application_steps', (select count(*) from application_steps
                           where application_id = any(v_apps) or actor_login_id = any(p_login_ids)),
    'application_messages', (select count(*) from application_messages
                              where application_id = any(v_apps) or author_login_id = any(p_login_ids)),
    'attachments', (select count(*) from attachments
                     where application_id = any(v_apps) or uploaded_by = any(p_login_ids)),
    'notifications', (select count(*) from notifications
                       where recipient_login_id = any(p_login_ids) or application_id = any(v_apps)),
    'leave_ledger', (select count(*) from leave_ledger
                      where login_id = any(p_login_ids) or application_id = any(v_apps)),
    'app_roles', (select count(*) from app_roles where login_id = any(p_login_ids)),
    'approver_assignments', (select count(*) from approver_assignments
                              where approver_login_id = any(p_login_ids))
  );

  if not p_apply then
    return jsonb_build_object('dry_run', true, 'counts', v_counts);
  end if;

  delete from notifications where recipient_login_id = any(p_login_ids) or application_id = any(v_apps);
  delete from attachments where application_id = any(v_apps) or uploaded_by = any(p_login_ids);
  delete from application_messages where application_id = any(v_apps) or author_login_id = any(p_login_ids);

  alter table application_steps disable trigger trg_prevent_application_steps_mutation;
  delete from application_steps where application_id = any(v_apps) or actor_login_id = any(p_login_ids);
  alter table application_steps enable trigger trg_prevent_application_steps_mutation;

  alter table leave_ledger disable trigger trg_leave_ledger_append_only;
  delete from leave_ledger where login_id = any(p_login_ids) or application_id = any(v_apps);
  alter table leave_ledger enable trigger trg_leave_ledger_append_only;

  delete from applications where id = any(v_apps);
  delete from app_roles where login_id = any(p_login_ids);
  delete from approver_assignments where approver_login_id = any(p_login_ids);
  delete from people where login_id = any(p_login_ids);

  return jsonb_build_object('dry_run', false, 'counts', v_counts);
end;
$$;

revoke all on function admin_remove_test_accounts(text[], boolean) from public, anon, authenticated;
grant execute on function admin_remove_test_accounts(text[], boolean) to service_role;

commit;
