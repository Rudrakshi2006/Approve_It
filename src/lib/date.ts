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
