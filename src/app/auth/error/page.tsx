import { getEnv } from "@/lib/env";

const ERROR_MESSAGES: Record<string, string> = {
  state: "Security verification failed (state mismatch or expired). Please try signing in again.",
  signin: "Authentication with EkLink could not be completed. Please try again.",
  invalid_client: "EkLink rejected client credentials (invalid_client). Your EKLINK_CLIENT_ID or EKLINK_CLIENT_SECRET in .env.local does not match EkLink's registry. Please update with the latest secret from the EkLink admin.",
  invalid_grant: "Authorization code was expired or already used. Please click ApproveIt from EkLink again.",
  role_not_allowed: "Your role is not authorized to access ApproveIt. If you believe this is an error, please contact your administrator.",
  login_id_mismatch: "Your account credentials do not match our college records. Please contact the administrator.",
  access_denied: "Access was cancelled or denied by EkLink.",
  account_inactive: "Your account is deactivated, so ApproveIt can no longer be used with it. If you think this is a mistake, please contact your administrator.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; err?: string }>;
}) {
  const { e, err } = await searchParams;
  const env = getEnv();
  const dashboardUrl = `${env.EKLINK_URL}/dashboard`;

  const errorMessage =
    (e && ERROR_MESSAGES[e]) ||
    "An unexpected error occurred during authentication. Please return to EkLink.";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2">Authentication Issue</h1>
        <p className="text-sm text-slate-600 mb-4">{errorMessage}</p>
        {err && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded mb-6 font-mono text-left break-all">
            <span className="font-bold">Diagnostics:</span> {err}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <a
            href={dashboardUrl}
            className="inline-block px-5 py-2.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Back to EkLink
          </a>
          {process.env.NODE_ENV !== "production" && (
            <div className="mt-4 pt-4 border-t border-slate-200 text-left">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                🛠️ Dev Mode: Test with Dev Personas (bypasses EkLink):
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/dev/session?id=24070521003"
                  className="px-2.5 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition"
                >
                  🎓 Akshat (Student)
                </a>
                <a
                  href="/api/dev/session?id=STA5001"
                  className="px-2.5 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition"
                >
                  🏢 Ramesh (Staff)
                </a>
                <a
                  href="/api/dev/session?id=T036"
                  className="px-2.5 py-1.5 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700 transition"
                >
                  👨‍🏫 Dr. Sachin (Incharge)
                </a>
                <a
                  href="/api/dev/session?id=T001"
                  className="px-2.5 py-1.5 bg-purple-600 text-white rounded text-xs font-semibold hover:bg-purple-700 transition"
                >
                  🎓 Dr. Nitin (Director)
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
