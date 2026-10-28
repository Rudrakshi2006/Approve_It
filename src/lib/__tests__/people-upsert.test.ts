import { describe, expect, it } from "vitest";
import { upsertPerson, type Person } from "../people";
import type { EklinkClaims } from "../eklink";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("upsertPerson Database Logic (R5)", () => {
  it("links by sub, login_id, email, preserves semester/signature, and blocks login_id mismatch", async () => {
    const memoryStore: Person[] = [
      {
        login_id: "FAC2001",
        eklink_sub: "existing-uuid-1",
        name: "Prof. Old Name",
        email: "prof@sitnagpur.edu.in",
        eklink_role: "faculty",
        department: "CSE",
        batch: null,
        section: null,
        semester: 4,
        signature_path: "signatures/fac2001.png",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    // Create a lightweight fake Supabase client that exercises our exact query structure
    const fakeClient = {
      from: (table: string) => {
        expect(table).toBe("people");
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              maybeSingle: async () => {
                const found = memoryStore.find((p) => p[col as keyof Person] === val);
                return { data: found ?? null, error: null };
              },
            }),
            ilike: (col: string, val: string) => ({
              maybeSingle: async () => {
                const found = memoryStore.find(
                  (p) => (p[col as keyof Person] as string)?.toLowerCase() === val.toLowerCase()
                );
                return { data: found ?? null, error: null };
              },
            }),
          }),
          update: (fields: Partial<Person>) => ({
            eq: (col: string, val: string) => {
              const idx = memoryStore.findIndex((p) => p[col as keyof Person] === val);
              if (idx !== -1) {
                // Confirm semester and signature_path are NOT in updated fields
                expect((fields as Record<string, unknown>).semester).toBeUndefined();
                expect((fields as Record<string, unknown>).signature_path).toBeUndefined();
                memoryStore[idx] = { ...memoryStore[idx], ...fields };
              }
              return Promise.resolve({ error: null });
            },
          }),
          insert: (record: Person) => {
            memoryStore.push(record);
            return Promise.resolve({ error: null });
          },
        };
      },
    } as unknown as SupabaseClient;

    // 1. Update existing record matched by eklink_sub
    const claimsBySub: EklinkClaims = {
      sub: "existing-uuid-1",
      login_id: "FAC2001",
      name: "Prof. Updated Name",
      email: "prof.updated@sitnagpur.edu.in",
      role: "faculty",
      department: "CSE",
      batch: null,
      section: null,
      ver: 1,
      exp: 1000,
    };

    await upsertPerson(claimsBySub, fakeClient);
    const updated = memoryStore.find((p) => p.login_id === "FAC2001");
    expect(updated?.name).toBe("Prof. Updated Name");
    expect(updated?.semester).toBe(4); // Preserved
    expect(updated?.signature_path).toBe("signatures/fac2001.png"); // Preserved

    // 2. Link pre-seeded record matched by email
    memoryStore.push({
      login_id: "STU1001",
      eklink_sub: null,
      name: "Aarav",
      email: "aarav@sitnagpur.edu.in",
      eklink_role: "student",
      department: "CSE",
      batch: "2023-27",
      section: "A",
      semester: null,
      signature_path: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const claimsByEmail: EklinkClaims = {
      sub: "new-sub-stu1001",
      login_id: "STU1001",
      name: "Aarav Patel",
      email: "aarav@sitnagpur.edu.in",
      role: "student",
      department: "CSE",
      batch: "2023-27",
      section: "A",
      ver: 1,
      exp: 1000,
    };

    await upsertPerson(claimsByEmail, fakeClient);
    const linked = memoryStore.find((p) => p.login_id === "STU1001");
    expect(linked?.eklink_sub).toBe("new-sub-stu1001");

    // 3. Reject if email matches but login_id differs
    const claimsMismatch: EklinkClaims = {
      sub: "intruder-sub",
      login_id: "STU9999", // Different PRN
      name: "Intruder",
      email: "aarav@sitnagpur.edu.in", // Collides with STU1001
      role: "student",
      department: "CSE",
      batch: "2023-27",
      section: "A",
      ver: 1,
      exp: 1000,
    };

    await expect(upsertPerson(claimsMismatch, fakeClient)).rejects.toThrow(
      "login_id_mismatch"
    );
  });
});
