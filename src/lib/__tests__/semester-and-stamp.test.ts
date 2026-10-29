import { describe, expect, it } from "vitest";
import { calculateSuggestedSemester } from "../semester";
import {
  generateVerificationId,
  isValidVerificationId,
} from "../stamp/verification-id";

describe("Semester Calculation Rules", () => {
  it("derives correct semester for batch 2024-28 in October 2024 (Semester 1)", () => {
    // Month 10 (October) 2024
    const date = new Date(2024, 9, 15);
    const sem = calculateSuggestedSemester("2024-28", date);
    expect(sem).toBe(1);
  });

  it("derives correct semester for batch 2024-28 in March 2025 (Semester 2)", () => {
    // Month 3 (March) 2025
    const date = new Date(2025, 2, 10);
    const sem = calculateSuggestedSemester("2024-28", date);
    expect(sem).toBe(2);
  });

  it("derives correct semester for batch 2023-27 in October 2024 (Semester 3)", () => {
    // Year 2 of degree: Sem 3
    const date = new Date(2024, 9, 15);
    const sem = calculateSuggestedSemester("2023-27", date);
    expect(sem).toBe(3);
  });

  it("clamps semester to max 8", () => {
    // Old batch: 2018-22 in 2026
    const date = new Date(2026, 9, 15);
    const sem = calculateSuggestedSemester("2018-22", date);
    expect(sem).toBe(8);
  });

  it("clamps semester to min 1", () => {
    // Future date or early calculation
    const date = new Date(2022, 1, 1);
    const sem = calculateSuggestedSemester("2024-28", date);
    expect(sem).toBe(1);
  });
});

describe("Digital Verification Stamp ID", () => {
  it("generates ID matching format AP-XXXX-XXXX", () => {
    const id = generateVerificationId();
    expect(id).toMatch(/^AP-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(isValidVerificationId(id)).toBe(true);
  });

  it("does not contain confusing characters (0, O, 1, I)", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateVerificationId();
      expect(id).not.toMatch(/[0O1IL]/);
    }
  });

  it("generates unique IDs across consecutive invocations", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateVerificationId());
    }
    expect(ids.size).toBe(100);
  });
});
