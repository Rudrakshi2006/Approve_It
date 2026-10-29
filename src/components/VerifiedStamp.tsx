import React from "react";
import { formatToIST } from "@/lib/date";

interface VerifiedStampProps {
  name: string;
  designation?: string;
  verificationId: string;
  timestamp: string | Date;
  signatureUrl?: string | null;
}

export function VerifiedStamp({
  name,
  designation,
  verificationId,
  timestamp,
  signatureUrl,
}: VerifiedStampProps) {
  return (
    <div className="inline-block border-2 border-emerald-600 bg-emerald-50/50 rounded-lg p-3 my-2 text-emerald-950 font-sans shadow-sm select-none">
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-emerald-600 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="font-semibold text-sm tracking-wide uppercase text-emerald-900">
          Digitally Verified
        </span>
      </div>

      {signatureUrl && (
        <div className="my-1.5 p-1 bg-white/90 rounded border border-emerald-200 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureUrl}
            alt="Approver Signature"
            className="max-h-10 max-w-[140px] object-contain"
          />
        </div>
      )}

      <div className="mt-1 text-xs">
        <p className="font-medium text-emerald-900">
          Verified by: <span className="font-bold">{name}</span>
          {designation ? ` (${designation})` : ""}
        </p>
        <p className="text-emerald-800">{formatToIST(timestamp)}</p>
        <p className="font-mono text-[11px] text-emerald-700 mt-0.5 tracking-wider font-semibold">
          ID: {verificationId}
        </p>
      </div>

      <div className="mt-2 pt-1 border-t border-emerald-200 text-[10px] text-emerald-700 leading-tight">
        Internal electronic record. Not a legal digital signature.
      </div>
    </div>
  );
}
