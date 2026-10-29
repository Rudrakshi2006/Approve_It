import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { createAndSubmitApplication } from "@/lib/repos/applications";
import { parseChain } from "@/lib/workflow/chains";
import { calculateSuggestedSemester } from "@/lib/semester";
import { ATTACHMENT_CONFIG } from "@/lib/attachments";
import type { ApplicantSnapshot } from "@/lib/repos/types";

const SubmitMedicalSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
  class_teacher_login_id: z.string().min(1, "Please select a Class Teacher"),
  comment: z.string().max(2000).optional().nullable(),
  urgent: z.boolean().default(false),
  attachments: z
    .array(
      z.object({
        id: z.string().optional(),
        storage_path: z.string(),
        original_name: z.string(),
        size_bytes: z.number().max(ATTACHMENT_CONFIG.MAX_FILE_SIZE_BYTES),
        mime: z.string(),
      })
    )
    .max(ATTACHMENT_CONFIG.MAX_FILES_PER_APPLICATION, "Maximum 10 attachments allowed")
    .default([]),
});

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;

  // Only students can submit student applications
  if (session.eklink_role !== "student") {
    return NextResponse.json(
      { error: "Only students can submit medical applications" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = SubmitMedicalSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { subject, class_teacher_login_id, comment, urgent, attachments } =
    parseResult.data;

  const db = getDb();

  // 1. Verify selected class teacher exists and is faculty
  const { data: facultyPerson, error: facErr } = await db
    .from("people")
    .select("login_id, eklink_role")
    .eq("login_id", class_teacher_login_id)
    .maybeSingle();

  if (facErr || !facultyPerson || facultyPerson.eklink_role !== "faculty") {
    return NextResponse.json(
      { error: "Selected class teacher is invalid or not a faculty member" },
      { status: 422 }
    );
  }

  // 2. Fetch medical chain config
  const { data: typeData, error: typeErr } = await db
    .from("application_types")
    .select("chain")
    .eq("key", "medical")
    .maybeSingle();

  if (typeErr || !typeData) {
    return NextResponse.json(
      { error: "Medical leave workflow is not configured" },
      { status: 500 }
    );
  }

  const chain = parseChain(typeData.chain);

  // 3. Build applicant snapshot (frozen at submit time)
  const semester = calculateSuggestedSemester(session.batch || "");
  const applicantSnapshot: ApplicantSnapshot = {
    name: session.name,
    login_id: session.login_id,
    email: session.email,
    department: session.department || "CSE",
    batch: session.batch || null,
    section: session.section || null,
    semester: semester,
  };

  try {
    // 4. Create and submit application
    const app = await createAndSubmitApplication({
      type: "medical",
      subject,
      applicant_login_id: session.login_id,
      applicant_snapshot: applicantSnapshot,
      class_teacher_login_id,
      payload: { comment: comment || "" },
      urgent,
      chain_snapshot: chain,
      initial_approver_login_id: class_teacher_login_id,
    });

    // 5. Link any uploaded attachments
    if (attachments.length > 0) {
      const rows = attachments.map((att) => ({
        application_id: app.id,
        uploaded_by: session.login_id,
        storage_path: att.storage_path,
        original_name: att.original_name,
        size_bytes: att.size_bytes,
        mime: att.mime,
      }));

      await db.from("attachments").insert(rows);
    }

    return NextResponse.json({ id: app.id }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
