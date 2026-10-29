import { z } from "zod";
import { ALLOWED_ROLES } from "@/lib/auth";

export const CsvPersonRowSchema = z.object({
  login_id: z.string().min(1, "login_id is required"),
  name: z.string().min(1, "name is required"),
  college_email: z.string().email("Invalid college email format"),
  role: z.enum(ALLOWED_ROLES),
  department: z.string().optional().nullable(),
});

export interface ParsedCsvResult {
  valid: boolean;
  error?: string;
  rows?: Array<z.infer<typeof CsvPersonRowSchema>>;
}

export function parseAndValidateCsv(csvText: string): ParsedCsvResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { valid: false, error: "CSV file is empty or missing data rows" };
  }

  // Verify header
  const header = lines[0].toLowerCase().split(",").map((c) => c.trim());
  const expectedCols = ["login_id", "name", "college_email", "role", "department"];
  const hasExpectedHeaders = expectedCols.every((col) => header.includes(col));

  if (!hasExpectedHeaders) {
    return {
      valid: false,
      error: `Invalid CSV header. Expected columns: ${expectedCols.join(",")}`,
    };
  }

  const colIdx = {
    login_id: header.indexOf("login_id"),
    name: header.indexOf("name"),
    college_email: header.indexOf("college_email"),
    role: header.indexOf("role"),
    department: header.indexOf("department"),
  };

  const parsedRows: Array<z.infer<typeof CsvPersonRowSchema>> = [];
  const seenLoginIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const values = rawLine.split(",").map((v) => v.trim());

    if (values.length < 4) {
      return { valid: false, error: `Line ${i + 1} has insufficient columns` };
    }

    const rawObj = {
      login_id: values[colIdx.login_id] || "",
      name: values[colIdx.name] || "",
      college_email: values[colIdx.college_email] || "",
      role: (values[colIdx.role] || "").toLowerCase(),
      department: values[colIdx.department] || null,
    };

    const rowResult = CsvPersonRowSchema.safeParse(rawObj);
    if (!rowResult.success) {
      return {
        valid: false,
        error: `Line ${i + 1} (${rawObj.login_id || "unknown"}): ${rowResult.error.issues[0]?.message}`,
      };
    }

    if (seenLoginIds.has(rowResult.data.login_id)) {
      return {
        valid: false,
        error: `Duplicate login_id '${rowResult.data.login_id}' found on line ${i + 1}`,
      };
    }
    seenLoginIds.add(rowResult.data.login_id);

    parsedRows.push(rowResult.data);
  }

  if (parsedRows.length > 1000) {
    return { valid: false, error: "CSV exceeds maximum batch limit of 1000 rows" };
  }

  return { valid: true, rows: parsedRows };
}
