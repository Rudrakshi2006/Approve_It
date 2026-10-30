-- 0005_phase7_faculty_applications.sql: Employee General & Leave workflows, Leave Ledger, Saturday groups, Holidays & App Settings

-- 1. Add saturday_group to people table
ALTER TABLE people 
  ADD COLUMN IF NOT EXISTS saturday_group TEXT CHECK (saturday_group IN ('odd', 'even'));

-- 2. Holidays Master Table
CREATE TABLE IF NOT EXISTS holidays (
  date DATE PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON holidays FROM anon, authenticated;

-- Seed dummy holiday for testing (05-11-2026)
INSERT INTO holidays (date, name) 
VALUES ('2026-11-05', 'College Foundation Day / Holiday')
ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name;

-- 3. Dynamic App Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_settings FROM anon, authenticated;

-- Seed default application settings
INSERT INTO app_settings (key, value) VALUES
  ('leave_cap_per_type', '12'::jsonb),
  ('monthly_accrual', '1'::jsonb),
  ('fifth_saturday_working', 'false'::jsonb),
  ('general_categories', '["MOM", "Report", "Event proposal", "Other"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 4. Append-Only Leave Ledger Table
CREATE TABLE IF NOT EXISTS leave_ledger (
  id BIGSERIAL PRIMARY KEY,
  login_id TEXT NOT NULL REFERENCES people(login_id),
  leave_type TEXT NOT NULL CHECK (leave_type IN ('medical', 'personal')),
  kind TEXT NOT NULL CHECK (kind IN ('opening', 'accrual', 'deduction', 'adjustment')),
  period TEXT, -- 'YYYY-MM' for monthly accruals
  days NUMERIC(4,1) NOT NULL,
  unpaid_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  balance_before NUMERIC(4,1) NOT NULL,
  balance_after NUMERIC(4,1) NOT NULL,
  application_id UUID REFERENCES applications(id),
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE leave_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON leave_ledger FROM anon, authenticated;

-- Unique constraint: only 1 accrual per person per leave type per month
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_ledger_accrual_uniq 
  ON leave_ledger (login_id, leave_type, period) 
  WHERE kind = 'accrual';

-- Prevent UPDATE or DELETE on leave_ledger (Strict Append-Only Enforcement)
CREATE OR REPLACE FUNCTION prevent_leave_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'leave_ledger is append-only. UPDATE and DELETE operations are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leave_ledger_append_only ON leave_ledger;
CREATE TRIGGER trg_leave_ledger_append_only
BEFORE UPDATE OR DELETE ON leave_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_leave_ledger_modification();

-- 5. Seed Employee and HOD Application Types with Workflow Chains
INSERT INTO application_types (key, name, enabled, chain) VALUES
(
  'employee_general',
  'Employee General Application',
  true,
  '[
    {
      "step_key": "hod",
      "label": "Head of Department",
      "resolver": { "kind": "role_same_department", "role": "hod" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true,
      "comment_required_on_return": true
    },
    {
      "step_key": "director",
      "label": "Director",
      "resolver": { "kind": "role", "role": "director" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true,
      "comment_required_on_return": true
    }
  ]'::jsonb
),
(
  'employee_leave',
  'Employee Leave Application',
  true,
  '[
    {
      "step_key": "hod",
      "label": "Head of Department",
      "resolver": { "kind": "role_same_department", "role": "hod" },
      "can_reject": false,
      "can_return": true,
      "comment_required_on_return": true,
      "decision_label": "Verify and forward"
    },
    {
      "step_key": "director",
      "label": "Director",
      "resolver": { "kind": "role", "role": "director" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true,
      "comment_required_on_return": true
    }
  ]'::jsonb
),
(
  'hod_general',
  'HOD General Application',
  true,
  '[
    {
      "step_key": "director",
      "label": "Director",
      "resolver": { "kind": "role", "role": "director" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true,
      "comment_required_on_return": true
    }
  ]'::jsonb
),
(
  'hod_leave',
  'HOD Leave Application',
  true,
  '[
    {
      "step_key": "director",
      "label": "Director",
      "resolver": { "kind": "role", "role": "director" },
      "can_reject": true,
      "can_return": true,
      "comment_required_on_reject": true,
      "comment_required_on_return": true
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE 
SET name = EXCLUDED.name, enabled = EXCLUDED.enabled, chain = EXCLUDED.chain;
