import * as fs from "node:fs";
import * as path from "node:path";
import * as xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("Reading Excel files from private_data/...");

  const facultyPath = path.resolve(process.cwd(), "private_data/Faculty.xlsx");
  const studentPath = path.resolve(process.cwd(), "private_data/Student Login IDs.xlsx");

  if (!fs.existsSync(facultyPath)) {
    console.error("Faculty.xlsx not found");
    return;
  }

  // 1. Process Faculty
  const facultyWb = xlsx.readFile(facultyPath);
  const facultyRows = xlsx.utils.sheet_to_json<Record<string, string>>(
    facultyWb.Sheets[facultyWb.SheetNames[0]]
  );

  const facultyRecords = facultyRows.map((r) => {
    const rawRole = (r.role || "faculty").toLowerCase().trim();
    // Normalize role to allowed list: 'faculty' | 'hod' | 'director'
    let role = "faculty";
    if (rawRole === "hod") role = "hod";
    else if (rawRole.includes("director")) role = "director";

    return {
      login_id: r.login_id?.trim(),
      name: r.login_id_1?.trim(),
      email: r.login_id_2?.trim(),
      eklink_role: role,
      department: "CSE",
    };
  }).filter((r) => r.login_id && r.name && r.email);

  console.log(`Upserting ${facultyRecords.length} faculty/authorities...`);
  const { error: facErr } = await supabase.from("people").upsert(facultyRecords, {
    onConflict: "login_id",
  });

  if (facErr) {
    console.error("Faculty upsert error:", facErr.message);
  } else {
    console.log(`Successfully seeded ${facultyRecords.length} faculty into Supabase people table!`);
  }

  // 2. Set App Roles (Exam Cell & Workflow Admin)
  // T009 is Dr. Pradnya Borkar (Exam Cell)
  const appRoles = [
    { login_id: "T009", app_role: "exam_cell" },
    { login_id: "T001", app_role: "workflow_admin" },
  ];
  await supabase.from("app_roles").upsert(appRoles, { onConflict: "login_id,app_role" });
  console.log("Seeded app_roles: T009 (Exam Cell), T001 (Workflow Admin)");

  // 3. Process Students
  if (fs.existsSync(studentPath)) {
    const studentWb = xlsx.readFile(studentPath);
    const studentRows = xlsx.utils.sheet_to_json<Record<string, string>>(
      studentWb.Sheets[studentWb.SheetNames[0]]
    );

    const studentRecords = studentRows.map((r) => ({
      login_id: String(r.login_id).trim(),
      name: r.login_id_1?.trim(),
      email: r.login_id_2?.trim(),
      eklink_role: "student",
      department: "CSE",
      batch: r.batch?.trim() || "2024-28",
      section: r.section?.trim() || "A",
    })).filter((r) => r.login_id && r.name && r.email);

    console.log(`Upserting ${studentRecords.length} students...`);
    const { error: stuErr } = await supabase.from("people").upsert(studentRecords, {
      onConflict: "login_id",
    });

    if (stuErr) {
      console.error("Students upsert error:", stuErr.message);
    } else {
      console.log(`Successfully seeded ${studentRecords.length} students into Supabase people table!`);
    }
  }

  console.log("All real college data seeded successfully!");
}

run().catch(console.error);
