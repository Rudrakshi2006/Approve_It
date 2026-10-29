import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "./db";
import type { EklinkClaims } from "./eklink";

export type Person = {
  login_id: string;
  eklink_sub: string | null;
  name: string;
  email: string;
  eklink_role: string;
  department: string | null;
  batch: string | null;
  section: string | null;
  semester: number | null;
  signature_path: string | null;
  updated_at: string;
};

/**
 * Upserts a person from verified EkLink claims.
 * Lookup order:
 * 1. sub
 * 2. login_id
 * 3. email (lowercase, only to link pre-seeded accounts)
 *
 * If found by email but login_id differs, rejects to avoid primary key collisions.
 * Preserves semester and signature_path fields.
 */
export async function upsertPerson(
  claims: EklinkClaims,
  client?: SupabaseClient
): Promise<void> {
  const db = client ?? getDb();

  // 1. Try finding by eklink_sub
  let existingPerson: Person | null = null;

  const { data: bySub, error: subError } = await db
    .from("people")
    .select("*")
    .eq("eklink_sub", claims.sub)
    .maybeSingle();

  if (subError) throw new Error("person_lookup_sub_failed");
  if (bySub) {
    existingPerson = bySub as Person;
  }

  // 2. If not found, try finding by login_id
  if (!existingPerson) {
    const { data: byLogin, error: loginError } = await db
      .from("people")
      .select("*")
      .eq("login_id", claims.login_id)
      .maybeSingle();

    if (loginError) throw new Error("person_lookup_login_failed");
    if (byLogin) {
      existingPerson = byLogin as Person;
    }
  }

  // 3. If not found, try finding by lower-case email
  if (!existingPerson && claims.email) {
    const { data: byEmail, error: emailError } = await db
      .from("people")
      .select("*")
      .ilike("email", claims.email.trim().toLowerCase())
      .maybeSingle();

    if (emailError) throw new Error("person_lookup_email_failed");
    if (byEmail) {
      // Security Check: If found by email, login_id must match claims.login_id.
      // We do not silently rewrite the primary key.
      if (byEmail.login_id !== claims.login_id) {
        throw new Error("login_id_mismatch");
      }
      existingPerson = byEmail as Person;
    }
  }

  const nowIso = new Date().toISOString();

  if (existingPerson) {
    // Update existing person while preserving semester and signature_path
    const { error: updateError } = await db
      .from("people")
      .update({
        eklink_sub: claims.sub,
        name: claims.name,
        email: claims.email.trim().toLowerCase(),
        eklink_role: claims.role,
        department: claims.department,
        batch: claims.batch,
        section: claims.section,
        updated_at: nowIso,
      })
      .eq("login_id", existingPerson.login_id);

    if (updateError) throw new Error("person_update_failed");
  } else {
    // Insert new person
    const { error: insertError } = await db.from("people").insert({
      login_id: claims.login_id,
      eklink_sub: claims.sub,
      name: claims.name,
      email: claims.email.trim().toLowerCase(),
      eklink_role: claims.role,
      department: claims.department,
      batch: claims.batch,
      section: claims.section,
      semester: null,
      signature_path: null,
      updated_at: nowIso,
    });

    if (insertError) throw new Error("person_insert_failed");
  }
}
