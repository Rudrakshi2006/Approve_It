import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { submitEmployeeGeneral } from "@/lib/applications/submit-employee";
import { ATTACHMENT_CONFIG } from "@/lib/attachments";

const GeneralSubmitSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
  description: z.string().min(5, "Description must be at least 5 characters"),
  comment: z.string().max(2000).optional().nullable(),
  urgent: z.boolean().default(false),
  attachments: z
    .array(
      z.object({
        storage_path: z.string(),
        original_name: z.string(),
        size_bytes: z.number().max(ATTACHMENT_CONFIG.MAX_FILE_SIZE_BYTES),
        mime: z.string(),
      })
    )
    .max(ATTACHMENT_CONFIG.MAX_FILES_PER_APPLICATION)
    .default([]),
});

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;
  if (session.eklink_role === "student") {
    return NextResponse.json(
      { error: "Students cannot submit employee applications" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = GeneralSubmitSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const result = await submitEmployeeGeneral(session, parseResult.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
