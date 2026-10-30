import {
  parseDDMMYYYYtoISO,
  isSunday,
  isSaturday,
  isSaturdayWorking,
} from "../dates";
import type { SaturdayGroup, ExcludedDay, WorkingDaysResult } from "./types";

export interface HolidayInput {
  date: string; // YYYY-MM-DD or DD-MM-YYYY
  name?: string;
}

function toIsoDate(dateStr: string): string {
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const iso = parseDDMMYYYYtoISO(dateStr);
    if (!iso) throw new Error(`Invalid date format: ${dateStr}`);
    return iso;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  throw new Error(`Invalid date format: ${dateStr}. Expected DD-MM-YYYY or YYYY-MM-DD.`);
}

/**
 * Calculates working days between fromDate and toDate (both inclusive).
 * Excludes:
 * - Sundays
 * - Official holidays (from the provided list)
 * - Off-Saturdays based on the applicant's Saturday group ('odd' or 'even')
 */
export function calculateWorkingDays(
  fromDateStr: string,
  toDateStr: string,
  saturdayGroup: SaturdayGroup,
  holidays: Array<HolidayInput | string> = [],
  fifthSaturdayWorking = false
): WorkingDaysResult {
  const fromIso = toIsoDate(fromDateStr);
  const toIso = toIsoDate(toDateStr);

  if (fromIso > toIso) {
    throw new Error(`fromDate (${fromDateStr}) must be less than or equal to toDate (${toDateStr})`);
  }

  // Build a lookup map for holidays (keyed by YYYY-MM-DD)
  const holidayMap = new Map<string, string>();
  for (const h of holidays) {
    if (typeof h === "string") {
      holidayMap.set(toIsoDate(h), "Official Holiday");
    } else {
      holidayMap.set(toIsoDate(h.date), h.name || "Official Holiday");
    }
  }

  const [fromY, fromM, fromD] = fromIso.split("-").map(Number);
  const [toY, toM, toD] = toIso.split("-").map(Number);

  const cur = new Date(Date.UTC(fromY, fromM - 1, fromD));
  const end = new Date(Date.UTC(toY, toM - 1, toD));

  let totalDays = 0;
  let workingDays = 0;
  const excludedDays: ExcludedDay[] = [];

  while (cur <= end) {
    totalDays++;
    const curY = cur.getUTCFullYear();
    const curM = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const curD = String(cur.getUTCDate()).padStart(2, "0");
    const isoString = `${curY}-${curM}-${curD}`;

    if (isSunday(isoString)) {
      excludedDays.push({
        date: isoString,
        reason: "sunday",
        description: "Sunday",
      });
    } else if (holidayMap.has(isoString)) {
      excludedDays.push({
        date: isoString,
        reason: "holiday",
        description: holidayMap.get(isoString) || "Official Holiday",
      });
    } else if (isSaturday(isoString)) {
      const isWorking = isSaturdayWorking(isoString, saturdayGroup, fifthSaturdayWorking);
      if (!isWorking) {
        excludedDays.push({
          date: isoString,
          reason: "off_saturday",
          description: `Off Saturday (${saturdayGroup === "odd" ? "Even" : "Odd"} group off)`,
        });
      } else {
        workingDays++;
      }
    } else {
      workingDays++;
    }

    // Step forward 1 day
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return {
    workingDays,
    totalDays,
    excludedDays,
  };
}
