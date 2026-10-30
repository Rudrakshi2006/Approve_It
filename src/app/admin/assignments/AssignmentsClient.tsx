"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Assignment {
  id: number;
  application_type: string;
  step_key: string;
  approver_login_id: string;
  scope_key: string | null;
}

interface AppRole {
  login_id: string;
  app_role: string;
}

interface Person {
  login_id: string;
  name: string;
  department: string | null;
  eklink_role: string;
}

export function AssignmentsClient({
  initialAssignments,
  initialRoles,
  people,
}: {
  initialAssignments: Assignment[];
  initialRoles: AppRole[];
  people: Person[];
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [roles, setRoles] = useState(initialRoles);

  // New assignment form state
  const [appType, setAppType] = useState("hackathon");
  const [stepKey, setStepKey] = useState("hackathon_incharge");
  const [approverId, setApproverId] = useState("");
  const [scopeKey, setScopeKey] = useState("");
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // New role form state
  const [rolePersonId, setRolePersonId] = useState("");
  const [roleType, setRoleType] = useState<"admin_staff" | "exam_cell" | "workflow_admin">("admin_staff");
  const [submittingRole, setSubmittingRole] = useState(false);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create Assignment
  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!approverId) {
      setMessage({ type: "error", text: "Please select an approver" });
      return;
    }

    setSubmittingAssign(true);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_type: appType,
          step_key: stepKey,
          approver_login_id: approverId,
          scope_key: scopeKey.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to create assignment" });
        setSubmittingAssign(false);
        return;
      }

      setAssignments((prev) => [...prev, data.assignment]);
      setMessage({ type: "success", text: "Approver assignment successfully created!" });
      setApproverId("");
      setScopeKey("");
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "An error occurred while adding assignment" });
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Delete Assignment
  const handleDeleteAssignment = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this approver assignment?")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/assignments/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to delete assignment" });
        return;
      }

      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setMessage({ type: "success", text: "Assignment deleted successfully" });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Network error deleting assignment" });
    }
  };

  // Add App Role
  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!rolePersonId) {
      setMessage({ type: "error", text: "Please select a person" });
      return;
    }

    setSubmittingRole(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: rolePersonId,
          app_role: roleType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to assign role" });
        setSubmittingRole(false);
        return;
      }

      setRoles((prev) => {
        if (prev.some((r) => r.login_id === rolePersonId && r.app_role === roleType)) {
          return prev;
        }
        return [...prev, { login_id: rolePersonId, app_role: roleType }];
      });

      setMessage({ type: "success", text: `Assigned ${roleType} to ${rolePersonId}` });
      setRolePersonId("");
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Network error adding role" });
    } finally {
      setSubmittingRole(false);
    }
  };

  // Delete App Role
  const handleDeleteRole = async (loginId: string, role: string) => {
    if (!window.confirm(`Are you sure you want to remove ${role} from ${loginId}?`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: loginId, app_role: role }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to delete role" });
        return;
      }

      setRoles((prev) => prev.filter((r) => !(r.login_id === loginId && r.app_role === role)));
      setMessage({ type: "success", text: `Removed ${role} from ${loginId}` });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Network error deleting role" });
    }
  };

  const getPersonName = (loginId: string) => {
    const p = people.find((x) => x.login_id === loginId);
    return p ? `${p.name} (${p.login_id})` : loginId;
  };

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded-lg text-sm font-medium border ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 1. Approver Assignments Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Dynamic Approver Assignments
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Configure designated authority in-charges (e.g. Hackathon Incharge) without touching any code.
        </p>

        {/* Existing Assignments Table */}
        <div className="border border-slate-200 rounded-md overflow-hidden mb-6">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="px-4 py-2.5">Workflow Type</th>
                <th className="px-4 py-2.5">Step Key</th>
                <th className="px-4 py-2.5">Designated Approver</th>
                <th className="px-4 py-2.5">Scope / Event</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-400 italic">
                    No approver assignments configured.
                  </td>
                </tr>
              ) : (
                assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-900 capitalize">
                      {a.application_type}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{a.step_key}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {getPersonName(a.approver_login_id)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.scope_key || <span className="text-slate-400">Global (All)</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteAssignment(a.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Assignment Form */}
        <form onSubmit={handleAddAssignment} className="bg-slate-50 border border-slate-200 rounded-md p-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            + Add New Approver Assignment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Workflow Type
              </label>
              <select
                value={appType}
                onChange={(e) => setAppType(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
              >
                <option value="hackathon">Hackathon</option>
                <option value="re_ca">Re-CA</option>
                <option value="medical">Medical</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Step Key
              </label>
              <input
                type="text"
                required
                value={stepKey}
                onChange={(e) => setStepKey(e.target.value)}
                placeholder="e.g. hackathon_incharge"
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
              >
              </input>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Approver Faculty / Person
              </label>
              <select
                required
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
              >
                <option value="">-- Choose Approver --</option>
                {people
                  .filter((p) => p.eklink_role !== "student")
                  .map((p) => (
                    <option key={p.login_id} value={p.login_id}>
                      {p.name} ({p.login_id})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <div className="grow">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Scope Key (Optional)
                </label>
                <input
                  type="text"
                  value={scopeKey}
                  onChange={(e) => setScopeKey(e.target.value)}
                  placeholder="null for global"
                  className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={submittingAssign}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded shrink-0 shadow-sm"
              >
                {submittingAssign ? "Saving..." : "Add Assignment"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 2. App Roles Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Special Application Roles (app_roles)
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Designate Admin Staff (attendance forward), Exam Cell (Re-CA approval), and Workflow Admins.
        </p>

        {/* Roles Table */}
        <div className="border border-slate-200 rounded-md overflow-hidden mb-6">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="px-4 py-2.5">Designation Role</th>
                <th className="px-4 py-2.5">Assigned Person</th>
                <th className="px-4 py-2.5">Login ID</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((r) => (
                <tr key={`${r.login_id}-${r.app_role}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">
                      {r.app_role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {getPersonName(r.login_id)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{r.login_id}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteRole(r.login_id, r.app_role)}
                      className="text-rose-600 hover:text-rose-800 font-bold"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Role Form */}
        <form onSubmit={handleAddRole} className="bg-slate-50 border border-slate-200 rounded-md p-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            + Assign App Role to Person
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Select Person
              </label>
              <select
                required
                value={rolePersonId}
                onChange={(e) => setRolePersonId(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
              >
                <option value="">-- Choose Person --</option>
                {people
                  .filter((p) => p.eklink_role !== "student")
                  .map((p) => (
                    <option key={p.login_id} value={p.login_id}>
                      {p.name} ({p.login_id})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                App Role Designation
              </label>
              <select
                value={roleType}
                onChange={(e) =>
                  setRoleType(e.target.value as "admin_staff" | "exam_cell" | "workflow_admin")
                }
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
              >
                <option value="admin_staff">admin_staff (Attendance Forwarding)</option>
                <option value="exam_cell">exam_cell (Re-CA Approvals)</option>
                <option value="workflow_admin">workflow_admin (Admin Panel Access)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submittingRole}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold py-2 rounded shadow-sm"
              >
                {submittingRole ? "Assigning..." : "Assign Designation"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
