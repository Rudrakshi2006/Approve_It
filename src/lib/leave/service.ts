import { getDb } from "../db";
import { getTodayIST } from "../dates";
import { calculateWorkingDays } from "./working-days";
import { calculateDeduction } from "./deduct";
import { checkLeaveOverlap, type LeaveInterval } from "./overlap";
import { computeMissingAccruals, formatYearMonth, parseYearMonth } from "./balance";
import type { SaturdayGroup, LeaveType, ExcludedDay } from "./types";

export interface LeaveBalanceSummary {
  medical: number;
  personal: number;
}

export interface LeavePreviewResult {
  workingDays: number;
  totalDays: number;
  excludedDays: ExcludedDay[];
  currentBalance: number;
  deducted: number;
  unpaid: number;
  balanceAfter: number;
  hasOverlap: boolean;
  conflictingApplicationId?: string;
}

/**
 * Gets or materializes the current leave balances for an employee as of today IST.
 */
export async function getOrMaterializeLeaveBalances(
  loginId: string
): Promise<LeaveBalanceSummary> {
  const db = getDb();
  const todayIST = getTodayIST();
  const currentYearMonth = todayIST.slice(0, 7); // "YYYY-MM"

  // Fetch all ledger rows for this employee
  const { data: rows, error } = await db
    .from("leave_ledger")
    .select("*")
    .eq("login_id", loginId)
    .order("id", { ascending: true });

  if (error) {
    console.warn(`Could not read leave_ledger for ${loginId}:`, error.message);
    return { medical: 0, personal: 0 };
  }

  const balances: LeaveBalanceSummary = { medical: 0, personal: 0 };

  for (const type of ["medical", "personal"] as const) {
    const typeRows = (rows || []).filter((r: { leave_type: string }) => r.leave_type === type);

    if (typeRows.length === 0) {
      // No records yet: initialize with 0
      balances[type] = 0;
      continue;
    }

    // Latest recorded balance
    const lastRow = typeRows[typeRows.length - 1];
    let latestBalance = Number(lastRow.balance_after);

    // Find latest accrual / opening period
    const periodRows = typeRows.filter((r: { period?: string | null }) => !!r.period);
    const latestPeriod = periodRows.length > 0
      ? periodRows[periodRows.length - 1].period
      : null;

    if (latestPeriod && latestPeriod < currentYearMonth) {
      // Calculate missing accruals
      const { accruals, finalBalance } = computeMissingAccruals(
        latestPeriod,
        currentYearMonth,
        latestBalance
      );

      // Lazily insert accruals into DB
      for (const step of accruals) {
        try {
          const { error: insErr } = await db.from("leave_ledger").insert({
            login_id: loginId,
            leave_type: type,
            kind: "accrual",
            period: step.month,
            days: step.change,
            unpaid_days: 0,
            balance_before: step.balanceAfter - step.change,
            balance_after: step.balanceAfter,
            note: `Monthly accrual for ${step.month}`,
            created_by: "system_accrual",
          });

          if (!insErr) {
            latestBalance = step.balanceAfter;
          }
        } catch {
          // Gracefully continue if unique constraint already exists
        }
      }
      balances[type] = latestBalance;
    } else {
      balances[type] = latestBalance;
    }
  }

  return balances;
}

/**
 * Previews leave calculation for an application before submission or during review.
 */
