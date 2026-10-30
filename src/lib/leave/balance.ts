export const DEFAULT_LEAVE_CAP = 12;

export interface AccrualStep {
  month: string; // "YYYY-MM"
  change: number; // 0 or 1
  balanceAfter: number;
}

/**
 * Parses "YYYY-MM" into { year, month } (month 1-12)
 */
export function parseYearMonth(ym: string): { year: number; month: number } {
  const parts = ym.split("-").map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    throw new Error(`Invalid year-month string: ${ym}. Expected YYYY-MM.`);
  }
  return { year: parts[0], month: parts[1] };
}

/**
 * Formats { year, month } into "YYYY-MM"
 */
export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Returns all calendar months strictly after fromMonth up to and including toMonth.
 * Example: getMissingMonths("2026-08", "2026-11") => ["2026-09", "2026-10", "2026-11"]
 */
export function getMissingMonths(fromMonth: string, toMonth: string): string[] {
  if (fromMonth >= toMonth) return [];

  const { year: fromY, month: fromM } = parseYearMonth(fromMonth);
  const { year: toY, month: toM } = parseYearMonth(toMonth);

  const months: string[] = [];
  let y = fromY;
  let m = fromM + 1;
  if (m > 12) {
    m = 1;
    y++;
  }

  while (y < toY || (y === toY && m <= toM)) {
    months.push(formatYearMonth(y, m));
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return months;
}

/**
 * Pure calculation of lazy monthly accruals (+1 per missing month, clamped to cap).
 */
export function computeMissingAccruals(
  lastAccrualMonth: string,
  targetMonth: string,
  currentBalance: number,
  cap: number = DEFAULT_LEAVE_CAP
): { accruals: AccrualStep[]; finalBalance: number } {
  const missingMonths = getMissingMonths(lastAccrualMonth, targetMonth);
  let bal = Math.min(cap, Math.max(0, currentBalance));
  const accruals: AccrualStep[] = [];

  for (const m of missingMonths) {
    const nextBal = Math.min(cap, bal + 1);
    const change = nextBal - bal;
    accruals.push({
      month: m,
      change,
      balanceAfter: nextBal,
    });
    bal = nextBal;
  }

  return {
    accruals,
    finalBalance: bal,
  };
}
