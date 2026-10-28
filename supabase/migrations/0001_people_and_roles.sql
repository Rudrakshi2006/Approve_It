-- 0001_people_and_roles.sql
-- ApproveIt Initial Schema: people, app_roles, approver_assignments

create table people (
  login_id       text primary key,
  eklink_sub     uuid unique,
  name           text not null,
  email          text not null,
  eklink_role    text not null,
  department     text,
  batch          text,
  section        text,
  semester       int,
  signature_path text,
  updated_at     timestamptz not null default now()
);

create index idx_people_lower_email on people (lower(email));

create table app_roles (
  login_id text not null references people(login_id) on delete cascade,
  app_role text not null check (app_role in ('admin_staff', 'exam_cell', 'workflow_admin')),
  primary key (login_id, app_role)
);

create table approver_assignments (
  id bigint generated always as identity primary key,
  application_type  text not null,
  scope_key         text,
  step_key          text not null,
  approver_login_id text not null references people(login_id) on delete cascade
);

-- Row Level Security (RLS) enabled on all tables with zero policies
-- This ensures only the server with SUPABASE_SECRET_KEY can read and write data.
alter table people enable row level security;
alter table app_roles enable row level security;
alter table approver_assignments enable row level security;

-- Revoke all direct client access from anon and authenticated roles
revoke all on table people from anon, authenticated;
revoke all on table app_roles from anon, authenticated;
revoke all on table approver_assignments from anon, authenticated;
