import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { calculateSuggestedSemester } from "@/lib/semester";
import { createSignatureSignedUrl } from "@/lib/signature";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const session = await requirePageSession();
  const db = getDb();

  // Load latest person profile record from database
  const { data: person } = await db
    .from("people")
    .select("semester, signature_path")
    .eq("login_id", session.login_id)
    .maybeSingle();

  const suggestedSemester = calculateSuggestedSemester(session.batch || "");

  let currentSignatureUrl: string | null = null;
  if (person?.signature_path) {
    currentSignatureUrl = await createSignatureSignedUrl(person.signature_path);
  }

  const backLink = session.eklink_role === "student" ? "/" : "/inbox";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={backLink}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            ← Back to Dashboard
          </Link>
          <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
            {session.login_id}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            User Profile &amp; Settings
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review your academic/designation profile, confirm semester, or manage digital signatures.
          </p>
        </div>

        <ProfileClient
          session={session}
          currentSemester={person?.semester ?? null}
          suggestedSemester={suggestedSemester}
          currentSignatureUrl={currentSignatureUrl}
        />
      </main>
    </div>
  );
}
