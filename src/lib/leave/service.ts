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
  const normId = loginId.toUpperCase().trim();
  const db = getDb();
  const todayIST = getTodayIST();
  const currentYearMonth = todayIST.slice(0, 7); // "YYYY-MM"

  // Fetch all ledger rows for this employee
  let rows: Array<{
    leave_type: string;
    balance_after: number;
    period?: string | null;
  }> | null = null;

  try {
    const { data, error } = await db
      .from("leave_ledger")
      .select("*")
      .eq("login_id", loginId)
      .order("id", { ascending: true });

    if (!error && data) {
      rows = data;
    }
  } catch {
    // leave_ledger table might not exist yet
  }

  // If no rows found or table not created yet:
  // Baseline: Dr. Mrudula Nimbarte (T017) starts with 4 Personal and 3 Medical leave.
  // Other employees start with 6 and 6.
  if (!rows || rows.length === 0) {
    const balances: LeaveBalanceSummary = {
      medical: normId === "T017" ? 3 : 6,
      personal: normId === "T017" ? 4 : 6,
    };

    // Calculate deductions from approved leave applications
    try {
      const { data: approvedApps } = await db
        .from("applications")
        .select("payload")
        .eq("applicant_login_id", loginId)
        .in("type", ["employee_leave", "hod_leave"])
        .eq("status", "approved");

      for (const app of approvedApps || []) {
        const p = app.payload as {
          leave_type?: string;
          working_days?: number;
          balance_snapshot?: { deducted?: number };
        } | null;

        if (p?.leave_type === "medical") {
          const deduct = Number(p.balance_snapshot?.deducted ?? p.working_days ?? 0);
          balances.medical = Math.max(0, balances.medical - deduct);
        } else if (p?.leave_type === "personal") {
          const deduct = Number(p.balance_snapshot?.deducted ?? p.working_days ?? 0);
          balances.personal = Math.max(0, balances.personal - deduct);
        }
      }
    } catch {
      // ignore
    }

    return balances;
  }

  const balances: LeaveBalanceSummary = {
    medical: normId === "T017" ? 3 : 0,
    personal: normId === "T017" ? 4 : 0,
  };

  for (const type of ["medical", "personal"] as const) {
    const typeRows = rows.filter((r) => r.leave_type === type);

    if (typeRows.length === 0) {
      balances[type] = normId === "T017" ? (type === "medical" ? 3 : 4) : 0;
      continue;
    }

    // Latest recorded balance
    const lastRow = typeRows[typeRows.length - 1];
    let latestBalance = Number(lastRow.balance_after);

    // Find latest accrual / opening period
    const periodRows = typeRows.filter((r) => !!r.period);
    const latestPeriod = periodRows.length > 0
      ? periodRows[periodRows.length - 1].period
      : null;

    if (latestPeriod && latestPeriod < currentYearMonth) {
      // Calculate missing accruals
      const { accruals } = computeMissingAccruals(
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
  toDate?: string | null;
  leaveType: LeaveType;
  saturdayGroup?: SaturdayGroup;
}): Promise<LeavePreviewResult> {
  const db = getDb();
  const effectiveToDate = params.toDate && params.toDate.trim()
    ? params.toDate.trim()
    : params.fromDate.trim();

  // 1. Determine Saturday group
  let satGroup: SaturdayGroup = params.saturdayGroup || "odd";
  if (!params.saturdayGroup) {
    try {
      const { data: person } = await db
        .from("people")
        .select("saturday_group")
        .eq("login_id", params.loginId)
        .maybeSingle();
      if (person?.saturday_group === "even") {
        satGroup = "even";
      }
    } catch {
      // ignore
    }
  }

  // 2. Fetch holidays
  let holidays: Array<{ date: string; name?: string }> = [];
  try {
    const { data: holidaysData } = await db
      .from("holidays")
      .select("date, name");
    if (holidaysData) {
      holidays = holidaysData.map((h: { date: string; name?: string }) => ({
        date: h.date,
        name: h.name,
      }));
    }
  } catch {
    // ignore
  }

  // 3. Fetch app_settings (fifth_saturday_working)
  let fifthSatWorking = false;
  try {
    const { data: settingData } = await db
      .from("app_settings")
      .select("value")
      .eq("key", "fifth_saturday_working")
      .maybeSingle();
    fifthSatWorking = settingData?.value === true;
  } catch {
    // ignore
  }

  // 4. Calculate working days
  const workingDaysResult = calculateWorkingDays(
    params.fromDate,
    effectiveToDate,
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
  const intervals: LeaveInterval[] = [];
  try {
    const { data: existingApps } = await db
      .from("applications")
      .select("id, status, payload")
      .eq("applicant_login_id", params.loginId)
      .in("type", ["employee_leave", "hod_leave"])
      .in("status", ["in_review", "returned", "approved"]);

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
  } catch {
    // ignore
  }

  const overlapCheck = checkLeaveOverlap(
    { fromDate: params.fromDate, toDate: effectiveToDate },
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

  try {
    await db.from("leave_ledger").insert({
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
  } catch (insErr: unknown) {
    console.warn("Could not insert deduction into leave_ledger:", (insErr as Error)?.message);
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
