import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getApplicationById } from "@/lib/repos/applications";
import { generateApplicationPdf } from "@/lib/pdf/generate-application-pdf";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  const { session } = auth;
  const { id } = await context.params;

  const app = await getApplicationById(id);
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // 1. Permission check: applicant or involved approver (outsider -> 404)
  const isApplicant = app.applicant_login_id === session.login_id;
  const isCurrentApprover = app.current_approver_login_id === session.login_id;
  const hasParticipated = app.steps.some((s) => s.actor_login_id === session.login_id);

  if (!isApplicant && !isCurrentApprover && !hasParticipated) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // 2. Status check: only allowed when status is 'approved'
  if (app.status !== "approved") {
    return NextResponse.json(
      { error: "PDF export is only available for fully approved applications" },
      { status: 400 }
    );
  }

  try {
    const pdfBytes = await generateApplicationPdf(app);
    const shortId = app.id.slice(0, 8);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ApproveIt-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
