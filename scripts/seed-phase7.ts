import { createClient } from "@supabase/supabase-js";

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

  console.log("Seeding Phase 7 test data...");

  // 1. Assign Saturday groups to seeded faculty & staff
  const saturdayAssignments = [
    { login_id: "T036", group: "odd" }, // Dr. Sachin Harne
    { login_id: "T017", group: "even" }, // Dr. Mrudula Nimbarte
    { login_id: "T004", group: "odd" }, // Dr. Sagarkumar Badhiye (HOD)
    { login_id: "STA5001", group: "even" }, // Ramesh Pawar (Staff)
  ];

  for (const item of saturdayAssignments) {
    const { error } = await db
      .from("people")
      .update({ saturday_group: item.group })
      .eq("login_id", item.login_id);

    if (error) {
      console.warn(`Could not set saturday_group for ${item.login_id}: ${error.message}`);
    } else {
      console.log(`✓ Set ${item.login_id} saturday_group = ${item.group}`);
    }
  }

  // 2. Seed dummy holiday
  const { error: holErr } = await db.from("holidays").upsert(
    {
      date: "2026-11-05",
      name: "College Foundation Day / Holiday",
    },
    { onConflict: "date" }
  );
  if (holErr) {
    console.warn("Could not seed holiday (table might not exist yet):", holErr.message);
  } else {
    console.log("✓ Seeded holiday: 2026-11-05");
  }

  // 3. Seed default app_settings
  const defaultSettings = [
    { key: "leave_cap_per_type", value: 12 },
    { key: "monthly_accrual", value: 1 },
    { key: "fifth_saturday_working", value: false },
    { key: "general_categories", value: ["MOM", "Report", "Event proposal", "Other"] },
  ];

  for (const s of defaultSettings) {
    const { error } = await db.from("app_settings").upsert(
      {
        key: s.key,
        value: s.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) {
      console.warn(`Could not seed app_setting ${s.key}:`, error.message);
    } else {
      console.log(`✓ Seeded app_setting: ${s.key}`);
    }
  }

  // 4. Seed opening balances for Dr. Sachin Harne (T036) if ledger exists
  const openingRecords = [
    {
      login_id: "T036",
      leave_type: "medical",
      kind: "opening",
      period: "2026-09",
      days: 2.0,
      balance_before: 0.0,
      balance_after: 2.0,
      note: "Initial opening balance for testing",
      created_by: "system_seed",
    },
    {
      login_id: "T036",
      leave_type: "personal",
      kind: "opening",
      period: "2026-09",
      days: 6.0,
      balance_before: 0.0,
      balance_after: 6.0,
      note: "Initial opening balance for testing",
      created_by: "system_seed",
    },
  ];

  for (const rec of openingRecords) {
    const { data: existing } = await db
      .from("leave_ledger")
      .select("id")
      .eq("login_id", rec.login_id)
      .eq("leave_type", rec.leave_type)
      .eq("kind", "opening")
      .maybeSingle();

    if (!existing) {
      const { error } = await db.from("leave_ledger").insert(rec);
      if (error) {
        console.warn(`Could not seed ledger opening for ${rec.login_id}:`, error.message);
      } else {
        console.log(`✓ Seeded opening balance for ${rec.login_id} (${rec.leave_type}: ${rec.days})`);
      }
    }
  }

  console.log("Phase 7 seeding completed.");
}

main().catch((e) => {
  console.error("Seed script failed:", e);
  process.exit(1);
});
