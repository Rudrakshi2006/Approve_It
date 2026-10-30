import { parseDDMMYYYYtoISO } from "../dates";

export interface LeaveInterval {
  id?: string;
  fromDate: string; // DD-MM-YYYY or YYYY-MM-DD
  toDate: string;   // DD-MM-YYYY or YYYY-MM-DD
  status: string;   // "in_review" | "approved" | "returned" | "rejected" | "cancelled" | "withdrawn"
}

function toIso(d: string): string {
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
    const iso = parseDDMMYYYYtoISO(d);
    if (!iso) throw new Error(`Invalid date format: ${d}`);
    return iso;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return d;
  }
  throw new Error(`Invalid date format: ${d}`);
}

const ACTIVE_STATUSES = new Set(["in_review", "approved", "returned"]);

/**
 * Checks if candidate leave dates overlap with any active leave application.
 * Two intervals [A_from, A_to] and [B_from, B_to] overlap iff:
 *   A_from <= B_to AND A_to >= B_from
 */
export function checkLeaveOverlap(
  candidate: { fromDate: string; toDate: string },
  existingLeaves: LeaveInterval[]
): { hasOverlap: boolean; conflictingApplicationId?: string } {
  const cFrom = toIso(candidate.fromDate);
  const cTo = toIso(candidate.toDate);

  for (const item of existingLeaves) {
    if (!ACTIVE_STATUSES.has(item.status)) {
      continue;
    }
    const eFrom = toIso(item.fromDate);
    const eTo = toIso(item.toDate);

    if (cFrom <= eTo && cTo >= eFrom) {
      return {
        hasOverlap: true,
        conflictingApplicationId: item.id,
      };
    }
  }

  return { hasOverlap: false };
}
