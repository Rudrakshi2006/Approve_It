import { formatISOtoDDMMYYYY } from "@/lib/dates";

interface LeaveDetailsCardProps {
  payload?: Record<string, unknown> | null;
  status: string;
}

export function LeaveDetailsCard({ payload, status }: LeaveDetailsCardProps) {
  if (!payload || !payload.leave_type) return null;

  const leaveType = String(payload.leave_type);
  const fromDateRaw = String(payload.from_date || "");
  const toDateRaw = String(payload.to_date || "");
  const fromFormatted = /^\d{4}-\d{2}-\d{2}$/.test(fromDateRaw)
    ? formatISOtoDDMMYYYY(fromDateRaw)
    : fromDateRaw;
  const toFormatted = /^\d{4}-\d{2}-\d{2}$/.test(toDateRaw)
    ? formatISOtoDDMMYYYY(toDateRaw)
    : toDateRaw;

  const workingDays = Number(payload.working_days || 0);
  const totalDays = Number(payload.total_days || 0);
  const excludedDays = (payload.excluded_days as Array<{ date: string; reason: string; description?: string }>) || [];

  const balanceSnap = payload.balance_snapshot as {
    balance_before?: number;
    deducted?: number;
    unpaid?: number;
    balance_after?: number;
  } | undefined;

  const curBalance = balanceSnap?.balance_before ?? payload.balance_at_submission ?? "-";
  const deducted = balanceSnap?.deducted ?? payload.projected_deducted ?? "-";
  const unpaid = balanceSnap?.unpaid ?? payload.projected_unpaid ?? 0;
  const balanceAfter = balanceSnap?.balance_after ?? payload.projected_balance_after ?? "-";

  const isDeducted = Boolean(balanceSnap?.deducted_at);

  return (
    <div className="bg-white border-2 border-slate-900 rounded-lg p-5 mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <span className="text-[10px] bg-slate-900 text-white font-mono uppercase px-2 py-0.5 rounded tracking-wide font-bold">
            {leaveType.toUpperCase()} LEAVE BREAKDOWN
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-1">
            {fromFormatted} to {toFormatted}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-3 py-1 rounded-full border border-emerald-300">
            {workingDays} Working Days
          </span>
          <span className="text-xs text-slate-500 font-medium">
            ({totalDays} Calendar Days)
          </span>
        </div>
      </div>

      {/* Excluded breakdown if any non-working days */}
      {excludedDays.length > 0 && (
        <div className="py-3 border-b border-slate-100 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Excluded non-working days ({excludedDays.length}):</span>{" "}
          {excludedDays.map((ex, i) => (
            <span key={ex.date} className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded mr-1.5 mt-1 font-mono text-[11px]">
              {/^\d{4}-\d{2}-\d{2}$/.test(ex.date) ? formatISOtoDDMMYYYY(ex.date) : ex.date} ({ex.description || ex.reason})
            </span>
          ))}
        </div>
      )}

      {/* Balance Calculation Table */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <span className="text-slate-500 block text-[11px]">
            {isDeducted ? "Balance Before Approval" : "Balance at Submission"}
          </span>
          <span className="text-base font-bold text-slate-900 font-mono">
            {curBalance} <span className="text-xs font-normal text-slate-500">days</span>
          </span>
        </div>

        <div className="bg-emerald-50 p-3 rounded border border-emerald-200">
          <span className="text-emerald-800 block text-[11px] font-medium">
            {isDeducted ? "Paid Days Deducted" : "Projected Paid Deduction"}
          </span>
          <span className="text-base font-bold text-emerald-900 font-mono">
            {deducted} <span className="text-xs font-normal text-emerald-700">days</span>
          </span>
        </div>

        <div className={`p-3 rounded border ${Number(unpaid) > 0 ? "bg-rose-50 border-rose-300" : "bg-slate-50 border-slate-200"}`}>
          <span className={`block text-[11px] font-medium ${Number(unpaid) > 0 ? "text-rose-800" : "text-slate-500"}`}>
            {isDeducted ? "Unpaid Leave Days" : "Projected Unpaid Leave"}
          </span>
          <span className={`text-base font-bold font-mono ${Number(unpaid) > 0 ? "text-rose-900" : "text-slate-900"}`}>
            {unpaid} <span className="text-xs font-normal">days</span>
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <span className="text-slate-500 block text-[11px]">
            {isDeducted ? "Balance Remaining" : "Projected Balance After"}
          </span>
          <span className="text-base font-bold text-slate-900 font-mono">
            {balanceAfter} <span className="text-xs font-normal text-slate-500">days</span>
          </span>
        </div>
      </div>

      {/* Warning for Unpaid Leave */}
      {Number(unpaid) > 0 && (
        <div className="mt-3.5 bg-rose-50 border border-rose-200 rounded p-2.5 text-xs text-rose-900 flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span>
            <strong>Insufficient Leave Balance:</strong> {unpaid} working day(s) will be processed as <strong>UNPAID LEAVE</strong> upon final approval.
          </span>
        </div>
      )}
    </div>
  );
}
