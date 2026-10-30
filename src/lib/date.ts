/**
 * Formats an ISO date string or Date object to Indian Standard Time (IST) display format:
 * "DD MMM YYYY, hh:mm A IST"
 */
export function formatToIST(dateInput: string | Date | number): string {
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  // Format with Intl for Asia/Kolkata timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  const formatted = new Intl.DateTimeFormat("en-IN", options).format(date);
  return `${formatted} IST`;
}

/**
 * Returns today's date in Indian Standard Time (IST) as "YYYY-MM-DD"
 */
export function getTodayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Formats a date string (e.g. "YYYY-MM-DD" or ISO string) to "DD-MM-YYYY"
 */
export function formatToDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return "";
  const ymdMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const [, yyyy, mm, dd] = ymdMatch;
    return `${dd}-${mm}-${yyyy}`;
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return String(dateStr);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Replaces any YYYY-MM-DD pattern in a text string with DD-MM-YYYY
 */
export function formatDatesInText(text?: string | null): string {
  if (!text) return "";
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$3-$2-$1");
}
