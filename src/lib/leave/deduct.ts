import type { DeductionResult } from "./types";

/**
 * Calculates leave balance deduction:
 * - deducted = min(balance, workingDays)
 * - unpaid = workingDays - deducted
 * - balanceAfter = balance - deducted
 */
export function calculateDeduction(
  currentBalance: number,
  workingDays: number
): DeductionResult {
  const safeBalance = Math.max(0, currentBalance);
  const safeDays = Math.max(0, workingDays);
  const deducted = Math.min(safeBalance, safeDays);
  const unpaid = Math.max(0, safeDays - deducted);
  const balanceAfter = safeBalance - deducted;

  return {
    deducted,
    unpaid,
    balanceAfter,
  };
}
