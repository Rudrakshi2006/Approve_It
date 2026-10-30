/**
 * Pure date utility functions for Phase 7:
 * - Strict DD-MM-YYYY validation and formatting
 * - Injectable clock for IST "today" and "now"
 * - Weekday and Saturday group helpers (1st/3rd vs 2nd/4th)
 * - Pure logic: no external I/O
 */

export type Clock = () => Date;

export const defaultClock: Clock = () => new Date();

/**
 * Strict DD-MM-YYYY parser.
 * Requires 2-digit day (01-31), 2-digit month (01-12), and 4-digit year.
 * Validates real calendar date (rejects 31-02-2026, 1-1-2026, etc.).
 */
export function parseDDMMYYYY(dateStr: string): {
  valid: boolean;
  year?: number;
  month?: number;
  day?: number;
  iso?: string; // YYYY-MM-DD
  error?: string;
} {
  if (!dateStr || typeof dateStr !== "string") {
    return { valid: false, error: "Date string is required" };
  }

  const match = dateStr.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    return {
      valid: false,
      error: "Date must strictly be in DD-MM-YYYY format (e.g. 15-11-2026)",
    };
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return { valid: false, error: "Month must be between 01 and 12" };
  }

  // Real calendar verification using UTC to avoid local timezone shifts
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return { valid: false, error: "Invalid calendar date (e.g. non-existent day for the month)" };
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const iso = `${year}-${mm}-${dd}`;

  return { valid: true, year, month, day, iso };
}

/**
 * Converts a valid DD-MM-YYYY string to YYYY-MM-DD.
 * Returns null if invalid.
 */
export function parseDDMMYYYYtoISO(dateStr: string): string | null {
  const res = parseDDMMYYYY(dateStr);
  return res.valid && res.iso ? res.iso : null;
}

/**
 * Converts YYYY-MM-DD or ISO string to DD-MM-YYYY.
 */
export function formatISOtoDDMMYYYY(isoDateStr?: string | null): string {
  if (!isoDateStr) return "";
  const match = String(isoDateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}-${mm}-${yyyy}`;
  }
  return "";
}

/**
 * Replaces any YYYY-MM-DD occurrences in a text string with DD-MM-YYYY.
 */
export function formatDatesInText(text?: string | null): string {
  if (!text) return "";
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$3-$2-$1");
}

/**
 * Returns today's date in Indian Standard Time (IST) as "YYYY-MM-DD"
 * Clock is injectable for testing.
 */
export function getTodayIST(clock: Clock = defaultClock): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(clock());
}

/**
 * Returns today's date in Indian Standard Time (IST) as "DD-MM-YYYY"
 */
export function getTodayIST_DDMMYYYY(clock: Clock = defaultClock): string {
  const iso = getTodayIST(clock);
  return formatISOtoDDMMYYYY(iso);
}

/**
 * Returns current time in Indian Standard Time (IST) as 24-hour "HH:mm"
 */
export function getNowISTTime(clock: Clock = defaultClock): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(clock());
}

/**
 * Normalizes input date (accepts DD-MM-YYYY or YYYY-MM-DD) to YYYY-MM-DD
 */
function normalizeToISO(dateInput: string): string | null {
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateInput)) {
    return parseDDMMYYYYtoISO(dateInput);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  return null;
}

/**
 * Checks if a date is strictly in the future compared to today IST.
 */
export function isFutureDate(dateInput: string, clock: Clock = defaultClock): boolean {
  const iso = normalizeToISO(dateInput);
  if (!iso) return false;
  const today = getTodayIST(clock);
  return iso > today;
}

/**
 * Checks if a date is strictly in the past compared to today IST.
 */
export function isPastDate(dateInput: string, clock: Clock = defaultClock): boolean {
  const iso = normalizeToISO(dateInput);
  if (!iso) return false;
  const today = getTodayIST(clock);
  return iso < today;
}

/**
 * Checks if a date matches today IST.
 */
export function isTodayDate(dateInput: string, clock: Clock = defaultClock): boolean {
  const iso = normalizeToISO(dateInput);
  if (!iso) return false;
  const today = getTodayIST(clock);
  return iso === today;
}

/**
 * Validates 24-hour time format "HH:mm" (00:00 to 23:59).
 */
export function isValidTime24(timeStr: string): boolean {
  if (!timeStr || typeof timeStr !== "string") return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr.trim());
}

/**
 * Checks if (date + time) is later than current IST timestamp.
 * - If date is in the future -> true
 * - If date is in the past -> false
 * - If date is today -> checks if time > now IST
 */
export function isDateTimeInFuture(
  dateInput: string,
  timeStr?: string | null,
  clock: Clock = defaultClock
): boolean {
  const iso = normalizeToISO(dateInput);
  if (!iso) return false;
  const today = getTodayIST(clock);

  if (iso > today) return true;
  if (iso < today) return false;

  // Date is today; if time provided, verify against current IST time
  if (timeStr && isValidTime24(timeStr)) {
    const nowTime = getNowISTTime(clock);
    return timeStr.trim() > nowTime;
  }

  return false;
}

/**
 * Day of week helper for a date string (YYYY-MM-DD or DD-MM-YYYY).
 * Returns: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export function getDayOfWeek(dateInput: string): number {
  const iso = normalizeToISO(dateInput);
  if (!iso) throw new Error(`Invalid date format for getDayOfWeek: ${dateInput}`);
  const [yyyy, mm, dd] = iso.split("-").map(Number);
  // UTC Date guarantees no local timezone variance
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCDay();
}

export function isSunday(dateInput: string): boolean {
  return getDayOfWeek(dateInput) === 0;
}

export function isSaturday(dateInput: string): boolean {
  return getDayOfWeek(dateInput) === 6;
}

/**
 * For a given Saturday, determines which Saturday of the month it is:
 * 1 = 1st Saturday, 2 = 2nd, 3 = 3rd, 4 = 4th, 5 = 5th.
 */
export function getSaturdayIndexInMonth(dateInput: string): number {
  if (!isSaturday(dateInput)) {
    throw new Error(`Date is not a Saturday: ${dateInput}`);
  }
  const iso = normalizeToISO(dateInput);
  if (!iso) throw new Error(`Invalid date format: ${dateInput}`);
  const dayOfMonth = parseInt(iso.split("-")[2], 10);
  return Math.floor((dayOfMonth - 1) / 7) + 1;
}

/**
 * Checks if a Saturday is a working day for an applicant's Saturday group:
 * - 'odd': 1st and 3rd Saturdays are working; 2nd and 4th are off.
 * - 'even': 2nd and 4th Saturdays are working; 1st and 3rd are off.
 * - 5th Saturday: governed by fifthSaturdayWorking setting (default false).
 */
export function isSaturdayWorking(
  dateInput: string,
  saturdayGroup: "odd" | "even",
  fifthSaturdayWorking = false
): boolean {
  if (!isSaturday(dateInput)) return false;
  const satIndex = getSaturdayIndexInMonth(dateInput);

  if (satIndex === 1 || satIndex === 3) {
    return saturdayGroup === "odd";
  }
  if (satIndex === 2 || satIndex === 4) {
    return saturdayGroup === "even";
  }
  if (satIndex === 5) {
    return fifthSaturdayWorking;
  }
  return false;
}
