-- 0006_eklink_sync_down.sql: undo 0006_eklink_sync.sql
--
-- Drops the sync mirror tables and the new people columns, restores the strict append-only
-- triggers and the original FK behaviour (ON UPDATE NO ACTION). Existing columns that 0006
-- only "ensured" (semester, designation, updated_at) are kept, because they pre-date 0006.
-- Run only if no login_id has been renamed through the cascade since 0006 was applied
-- (otherwise the renamed values simply stay; nothing is lost).

begin;

-- 8. step 5b helper function
drop function if exists admin_remove_test_accounts(text[], boolean);

-- 7. approver_source setting
delete from app_settings where key = 'approver_source';

-- 6b. FKs referencing people(login_id): back to ON UPDATE NO ACTION (ON DELETE unchanged)
do $$
declare
  r record;
  v_cols text;
  v_on_delete text;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, c.conkey, c.confdeltype
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'public.people'::regclass
      and c.confupdtype = 'c'
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
      'alter table %s drop constraint %I, add constraint %I foreign key (%s) references people(login_id) on delete %s',
      r.tbl, r.conname, r.conname, v_cols, v_on_delete
    );
  end loop;
end $$;

-- 6a. strict append-only triggers (as in 0002 / 0005)
create or replace function prevent_application_steps_mutation()
returns trigger as $$
begin
  raise exception 'application_steps is append-only: updates and deletes are prohibited';
end;
$$ language plpgsql;

create or replace function prevent_leave_ledger_modification()
returns trigger as $$
begin
  raise exception 'leave_ledger is append-only. UPDATE and DELETE operations are prohibited.';
end;
$$ language plpgsql;

-- 3-5. mirror tables
drop table if exists sync_state;
drop table if exists approver_jobs;
drop table if exists directory_units;

-- 1-2. people columns added by 0006
drop index if exists idx_people_is_active;
drop index if exists idx_people_is_test;
drop index if exists idx_people_department_code;
alter table people drop constraint if exists people_member_type_check;
alter table people drop column if exists platform_role;
alter table people drop column if exists member_type;
alter table people drop column if exists org_code;
alter table people drop column if exists institute_code;
alter table people drop column if exists department_code;
alter table people drop column if exists is_active;
alter table people drop column if exists is_test;
alter table people drop column if exists is_demo;
alter table people drop column if exists deactivated_at;

commit;
