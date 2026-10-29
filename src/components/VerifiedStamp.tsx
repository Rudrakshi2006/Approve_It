import React from "react";
import { formatToIST } from "@/lib/date";

interface VerifiedStampProps {
  name: string;
  designation?: string;
  verificationId: string;
  timestamp: string | Date;
  signatureUrl?: string | null;
  decision?: string | null;
}

export function VerifiedStamp({
  name,
  designation,
  verificationId,
  timestamp,
  signatureUrl,
  decision = "approved",
}: VerifiedStampProps) {
  const isRejected = decision === "rejected";
  const isForwarded = decision === "forwarded";

  let borderColor = "border-emerald-600 bg-emerald-50/80 text-emerald-950";
  let ringBadge = "bg-emerald-600 text-white ring-emerald-100";
  let titleColor = "text-emerald-900";
  let subColor = "text-emerald-700";
  let borderDiv = "border-emerald-200 text-emerald-700/90";
  let titleText = "Digitally Verified";
  let subText = "Official College Record";
  let actionPrefix = "Verified by:";

  if (isRejected) {
    borderColor = "border-rose-600 bg-rose-50/80 text-rose-950";
    ringBadge = "bg-rose-600 text-white ring-rose-100";
    titleColor = "text-rose-900";
    subColor = "text-rose-700";
    borderDiv = "border-rose-200 text-rose-700/90";
    titleText = "Digitally Rejected";
    subText = "Decision Recorded";
    actionPrefix = "Rejected by:";
  } else if (isForwarded) {
    borderColor = "border-indigo-600 bg-indigo-50/80 text-indigo-950";
    ringBadge = "bg-indigo-600 text-white ring-indigo-100";
    titleColor = "text-indigo-900";
    subColor = "text-indigo-700";
    borderDiv = "border-indigo-200 text-indigo-700/90";
    titleText = "Digitally Forwarded";
    subText = "Attendance & Details Verified";
    actionPrefix = "Forwarded by:";
  }

  return (
    <div
      className={`inline-block border-2 rounded-xl p-4 my-2 font-sans shadow-sm select-none min-w-[280px] max-w-sm transition-all ${borderColor}`}
    >
      {/* Prominent official seal & badge */}
      <div className="flex items-center gap-3 mb-2.5">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-sm ring-4 ${ringBadge}`}
        >
          {isRejected ? (
            <svg
              className="w-6 h-6 stroke-current"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : isForwarded ? (
            <svg
              className="w-6 h-6 stroke-current"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 stroke-current"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
        <div>
          <span className={`font-black text-sm tracking-wider uppercase block ${titleColor}`}>
            {titleText}
          </span>
          <span className={`text-[10px] font-semibold tracking-wide uppercase ${subColor}`}>
            {subText}
          </span>
        </div>
      </div>

      {signatureUrl && (
        <div
          className={`my-2 p-1.5 bg-white/95 rounded-md border shadow-2xs inline-block ${
            isRejected
              ? "border-rose-200"
              : isForwarded
              ? "border-indigo-200"
              : "border-emerald-200"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureUrl}
            alt="Approver Signature"
            className="max-h-12 max-w-[150px] object-contain"
          />
        </div>
      )}

      <div className="mt-1 text-xs space-y-0.5">
        <p className="font-medium">
          {actionPrefix} <span className="font-bold">{name}</span>
          {designation ? ` (${designation})` : ""}
        </p>
        <p className={`text-[11px] ${subColor}`}>{formatToIST(timestamp)}</p>
        <p
          className={`font-mono text-[11px] mt-1 tracking-wider font-bold ${
            isRejected
              ? "text-rose-700"
              : isForwarded
              ? "text-indigo-700"
              : "text-emerald-700"
          }`}
        >
          ID: {verificationId}
        </p>
      </div>

      <div className={`mt-2.5 pt-1.5 border-t text-[10px] leading-tight ${borderDiv}`}>
        Internal electronic record. Not a legal digital signature.
      </div>
    </div>
  );
}
