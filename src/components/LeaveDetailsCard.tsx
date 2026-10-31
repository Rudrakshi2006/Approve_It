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

  const displayDate =
    fromFormatted === toFormatted
      ? fromFormatted
      : `${fromFormatted} to ${toFormatted}`;

  const workingDays = Number(payload.working_days || 0);
  const totalDays = Number(payload.total_days || 0);
  const excludedDays = (payload.excluded_days as Array<{ date: string; reason: string; description?: string }>) || [];

  const balanceSnap = payload.balance_snapshot as {
    balance_before?: number;
    deducted?: number;
    unpaid?: number;
    balance_after?: number;
    deducted_at?: string;
  } | undefined;

  const curBalance = String(balanceSnap?.balance_before ?? payload.balance_at_submission ?? "-");
  const balanceAfter = String(balanceSnap?.balance_after ?? payload.projected_balance_after ?? "-");
  const isDeducted = Boolean(balanceSnap?.deducted_at);

  return (
    <div className="bg-white border-2 border-slate-900 rounded-lg p-5 mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <span className="text-[10px] bg-slate-900 text-white font-mono uppercase px-2 py-0.5 rounded tracking-wide font-bold">
            {leaveType.toUpperCase()} LEAVE DETAILS
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-1">
            {displayDate}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-3 py-1 rounded-full border border-emerald-300">
            {workingDays} Working Day{workingDays === 1 ? "" : "s"}
          </span>
          {fromFormatted !== toFormatted && (
            <span className="text-xs text-slate-500 font-medium">
              ({totalDays} Calendar Days)
            </span>
          )}
        </div>
      </div>

      {/* Excluded breakdown if any non-working days */}
      {excludedDays.length > 0 && (
        <div className="py-3 border-b border-slate-100 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Excluded non-working days ({excludedDays.length}):</span>{" "}
          {excludedDays.map((ex) => (
            <span key={ex.date} className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded mr-1.5 mt-1 font-mono text-[11px]">
              {/^\d{4}-\d{2}-\d{2}$/.test(ex.date) ? formatISOtoDDMMYYYY(ex.date) : ex.date} ({ex.description || ex.reason})
            </span>
          ))}
        </div>
      )}

      {/* Balance Calculation Table */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <span className="text-slate-500 block text-[11px]">
            {isDeducted ? "Balance Before Approval" : "Current Balance"}
          </span>
          <span className="text-base font-bold text-slate-900 font-mono">
            {curBalance} <span className="text-xs font-normal text-slate-500">days</span>
          </span>
        </div>

        <div className="bg-emerald-50 p-3 rounded border border-emerald-200">
          <span className="text-emerald-800 block text-[11px] font-medium">
            Leave Requested
          </span>
          <span className="text-base font-bold text-emerald-900 font-mono">
            {workingDays} <span className="text-xs font-normal text-emerald-700">day{workingDays === 1 ? "" : "s"}</span>
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <span className="text-slate-500 block text-[11px]">
            {isDeducted ? "Balance Remaining" : "Balance After"}
          </span>
          <span className="text-base font-bold text-slate-900 font-mono">
            {balanceAfter} <span className="text-xs font-normal text-slate-500">days</span>
          </span>
        </div>
      </div>
    </div>
  );
}
