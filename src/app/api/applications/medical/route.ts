import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { ATTACHMENT_CONFIG } from "@/lib/attachments";
import { submitApplication } from "@/lib/applications/submit";

const SubmitMedicalSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
  class_teacher_login_id: z.string().min(1, "Please select a Class Teacher"),
  comment: z.string().max(2000).optional().nullable(),
  urgent: z.boolean().default(false),
  payload: z
    .object({
      from_date: z.string().min(1, "Leave From Date is compulsory"),
      to_date: z.string().min(1, "Leave To Date is compulsory"),
    })
    .catchall(z.unknown()),
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

  const result = await submitApplication(session, {
    type: "medical",
    ...parseResult.data,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
