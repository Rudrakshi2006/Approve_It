import { requirePageSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await requirePageSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center">
        <h1 className="text-xl font-semibold mb-2">ApproveIt</h1>
        <p className="text-sm text-slate-700 mb-6">
          Signed in as <span className="font-medium">{session.name}</span> (
          <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
            {session.eklink_role}
          </span>
          )
        </p>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Logout
          </button>
        </form>
      </div>
    </main>
  );
}
