"use client";

import { useState } from "react";

export function AttachmentItem({
  id,
  originalName,
  sizeBytes,
  mime,
}: {
  id: string;
  originalName: string;
  sizeBytes: number;
  mime: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attachments/${id}/url`);
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        alert(data.error || "Failed to open document");
      }
    } catch {
      alert("Error opening document");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md text-xs hover:border-slate-300 transition">
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="font-mono text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded shrink-0">
          {mime.includes("pdf") ? "PDF" : "IMG"}
        </span>
        <span className="truncate font-medium text-slate-800">{originalName}</span>
        <span className="text-slate-400 shrink-0">
          ({Math.round(sizeBytes / 1024)} KB)
        </span>
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={handleDownload}
        className="ml-3 shrink-0 text-slate-900 font-semibold hover:underline disabled:opacity-50"
      >
        {loading ? "Opening..." : "View File ↗"}
      </button>
    </div>
  );
}
