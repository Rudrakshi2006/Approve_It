import { describe, expect, it } from "vitest";
import {
  parseDDMMYYYY,
  parseDDMMYYYYtoISO,
  formatISOtoDDMMYYYY,
  formatDatesInText,
  getTodayIST,
  getTodayIST_DDMMYYYY,
  getNowISTTime,
  isFutureDate,
  isPastDate,
  isTodayDate,
  isValidTime24,
  isDateTimeInFuture,
  getDayOfWeek,
  isSunday,
  isSaturday,
  getSaturdayIndexInMonth,
  isSaturdayWorking,
} from "../dates";

describe("Phase 7: Pure Date Engine & Saturday Groups", () => {
  describe("Strict DD-MM-YYYY Parsing & Real Calendar Validation", () => {
    it("accepts valid calendar dates in DD-MM-YYYY format", () => {
      const res = parseDDMMYYYY("15-11-2026");
      expect(res.valid).toBe(true);
      expect(res.iso).toBe("2026-11-15");
      expect(res.day).toBe(15);
      expect(res.month).toBe(11);
      expect(res.year).toBe(2026);
    });

    it("accepts leap year February 29th and rejects non-leap year Feb 29th", () => {
      // 2024 was a leap year
      expect(parseDDMMYYYY("29-02-2024").valid).toBe(true);
      // 2026 is NOT a leap year
      expect(parseDDMMYYYY("29-02-2026").valid).toBe(false);
    });

    it("rejects non-existent calendar date 31-02-2026", () => {
      const res = parseDDMMYYYY("31-02-2026");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Invalid calendar date");
    });

    it("rejects 31st on 30-day months (e.g. 31-04-2026, 31-11-2026)", () => {
      expect(parseDDMMYYYY("31-04-2026").valid).toBe(false);
      expect(parseDDMMYYYY("31-11-2026").valid).toBe(false);
    });

    it("rejects single digit day or month (e.g. 1-1-2026, 01-1-2026)", () => {
      expect(parseDDMMYYYY("1-1-2026").valid).toBe(false);
      expect(parseDDMMYYYY("01-1-2026").valid).toBe(false);
      expect(parseDDMMYYYY("1-01-2026").valid).toBe(false);
    });

    it("rejects ISO format (2026-01-01) in strict DD-MM-YYYY parser", () => {
      expect(parseDDMMYYYY("2026-01-01").valid).toBe(false);
    });

    it("converts valid DD-MM-YYYY to ISO and back", () => {
      expect(parseDDMMYYYYtoISO("05-11-2026")).toBe("2026-11-05");
      expect(parseDDMMYYYYtoISO("invalid")).toBeNull();
      expect(formatISOtoDDMMYYYY("2026-11-05")).toBe("05-11-2026");
    });

    it("replaces YYYY-MM-DD pattern in text with DD-MM-YYYY", () => {
      const text = "Application for 2026-11-08 to 2026-11-09";
      expect(formatDatesInText(text)).toBe("Application for 08-11-2026 to 09-11-2026");
    });
  });

  describe("Injectable Clock & IST Boundaries", () => {
    // Fixed reference clock: 30 October 2026 14:30:00 IST (UTC: 2026-10-30 09:00:00)
    const fixedClock = () => new Date("2026-10-30T09:00:00.000Z");

    it("derives correct today IST (YYYY-MM-DD and DD-MM-YYYY)", () => {
      expect(getTodayIST(fixedClock)).toBe("2026-10-30");
      expect(getTodayIST_DDMMYYYY(fixedClock)).toBe("30-10-2026");
      expect(getNowISTTime(fixedClock)).toBe("14:30");
    });

    it("handles IST midnight crossover cleanly", () => {
      // 2026-10-30 23:45:00 IST -> UTC is 18:15:00
      const nightClock = () => new Date("2026-10-30T18:15:00.000Z");
      expect(getTodayIST(nightClock)).toBe("2026-10-30");

      // 2026-10-31 00:15:00 IST -> UTC is 2026-10-30 18:45:00
      const midnightAfterClock = () => new Date("2026-10-30T18:45:00.000Z");
      expect(getTodayIST(midnightAfterClock)).toBe("2026-10-31");
    });

    it("evaluates past, today, and future dates against clock", () => {
      expect(isPastDate("29-10-2026", fixedClock)).toBe(true);
      expect(isTodayDate("30-10-2026", fixedClock)).toBe(true);
      expect(isFutureDate("31-10-2026", fixedClock)).toBe(true);

      // Leave rules: today allowed, past blocked
      expect(isPastDate("30-10-2026", fixedClock)).toBe(false); // Today is not past
      expect(isFutureDate("30-10-2026", fixedClock)).toBe(false); // Today is not future
    });

    it("validates 24-hour time format and rejects invalid times", () => {
      expect(isValidTime24("14:30")).toBe(true);
      expect(isValidTime24("00:00")).toBe(true);
      expect(isValidTime24("23:59")).toBe(true);
      expect(isValidTime24("24:00")).toBe(false);
      expect(isValidTime24("25:10")).toBe(false);
      expect(isValidTime24("9:30")).toBe(false);
    });

    it("blocks time later than now when date is today", () => {
      // Current fixed time is 14:30 IST
      // Past time today -> allowed (not in future)
      expect(isDateTimeInFuture("30-10-2026", "11:00", fixedClock)).toBe(false);
      expect(isDateTimeInFuture("30-10-2026", "14:30", fixedClock)).toBe(false);

      // Future time today -> blocked (in future)
      expect(isDateTimeInFuture("30-10-2026", "15:00", fixedClock)).toBe(true);

      // Future date -> always blocked
      expect(isDateTimeInFuture("31-10-2026", "10:00", fixedClock)).toBe(true);

      // Past date -> never blocked
      expect(isDateTimeInFuture("29-10-2026", "23:59", fixedClock)).toBe(false);
    });
  });

  describe("Weekdays and Saturday Working Group Rules", () => {
    // In November 2026:
    // 01-11-2026 is Sunday
    // Saturdays fall on: 07, 14, 21, 28
    it("identifies Sundays correctly", () => {
      expect(isSunday("01-11-2026")).toBe(true);
      expect(isSunday("08-11-2026")).toBe(true);
      expect(isSunday("02-11-2026")).toBe(false); // Monday
    });

    it("determines Saturday indices in month correctly", () => {
      expect(isSaturday("07-11-2026")).toBe(true);
      expect(getSaturdayIndexInMonth("07-11-2026")).toBe(1);

      expect(isSaturday("14-11-2026")).toBe(true);
      expect(getSaturdayIndexInMonth("14-11-2026")).toBe(2);

      expect(isSaturday("21-11-2026")).toBe(true);
      expect(getSaturdayIndexInMonth("21-11-2026")).toBe(3);

      expect(isSaturday("28-11-2026")).toBe(true);
      expect(getSaturdayIndexInMonth("28-11-2026")).toBe(4);

      // In May 2026, 30-05-2026 is the 5th Saturday
      expect(getSaturdayIndexInMonth("30-05-2026")).toBe(5);
    });

    it("enforces Odd vs Even Saturday working group rules", () => {
      // 1st Saturday (07-11-2026): Odd works, Even off
      expect(isSaturdayWorking("07-11-2026", "odd")).toBe(true);
      expect(isSaturdayWorking("07-11-2026", "even")).toBe(false);

      // 2nd Saturday (14-11-2026): Even works, Odd off
      expect(isSaturdayWorking("14-11-2026", "odd")).toBe(false);
      expect(isSaturdayWorking("14-11-2026", "even")).toBe(true);

      // 3rd Saturday (21-11-2026): Odd works, Even off
      expect(isSaturdayWorking("21-11-2026", "odd")).toBe(true);
      expect(isSaturdayWorking("21-11-2026", "even")).toBe(false);

      // 4th Saturday (28-11-2026): Even works, Odd off
      expect(isSaturdayWorking("28-11-2026", "odd")).toBe(false);
      expect(isSaturdayWorking("28-11-2026", "even")).toBe(true);

      // 5th Saturday (30-05-2026): default off for all, works if setting true
      expect(isSaturdayWorking("30-05-2026", "odd", false)).toBe(false);
      expect(isSaturdayWorking("30-05-2026", "even", false)).toBe(false);
      expect(isSaturdayWorking("30-05-2026", "odd", true)).toBe(true);
      expect(isSaturdayWorking("30-05-2026", "even", true)).toBe(true);
    });
  });
});
