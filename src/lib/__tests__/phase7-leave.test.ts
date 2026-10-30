import { describe, it, expect } from "vitest";
import { calculateWorkingDays } from "../leave/working-days";
import { calculateDeduction } from "../leave/deduct";
import { checkLeaveOverlap } from "../leave/overlap";
import {
  getMissingMonths,
  computeMissingAccruals,
  parseYearMonth,
  formatYearMonth,
} from "../leave/balance";

describe("Phase 7: Leave Pure Logic (Task 7.3)", () => {
  describe("working-days.ts", () => {
    it("calculates standard Monday to Friday working days", () => {
      // 02-11-2026 (Mon) to 06-11-2026 (Fri) = 5 days, 5 working days
      const res = calculateWorkingDays("02-11-2026", "06-11-2026", "odd");
      expect(res.totalDays).toBe(5);
      expect(res.workingDays).toBe(5);
      expect(res.excludedDays).toHaveLength(0);
    });

    it("excludes Sundays automatically", () => {
      // 07-11-2026 (Sat) to 09-11-2026 (Mon)
      // 07 is 1st Sat (working for odd), 08 is Sunday (excluded), 09 is Mon (working)
      const res = calculateWorkingDays("07-11-2026", "09-11-2026", "odd");
      expect(res.totalDays).toBe(3);
      expect(res.workingDays).toBe(2);
      expect(res.excludedDays).toEqual([
        {
          date: "2026-11-08",
          reason: "sunday",
          description: "Sunday",
        },
      ]);
    });

    it("excludes official holidays provided in list", () => {
      const holidays = [
        { date: "2026-11-04", name: "Diwali Special Holiday" },
      ];
      const res = calculateWorkingDays("02-11-2026", "06-11-2026", "odd", holidays);
      expect(res.totalDays).toBe(5);
      expect(res.workingDays).toBe(4);
      expect(res.excludedDays).toEqual([
        {
          date: "2026-11-04",
          reason: "holiday",
          description: "Diwali Special Holiday",
        },
      ]);
    });

    it("correctly handles odd Saturday group (1st and 3rd work, 2nd and 4th off)", () => {
      // November 2026 Saturdays: 7th (1st), 14th (2nd), 21st (3rd), 28th (4th)
      // 1st Sat (07-11-2026) -> working for odd
      const sat1 = calculateWorkingDays("07-11-2026", "07-11-2026", "odd");
      expect(sat1.workingDays).toBe(1);
      expect(sat1.excludedDays).toHaveLength(0);

      // 2nd Sat (14-11-2026) -> off for odd
      const sat2 = calculateWorkingDays("14-11-2026", "14-11-2026", "odd");
      expect(sat2.workingDays).toBe(0);
      expect(sat2.excludedDays[0].reason).toBe("off_saturday");

      // 3rd Sat (21-11-2026) -> working for odd
      const sat3 = calculateWorkingDays("21-11-2026", "21-11-2026", "odd");
      expect(sat3.workingDays).toBe(1);

      // 4th Sat (28-11-2026) -> off for odd
      const sat4 = calculateWorkingDays("28-11-2026", "28-11-2026", "odd");
      expect(sat4.workingDays).toBe(0);
      expect(sat4.excludedDays[0].reason).toBe("off_saturday");
    });

    it("correctly handles even Saturday group (2nd and 4th work, 1st and 3rd off)", () => {
      // 1st Sat (07-11-2026) -> off for even
      const sat1 = calculateWorkingDays("07-11-2026", "07-11-2026", "even");
      expect(sat1.workingDays).toBe(0);
      expect(sat1.excludedDays[0].reason).toBe("off_saturday");

      // 2nd Sat (14-11-2026) -> working for even
      const sat2 = calculateWorkingDays("14-11-2026", "14-11-2026", "even");
      expect(sat2.workingDays).toBe(1);

      // 3rd Sat (21-11-2026) -> off for even
      const sat3 = calculateWorkingDays("21-11-2026", "21-11-2026", "even");
      expect(sat3.workingDays).toBe(0);

      // 4th Sat (28-11-2026) -> working for even
      const sat4 = calculateWorkingDays("28-11-2026", "28-11-2026", "even");
      expect(sat4.workingDays).toBe(1);
    });

    it("supports ISO input format (YYYY-MM-DD) interchangeably", () => {
      const res = calculateWorkingDays("2026-11-02", "2026-11-06", "odd");
      expect(res.workingDays).toBe(5);
    });

    it("throws an error when fromDate > toDate", () => {
      expect(() => calculateWorkingDays("10-11-2026", "05-11-2026", "odd")).toThrow(
        /must be less than or equal to/
      );
    });
  });

  describe("deduct.ts", () => {
    it("deducts full working days when balance is sufficient", () => {
      const res = calculateDeduction(10, 3);
      expect(res.deducted).toBe(3);
      expect(res.unpaid).toBe(0);
      expect(res.balanceAfter).toBe(7);
    });

    it("deducts partial days and marks remainder as unpaid when balance is insufficient", () => {
      const res = calculateDeduction(2, 5);
      expect(res.deducted).toBe(2);
      expect(res.unpaid).toBe(3);
      expect(res.balanceAfter).toBe(0);
    });

    it("marks entire duration as unpaid when balance is zero", () => {
      const res = calculateDeduction(0, 4);
      expect(res.deducted).toBe(0);
      expect(res.unpaid).toBe(4);
      expect(res.balanceAfter).toBe(0);
    });

    it("handles zero working days gracefully", () => {
      const res = calculateDeduction(12, 0);
      expect(res.deducted).toBe(0);
      expect(res.unpaid).toBe(0);
      expect(res.balanceAfter).toBe(12);
    });
  });

  describe("overlap.ts", () => {
    const existing = [
      {
        id: "app-1",
        fromDate: "10-11-2026",
        toDate: "15-11-2026",
        status: "in_review",
      },
      {
        id: "app-2",
        fromDate: "20-11-2026",
        toDate: "25-11-2026",
        status: "rejected", // Should NOT cause conflict
      },
      {
        id: "app-3",
        fromDate: "01-12-2026",
        toDate: "05-12-2026",
        status: "approved",
      },
    ];

    it("detects overlap with in_review leave", () => {
      // Overlaps app-1 (10-11 to 15-11)
      const res = checkLeaveOverlap(
        { fromDate: "12-11-2026", toDate: "14-11-2026" },
        existing
      );
      expect(res.hasOverlap).toBe(true);
      expect(res.conflictingApplicationId).toBe("app-1");
    });

    it("detects edge-day overlap", () => {
      // Starts on exact end day of app-1
      const res = checkLeaveOverlap(
        { fromDate: "15-11-2026", toDate: "18-11-2026" },
        existing
      );
      expect(res.hasOverlap).toBe(true);
      expect(res.conflictingApplicationId).toBe("app-1");
    });

    it("ignores rejected applications even if dates match", () => {
      const res = checkLeaveOverlap(
        { fromDate: "21-11-2026", toDate: "23-11-2026" },
        existing
      );
      expect(res.hasOverlap).toBe(false);
    });

    it("detects overlap with approved applications", () => {
      const res = checkLeaveOverlap(
        { fromDate: "02-12-2026", toDate: "03-12-2026" },
        existing
      );
      expect(res.hasOverlap).toBe(true);
      expect(res.conflictingApplicationId).toBe("app-3");
    });

    it("returns false when date range is completely free", () => {
      const res = checkLeaveOverlap(
        { fromDate: "16-11-2026", toDate: "19-11-2026" },
        existing
      );
      expect(res.hasOverlap).toBe(false);
    });
  });

  describe("balance.ts", () => {
    it("parses and formats year-month strings correctly", () => {
      expect(parseYearMonth("2026-11")).toEqual({ year: 2026, month: 11 });
      expect(formatYearMonth(2026, 5)).toBe("2026-05");
    });

    it("returns missing months between two year-months across year boundaries", () => {
      const months = getMissingMonths("2026-10", "2027-02");
      expect(months).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    });

    it("returns empty array if target month is same or earlier than last accrual month", () => {
      expect(getMissingMonths("2026-11", "2026-11")).toEqual([]);
      expect(getMissingMonths("2026-11", "2026-10")).toEqual([]);
    });

    it("computes monthly accruals and caps at 12", () => {
      // Starting balance 10, 3 months missing
      const res = computeMissingAccruals("2026-08", "2026-11", 10, 12);
      expect(res.accruals).toHaveLength(3);
      // Sep: 10 + 1 = 11
      expect(res.accruals[0]).toEqual({ month: "2026-09", change: 1, balanceAfter: 11 });
      // Oct: 11 + 1 = 12 (cap)
      expect(res.accruals[1]).toEqual({ month: "2026-10", change: 1, balanceAfter: 12 });
      // Nov: 12 + 0 = 12 (capped)
      expect(res.accruals[2]).toEqual({ month: "2026-11", change: 0, balanceAfter: 12 });
      expect(res.finalBalance).toBe(12);
    });
  });
});