export async function previewLeave(params: {
  loginId: string;
  fromDate: string;
  toDate: string;
  leaveType: LeaveType;
  saturdayGroup?: SaturdayGroup;
}): Promise<LeavePreviewResult> {
  const db = getDb();

  // 1. Determine Saturday group
  let satGroup: SaturdayGroup = params.saturdayGroup || "odd";
  if (!params.saturdayGroup) {
    const { data: person } = await db
      .from("people")
      .select("saturday_group")
      .eq("login_id", params.loginId)
      .maybeSingle();
    if (person?.saturday_group === "even") {
      satGroup = "even";
    }
  }

  // 2. Fetch holidays
  const { data: holidaysData } = await db
    .from("holidays")
    .select("date, name");

  const holidays = (holidaysData || []).map((h: { date: string; name?: string }) => ({
    date: h.date,
    name: h.name,
  }));

  // 3. Fetch app_settings (fifth_saturday_working)
  const { data: settingData } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "fifth_saturday_working")
    .maybeSingle();

  const fifthSatWorking = settingData?.value === true;

  // 4. Calculate working days
  const workingDaysResult = calculateWorkingDays(
    params.fromDate,
    params.toDate,
    satGroup,
    holidays,
    fifthSatWorking
  );

  // 5. Get current balance
  const balances = await getOrMaterializeLeaveBalances(params.loginId);
  const curBal = balances[params.leaveType];

  // 6. Calculate deduction projection
  const deduction = calculateDeduction(curBal, workingDaysResult.workingDays);

  // 7. Check for overlapping applications
  const { data: existingApps } = await db
    .from("applications")
    .select("id, status, payload")
    .eq("applicant_login_id", params.loginId)
    .in("type", ["employee_leave", "hod_leave"])
    .in("status", ["in_review", "returned", "approved"]);

  const intervals: LeaveInterval[] = [];
  for (const app of existingApps || []) {
    const p = app.payload as { from_date?: string; to_date?: string } | null;
    if (p?.from_date && p?.to_date) {
      intervals.push({
        id: app.id,
        fromDate: p.from_date,
        toDate: p.to_date,
        status: app.status,
      });
    }
  }

  const overlapCheck = checkLeaveOverlap(
    { fromDate: params.fromDate, toDate: params.toDate },
    intervals
  );

  return {
    workingDays: workingDaysResult.workingDays,
    totalDays: workingDaysResult.totalDays,
    excludedDays: workingDaysResult.excludedDays,
    currentBalance: curBal,
    deducted: deduction.deducted,
    unpaid: deduction.unpaid,
    balanceAfter: deduction.balanceAfter,
    hasOverlap: overlapCheck.hasOverlap,
    conflictingApplicationId: overlapCheck.conflictingApplicationId,
  };
}

/**
 * Executes atomic deduction upon final approval.
 */
export async function executeLeaveApprovalDeduction(params: {
  applicationId: string;
  loginId: string;
  leaveType: LeaveType;
  workingDays: number;
  approvedBy: string;
}): Promise<{
  balanceBefore: number;
  deducted: number;
  unpaid: number;
  balanceAfter: number;
}> {
  const db = getDb();
  const balances = await getOrMaterializeLeaveBalances(params.loginId);
  const curBal = balances[params.leaveType];

  const { deducted, unpaid, balanceAfter } = calculateDeduction(curBal, params.workingDays);
  const todayIST = getTodayIST();
  const currentPeriod = todayIST.slice(0, 7);

  const { error: insErr } = await db.from("leave_ledger").insert({
    login_id: params.loginId,
    leave_type: params.leaveType,
    kind: "deduction",
    period: currentPeriod,
    days: deducted,
    unpaid_days: unpaid,
    balance_before: curBal,
    balance_after: balanceAfter,
    application_id: params.applicationId,
    note: `Deduction for approved leave (${params.workingDays} working days: ${deducted} paid, ${unpaid} unpaid)`,
    created_by: params.approvedBy,
  });

  if (insErr) {
    throw new Error(`Failed to insert leave deduction into ledger: ${insErr.message}`);
  }

  // Update application payload with the frozen balance snapshot
  const { data: appRow } = await db
    .from("applications")
    .select("payload")
    .eq("id", params.applicationId)
    .single();

  const currentPayload = (appRow?.payload || {}) as Record<string, unknown>;
  const updatedPayload = {
    ...currentPayload,
    balance_snapshot: {
      balance_before: curBal,
      deducted,
      unpaid,
      balance_after: balanceAfter,
      deducted_at: new Date().toISOString(),
      deducted_by: params.approvedBy,
    },
  };

  await db
    .from("applications")
    .update({
      payload: updatedPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.applicationId);

  return {
    balanceBefore: curBal,
    deducted,
    unpaid,
    balanceAfter,
  };
}
