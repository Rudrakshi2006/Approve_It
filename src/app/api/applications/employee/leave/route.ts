import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { submitEmployeeLeave } from "@/lib/applications/submit-employee";
import { ATTACHMENT_CONFIG } from "@/lib/attachments";

const LeaveSubmitSchema = z.object({
  leave_type: z.enum(["medical", "personal"]),
  from_date: z.string().min(1, "From date is required"),
  to_date: z.string().optional().nullable(),
  reason: z.string().min(3, "Reason must be at least 3 characters"),
  comment: z.string().max(2000).optional().nullable(),
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
      { error: "Students cannot submit employee leave applications" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = LeaveSubmitSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const effectiveToDate = parseResult.data.to_date && parseResult.data.to_date.trim()
    ? parseResult.data.to_date.trim()
    : parseResult.data.from_date.trim();

  const result = await submitEmployeeLeave(session, {
    ...parseResult.data,
    to_date: effectiveToDate,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      id: result.id,
      working_days: result.working_days,
      unpaid_days: result.unpaid_days,
    },
    { status: 201 }
  );
}
