/** Storage abstraction for the EkLink mirror (Supabase in the app, in-memory in tests). */

export type PersonRow = {
  login_id: string;
  eklink_sub: string | null;
  name: string;
  email: string;
  eklink_role: string;
  department: string | null;
  batch: string | null;
  section: string | null;
  semester: number | null;
  designation: string | null;
  platform_role: string | null;
  member_type: string | null;
  org_code: string | null;
  institute_code: string | null;
  department_code: string | null;
  is_active: boolean;
  is_demo: boolean;
  deactivated_at: string | null;
};

export const PERSON_COLUMNS = [
  "login_id",
  "eklink_sub",
  "name",
  "email",
  "eklink_role",
  "department",
  "batch",
  "section",
  "semester",
  "designation",
  "platform_role",
  "member_type",
  "org_code",
  "institute_code",
  "department_code",
  "is_active",
  "is_demo",
  "deactivated_at",
] as const;

export type DirectoryRow = {
  path: string;
  level: "organization" | "institute" | "department";
  org_code: string;
  institute_code: string | null;
  code: string;
  name: string;
  is_active: boolean;
  is_demo: boolean;
};

export type ApproverJobRow = {
  eklink_id: string;
  person_login_id: string | null;
  person_sub: string | null;
  title: string;
  scope_level: "organization" | "institute" | "department";
  org_code: string | null;
  institute_code: string | null;
  department_code: string | null;
  scope_key: string | null;
  valid_from: string;
  valid_to: string | null;
};

export type SyncStateRow = {
  last_event_id: number;
  last_pull_at: string | null;
  last_push_at: string | null;
  last_full_sync_at: string | null;
  last_error: string | null;
  last_result: Record<string, unknown> | null;
};

export type SyncStatePatch = Partial<SyncStateRow>;

export interface SyncStore {
  loadPeople(): Promise<PersonRow[]>;
  /** Insert or update by login_id; every row carries all PERSON_COLUMNS. */
  upsertPeople(rows: PersonRow[]): Promise<void>;
  /** people.login_id rename; FKs cascade (migration 0006). */
  renameLoginId(oldLoginId: string, newLoginId: string): Promise<void>;
  upsertDirectory(rows: DirectoryRow[]): Promise<void>;
  upsertApproverJobs(rows: ApproverJobRow[]): Promise<void>;
  /** Jobs whose person was not in ApproveIt when the job arrived. */
  loadUnlinkedJobs(): Promise<Array<{ eklink_id: string; person_sub: string | null }>>;
  setJobPerson(eklinkId: string, loginId: string): Promise<void>;
  getState(): Promise<SyncStateRow>;
  saveState(patch: SyncStatePatch): Promise<void>;
}
