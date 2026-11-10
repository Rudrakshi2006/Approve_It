import { redirect } from "next/navigation";
import { isSyncAdmin, requirePageSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminNav } from "../AdminNav";
import { LeaveBalancesClient } from "./LeaveBalancesClient";
import { getOrMaterializeLeaveBalances } from "@/lib/leave/service";

export default async function AdminLeaveBalancesPage() {
  const session = await requirePageSession();
  const db = getDb();

  // Same admins as every /admin page: ApproveIt workflow_admin or an EkLink
  // super / org / institute admin (the old "admin" designation is still accepted).
  if (!(await isSyncAdmin(session))) {
    redirect("/inbox");
  }

  // Fetch all non-student employees
  const { data: people } = await db
    .from("people")
    .select("login_id, name, department, designation, saturday_group, eklink_role")
    .neq("eklink_role", "student")
    .order("name", { ascending: true });

  const employees = [];
  for (const p of people || []) {
    const balances = await getOrMaterializeLeaveBalances(p.login_id);
    employees.push({
      login_id: p.login_id,
      name: p.name,
      department: p.department || "General",
      designation: p.designation || p.eklink_role,
      saturday_group: p.saturday_group || "odd",
      medical_balance: balances.medical,
      personal_balance: balances.personal,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Employee Leave Balances &amp; Ledger
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review live balances, lazy accruals, and record append-only administrative adjustments.
          </p>
        </div>

        <AdminNav current="leave-balances" />

        <LeaveBalancesClient employees={employees} />
      </div>
    </div>
  );
}
