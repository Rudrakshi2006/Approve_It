import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const personCsvRowSchema = z.object({
  login_id: z.string().min(1),
  name: z.string().min(1),
  college_email: z.string().email(),
  role: z.enum(["student", "faculty", "staff", "hod", "director", "admin"]),
  department: z.string().optional().nullable(),
});

const appRoleCsvRowSchema = z.object({
  login_id: z.string().min(1),
  app_role: z.enum(["admin_staff", "exam_cell", "workflow_admin"]),
});

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes("--yes")) {
    console.error("Refusing to seed without explicit confirmation. Pass '--yes' to execute.");
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment.");
    process.exit(1);
  }

  const db = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const peopleCsvPath = path.resolve(process.cwd(), "supabase/seed/people.dummy.csv");
  const appRolesCsvPath = path.resolve(process.cwd(), "supabase/seed/app_roles.dummy.csv");

  if (!fs.existsSync(peopleCsvPath)) {
    console.error(`File not found: ${peopleCsvPath}`);
    process.exit(1);
  }

  const rawPeople = fs.readFileSync(peopleCsvPath, "utf-8");
  const peopleRows = parseCsv(rawPeople);

  let peopleInserted = 0;
  let peopleUpdated = 0;

  for (const raw of peopleRows) {
    const parsed = personCsvRowSchema.parse({
      login_id: raw.login_id,
      name: raw.name,
      college_email: raw.college_email,
      role: raw.role,
      department: raw.department || null,
    });

    const { data: existing } = await db
      .from("people")
      .select("login_id, eklink_sub, semester, signature_path")
      .eq("login_id", parsed.login_id)
      .maybeSingle();

    const nowIso = new Date().toISOString();

    if (existing) {
      // Update while preserving eklink_sub, semester, signature_path
      const { error } = await db
        .from("people")
        .update({
          name: parsed.name,
          email: parsed.college_email.toLowerCase(),
          eklink_role: parsed.role,
          department: parsed.department,
          updated_at: nowIso,
        })
        .eq("login_id", parsed.login_id);

      if (error) throw new Error(`Failed to update person ${parsed.login_id}: ${error.message}`);
      peopleUpdated++;
    } else {
      const { error } = await db.from("people").insert({
        login_id: parsed.login_id,
        name: parsed.name,
        email: parsed.college_email.toLowerCase(),
        eklink_role: parsed.role,
        department: parsed.department,
        eklink_sub: null,
        semester: null,
        signature_path: null,
        updated_at: nowIso,
      });

      if (error) throw new Error(`Failed to insert person ${parsed.login_id}: ${error.message}`);
      peopleInserted++;
    }
  }

  let rolesSeeded = 0;
  if (fs.existsSync(appRolesCsvPath)) {
    const rawRoles = fs.readFileSync(appRolesCsvPath, "utf-8");
    const roleRows = parseCsv(rawRoles);

    for (const raw of roleRows) {
      const parsed = appRoleCsvRowSchema.parse({
        login_id: raw.login_id,
        app_role: raw.app_role,
      });

      const { error } = await db.from("app_roles").upsert(
        {
          login_id: parsed.login_id,
          app_role: parsed.app_role,
        },
        { onConflict: "login_id,app_role" }
      );

      if (error) throw new Error(`Failed to upsert app_role: ${error.message}`);
      rolesSeeded++;
    }
  }

  // Print COUNTS ONLY (no emails, no personal data)
  console.log(`Seeding complete:`);
  console.log(`- People inserted: ${peopleInserted}`);
  console.log(`- People updated: ${peopleUpdated}`);
  console.log(`- App roles seeded: ${rolesSeeded}`);
}

main().catch((err) => {
  console.error("Seeding failed with error:", err.message);
  process.exit(1);
});
