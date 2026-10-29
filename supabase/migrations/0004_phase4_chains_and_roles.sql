-- 0004_phase4_chains_and_roles.sql: Seed hackathon, re_ca, general application chains & approver assignments

-- 1. Upsert application types with their standard approval chains
insert into application_types (key, name, enabled, chain) values
(
  'medical',
  'Medical Leave',
  true,
  '[
    {
      "step_key": "class_teacher",
      "label": "Class Teacher",
      "resolver": { "kind": "applicant_selected" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    },
    {
      "step_key": "hod",
      "label": "HOD",
      "resolver": { "kind": "role_same_department", "role": "hod" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    }
  ]'::jsonb
),
(
  'hackathon',
  'Hackathon & External Competition',
  true,
  '[
    {
      "step_key": "admin_staff",
      "label": "Administration Staff",
      "resolver": { "kind": "app_role", "app_role": "admin_staff" },
      "can_reject": false,
      "can_return": false,
      "comment_required_on_forward": true,
      "attendance_required": true,
      "decision_label": "Forward"
    },
    {
      "step_key": "hackathon_incharge",
      "label": "Hackathon Incharge",
      "resolver": { "kind": "assignment", "scope_key": null },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    },
    {
      "step_key": "hod",
      "label": "HOD",
      "resolver": { "kind": "role_same_department", "role": "hod" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    },
    {
      "step_key": "director",
      "label": "Director",
      "resolver": { "kind": "role", "role": "director" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    }
  ]'::jsonb
),
(
  're_ca',
  'Re-Continuous Assessment (Re-CA)',
  true,
  '[
    {
      "step_key": "class_teacher",
      "label": "Course Faculty / Class Teacher",
      "resolver": { "kind": "applicant_selected" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    },
    {
      "step_key": "hod",
      "label": "HOD",
      "resolver": { "kind": "role_same_department", "role": "hod" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    },
    {
      "step_key": "exam_cell",
      "label": "Exam Cell",
      "resolver": { "kind": "app_role", "app_role": "exam_cell" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    }
  ]'::jsonb
),
(
  'general',
  'General Application',
  true,
  '[
    {
      "step_key": "class_teacher",
      "label": "Class Teacher / Mentor",
      "resolver": { "kind": "applicant_selected" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    },
    {
      "step_key": "hod",
      "label": "HOD",
      "resolver": { "kind": "role_same_department", "role": "hod" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true
    }
  ]'::jsonb
)
on conflict (key) do update set
  name = excluded.name,
  enabled = excluded.enabled,
  chain = excluded.chain;

-- 2. Ensure approver assignments (Dr. Sachin Harne T036 as Hackathon incharge)
delete from approver_assignments where application_type = 'hackathon' and step_key = 'hackathon_incharge';
insert into approver_assignments (application_type, step_key, approver_login_id, scope_key)
values ('hackathon', 'hackathon_incharge', 'T036', null);

-- 3. Ensure clean app_roles (remove duplicate exam_cell STA5002, keep real Exam Cell T009)
delete from app_roles where login_id = 'STA5002' and app_role = 'exam_cell';
insert into app_roles (login_id, app_role) values
('STA5001', 'admin_staff'),
('T009', 'exam_cell'),
('T001', 'workflow_admin'),
('T037', 'workflow_admin')
on conflict do nothing;
