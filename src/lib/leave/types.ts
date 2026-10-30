export type LeaveType = "medical" | "personal";
export type SaturdayGroup = "odd" | "even";

export interface ExcludedDay {
  date: string; // YYYY-MM-DD
  reason: "sunday" | "holiday" | "off_saturday";
  description?: string;
}

export interface WorkingDaysResult {
  workingDays: number;
  totalDays: number;
  excludedDays: ExcludedDay[];
}

export interface LeaveLedgerRecord {
  id?: string;
  applicant_login_id: string;
  leave_type: LeaveType;
  change_amount: number;
  balance_after: number;
  reason: "opening_balance" | "monthly_accrual" | "deduction" | "admin_adjustment";
  application_id?: string | null;
  month_reference?: string | null; // e.g. "2026-11"
  created_at?: string;
}

export interface DeductionResult {
  deducted: number;
  unpaid: number;
  balanceAfter: number;
}
