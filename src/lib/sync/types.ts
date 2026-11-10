import { z } from "zod";

/** Event shapes from SYNC_CONTRACT.md section 4. Unknown fields are ignored. */

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "invalid uuid")
  .transform((v) => v.toLowerCase());

const code = z
  .string()
  .trim()
  .max(32)
  .transform((v) => v.toUpperCase());
const nullableCode = code.nullable().optional().transform((v) => (v ? v : null));
const nullableText = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v === undefined || v === null || v === "" ? null : v));

export const PersonUpsertedSchema = z.object({
  sub: uuid,
  login_id: z.string().trim().min(1),
  email: z.string().trim().min(1),
  name: z.string().trim().min(1),
  role: z.string().trim().min(1),
  platform_role: nullableText,
  member_type: z
    .enum(["faculty", "staff", "student"])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  org_code: nullableCode,
  institute_code: nullableCode,
  department_code: nullableCode,
  batch: nullableText,
  section: nullableText,
  semester: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : null;
    }),
  designation: nullableText,
  is_active: z.boolean().optional().default(true),
  is_demo: z.boolean().optional().default(false),
});
export type PersonUpserted = z.infer<typeof PersonUpsertedSchema>;

export const LoginIdChangedSchema = z.object({
  sub: uuid,
  old_login_id: z.string().trim().min(1),
  new_login_id: z.string().trim().min(1),
});
export type LoginIdChanged = z.infer<typeof LoginIdChangedSchema>;

export const DirectoryUpsertedSchema = z.object({
  level: z.enum(["organization", "institute", "department"]),
  code,
  name: z.string().trim().min(1),
  org_code: nullableCode,
  institute_code: nullableCode,
  is_active: z.boolean().optional().default(true),
  is_demo: z.boolean().optional().default(false),
});
export type DirectoryUpserted = z.infer<typeof DirectoryUpsertedSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/)
  .transform((v) => v.slice(0, 10));

export const ApproverUpsertedSchema = z.object({
  id: uuid,
  person_sub: uuid.nullable().optional().transform((v) => v ?? null),
  login_id: nullableText,
  title: z.string().trim().min(1),
  scope_level: z.enum(["organization", "institute", "department"]),
  org_code: nullableCode,
  institute_code: nullableCode,
  department_code: nullableCode,
  scope_key: nullableText,
  valid_from: isoDate,
  valid_to: isoDate.nullable().optional().transform((v) => v ?? null),
});
export type ApproverUpserted = z.infer<typeof ApproverUpsertedSchema>;

export const EventSchema = z.object({
  id: z.union([z.number().int(), z.string().regex(/^\d+$/)]).transform((v) => Number(v)),
  type: z.string().min(1),
  at: z.string().optional(),
  data: z.unknown(),
});
export type SyncEvent = z.infer<typeof EventSchema>;

export const EventsArraySchema = z.array(EventSchema).max(1000);

export const ChangesResponseSchema = z.object({
  events: EventsArraySchema,
  last_event_id: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  has_more: z.boolean().optional().default(false),
});
export type ChangesResponse = z.infer<typeof ChangesResponseSchema>;

export const SnapshotResponseSchema = z.object({
  last_event_id: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  directory: z.array(z.unknown()).default([]),
  people: z.array(z.unknown()).default([]),
  approvers: z.array(z.unknown()).default([]),
});
export type SnapshotResponse = z.infer<typeof SnapshotResponseSchema>;

export type SyncCounts = {
  received: number;
  applied: number;
  skipped_old: number;
  skipped_unknown: number;
  invalid: number;
  people_inserted: number;
  people_updated: number;
  people_deactivated: number;
  login_ids_renamed: number;
  directory_upserted: number;
  approvers_upserted: number;
  conflicts: string[];
};

export function emptyCounts(): SyncCounts {
  return {
    received: 0,
    applied: 0,
    skipped_old: 0,
    skipped_unknown: 0,
    invalid: 0,
    people_inserted: 0,
    people_updated: 0,
    people_deactivated: 0,
    login_ids_renamed: 0,
    directory_upserted: 0,
    approvers_upserted: 0,
    conflicts: [],
  };
}
