import { redirect } from "next/navigation";
import { isSyncAdmin, requirePageSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminNav } from "../AdminNav";
import { HolidaysClient } from "./HolidaysClient";

export default async function AdminHolidaysPage() {
  const session = await requirePageSession();
  const db = getDb();

  // Same admins as every /admin page: ApproveIt workflow_admin or an EkLink
  // super / org / institute admin (the old "admin" designation is still accepted).
  if (!(await isSyncAdmin(session))) {
    redirect("/inbox");
  }

  const { data: holidays } = await db
    .from("holidays")
    .select("date, name")
    .order("date", { ascending: true });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Official Holidays Roster
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Holidays are automatically excluded from employee leave balance deductions and working day counts.
          </p>
        </div>

        <AdminNav current="holidays" />

        <HolidaysClient initialHolidays={holidays || []} />
      </div>
    </div>
  );
}
