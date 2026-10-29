/**
 * Pure rule to calculate suggested semester from student's batch (e.g. "2023-27")
 * and an optional reference date (defaults to now).
 * 
 * College academic year starts in July (Month index 6, or month 7).
 * idx = (month >= 7 ? year : year - 1) - startYear
 * semester = 2 * idx + (month >= 7 ? 1 : 2)
 * Result clamped to 1..8.
 */
export function calculateSuggestedSemester(batch: string, refDate: Date = new Date()): number {
  if (!batch) return 1;

  const match = batch.match(/^(\d{4})/);
  if (!match) return 1;

  const startYear = parseInt(match[1], 10);
  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1; // 1 to 12

  const academicYear = month >= 7 ? year : year - 1;
  const idx = academicYear - startYear;

  const rawSemester = 2 * idx + (month >= 7 ? 1 : 2);

  if (rawSemester < 1) return 1;
  if (rawSemester > 8) return 8;

  return rawSemester;
}
