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

  return (
    <div
      className={`inline-block border-2 rounded-xl p-4 my-2 font-sans shadow-sm select-none min-w-[280px] max-w-sm transition-all ${
        isRejected
          ? "border-rose-600 bg-rose-50/80 text-rose-950"
          : "border-emerald-600 bg-emerald-50/80 text-emerald-950"
      }`}
    >
      {/* Prominent official seal & badge */}
      <div className="flex items-center gap-3 mb-2.5">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-sm ring-4 ${
            isRejected
              ? "bg-rose-600 text-white ring-rose-100"
              : "bg-emerald-600 text-white ring-emerald-100"
          }`}
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
          <span
            className={`font-black text-sm tracking-wider uppercase block ${
              isRejected ? "text-rose-900" : "text-emerald-900"
            }`}
          >
            {isRejected ? "Digitally Rejected" : "Digitally Verified"}
          </span>
          <span
            className={`text-[10px] font-semibold tracking-wide uppercase ${
              isRejected ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {isRejected ? "Decision Recorded" : "Official College Record"}
          </span>
        </div>
      </div>

      {signatureUrl && (
        <div
          className={`my-2 p-1.5 bg-white/95 rounded-md border shadow-2xs inline-block ${
            isRejected ? "border-rose-200" : "border-emerald-200"
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
        <p className={`font-medium ${isRejected ? "text-rose-950" : "text-emerald-950"}`}>
          {isRejected ? "Rejected by:" : "Verified by:"}{" "}
          <span className="font-bold">{name}</span>
          {designation ? ` (${designation})` : ""}
        </p>
        <p className={`text-[11px] ${isRejected ? "text-rose-800" : "text-emerald-800"}`}>
          {formatToIST(timestamp)}
        </p>
        <p
          className={`font-mono text-[11px] mt-1 tracking-wider font-bold ${
            isRejected ? "text-rose-700" : "text-emerald-700"
          }`}
        >
          ID: {verificationId}
        </p>
      </div>

      <div
        className={`mt-2.5 pt-1.5 border-t text-[10px] leading-tight ${
          isRejected
            ? "border-rose-200 text-rose-700/90"
            : "border-emerald-200 text-emerald-700/90"
        }`}
      >
        Internal electronic record. Not a legal digital signature.
      </div>
    </div>
  );
}
