-- 0002_applications.sql: Applications, steps, attachments, messages, notifications, atomic transitions & storage

-- 1. Application Types
create table if not exists application_types (
  key text primary key,
  name text not null,
  enabled boolean not null default true,
  chain jsonb not null
);

-- 2. Applications Table
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  type text not null references application_types(key),
  subject text not null,
  applicant_login_id text not null references people(login_id),
  applicant_snapshot jsonb not null,
  class_teacher_login_id text references people(login_id),
  payload jsonb not null default '{}',
  status text not null check (status in ('draft','in_review','approved','rejected','returned','cancelled')),
  current_step int not null default 0,
  current_approver_login_id text references people(login_id),
  chain_snapshot jsonb not null,
  urgent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Application Steps (Immutable / Append-only)
create table if not exists application_steps (
  id bigint generated always as identity primary key,
  application_id uuid not null references applications(id),
  step_index int not null,
  step_key text not null,
  actor_login_id text not null references people(login_id),
  decision text not null check (decision in ('submitted','resubmitted','approved','rejected','returned','forwarded','withdrawn')),
  comment text,
  verification_id text unique,
  signature_path text,
  at timestamptz not null default now(),
  check (decision <> 'approved' or verification_id is not null)
);

-- Append-only trigger for application_steps
create or replace function prevent_application_steps_mutation()
returns trigger as $$
begin
  raise exception 'application_steps is append-only: updates and deletes are prohibited';
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_application_steps_mutation on application_steps;
create trigger trg_prevent_application_steps_mutation
before update or delete on application_steps
for each row
execute function prevent_application_steps_mutation();

-- 4. Application Messages (Thread)
create table if not exists application_messages (
  id bigint generated always as identity primary key,
  application_id uuid not null references applications(id),
  author_login_id text not null references people(login_id),
  body text not null,
  created_at timestamptz not null default now()
);

-- 5. Attachments Table
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  uploaded_by text not null references people(login_id),
  message_id bigint references application_messages(id),
  storage_path text not null,
  original_name text not null,
  mime text not null,
  size_bytes int not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);

-- 6. Notifications Table
create table if not exists notifications (
  id bigint generated always as identity primary key,
  recipient_login_id text not null references people(login_id),
  application_id uuid references applications(id),
  kind text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 7. Enable RLS and Revoke direct permissions on all tables
alter table application_types enable row level security;
alter table applications enable row level security;
alter table application_steps enable row level security;
alter table application_messages enable row level security;
alter table attachments enable row level security;
alter table notifications enable row level security;

revoke all on table application_types from anon, authenticated;
revoke all on table applications from anon, authenticated;
revoke all on table application_steps from anon, authenticated;
revoke all on table application_messages from anon, authenticated;
revoke all on table attachments from anon, authenticated;
revoke all on table notifications from anon, authenticated;

-- Indexes for performance
create index if not exists idx_applications_applicant on applications(applicant_login_id);
create index if not exists idx_applications_current_approver on applications(current_approver_login_id);
create index if not exists idx_applications_status on applications(status);
create index if not exists idx_application_steps_application on application_steps(application_id);
create index if not exists idx_attachments_application on attachments(application_id);

-- 8. Seed Medical Application Type
insert into application_types (key, name, enabled, chain)
values (
  'medical',
  'Medical Leave',
  true,
  '[
    {
      "step_key": "class_teacher",
      "label": "Class Teacher",
      "resolver": { "kind": "applicant_selected" },
      "can_reject": true,
      "comment_required_on_reject": true
    },
    {
      "step_key": "hod",
      "label": "HOD",
      "resolver": { "kind": "role_same_department", "role": "hod" },
      "can_reject": true
    }
  ]'::jsonb
)
on conflict (key) do update
set name = excluded.name, enabled = excluded.enabled, chain = excluded.chain;

-- 9. Storage Bucket for Attachments (Private)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- 10. Atomic Application Transition Function (Optimistic Lock)
create or replace function execute_application_transition(
  p_application_id uuid,
  p_expected_current_step int,
  p_expected_current_approver text,
  p_new_status text,
  p_new_step int,
  p_new_approver text,
  p_step_key text,
  p_decision text,
  p_comment text default null,
  p_verification_id text default null,
  p_signature_path text default null
) returns jsonb as $$
declare
  v_updated_count int;
begin
  -- 1. Optimistic locking check & update applications table
  update applications
  set status = p_new_status,
      current_step = p_new_step,
      current_approver_login_id = p_new_approver,
      updated_at = now()
  where id = p_application_id
    and status = 'in_review'
    and current_step = p_expected_current_step
    and current_approver_login_id = p_expected_current_approver;

  get diagnostics v_updated_count = row_count;

  if v_updated_count = 0 then
    return jsonb_build_object('success', false, 'error', 'conflict_or_not_found');
  end if;

  -- 2. Insert step audit log (append-only)
  insert into application_steps (
    application_id,
    step_index,
    step_key,
    actor_login_id,
    decision,
    comment,
    verification_id,
    signature_path,
    at
  ) values (
    p_application_id,
    p_expected_current_step,
    p_step_key,
    p_expected_current_approver,
    p_decision,
    p_comment,
    p_verification_id,
    p_signature_path,
    now()
  );

  return jsonb_build_object('success', true);
end;
$$ language plpgsql security definer;
