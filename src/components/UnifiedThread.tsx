"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatToIST } from "@/lib/date";
import { VerifiedStamp } from "./VerifiedStamp";
import type { TimelineItem } from "@/lib/thread";

export function UnifiedThread({
  applicationId,
  timeline,
  canReply,
  signatureUrls = {},
}: {
  applicationId: string;
  timeline: TimelineItem[];
  canReply: boolean;
  signatureUrls?: Record<string, string>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/applications/${applicationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: message.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to post message");
        setSending(false);
        return;
      }

      setMessage("");
      setSending(false);
      router.refresh();
    } catch {
      setError("Network error while sending message");
      setSending(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">
        Activity &amp; Discussion Timeline
      </h3>

      {/* Chronological Timeline */}
      <div className="space-y-6 mb-8">
        {timeline.map((item) => {
          if (item.kind === "step") {
            const sigUrl = item.signature_path ? signatureUrls[item.signature_path] : null;

            return (
              <div
                key={item.id}
                className="border-l-2 border-slate-300 pl-4 py-1 relative space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {item.decision}
                  </span>
                  <span className="text-xs text-slate-600 font-medium">
                    by {item.actor_login_id}
                  </span>
                  <span className="text-xs text-slate-400">• {formatToIST(item.at)}</span>
                </div>

                {item.comment && (
                  <p className="text-xs bg-slate-50 border border-slate-200 p-3 rounded text-slate-800 leading-relaxed">
                    &ldquo;{item.comment}&rdquo;
                  </p>
                )}

                {item.verification_id && (
                  <div className="mt-2">
                    <VerifiedStamp
                      name={item.actor_login_id}
                      designation={item.step_key}
                      verificationId={item.verification_id}
                      timestamp={item.at}
                      signatureUrl={sigUrl}
                    />
                  </div>
                )}
              </div>
            );
          }

          if (item.kind === "message") {
            return (
              <div
                key={item.id}
                className="border-l-2 border-indigo-400 pl-4 py-1 relative space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    💬 Note from {item.author_login_id}
                  </span>
                  <span className="text-xs text-slate-400">• {formatToIST(item.at)}</span>
                </div>
                {/* Escaped plain text rendering (prevents HTML/script injection) */}
                <div className="text-xs bg-indigo-50/50 border border-indigo-100 p-3 rounded text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {item.body}
                </div>
              </div>
            );
          }

          if (item.kind === "attachment") {
            return (
              <div
                key={item.id}
                className="border-l-2 border-emerald-300 pl-4 py-1 relative space-y-1"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                    📎 Document Attached: {item.original_name}
                  </span>
                  <span className="text-slate-400">• {formatToIST(item.at)}</span>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Reply Box */}
      {canReply ? (
        <form onSubmit={handleSendMessage} className="border-t border-slate-100 pt-5">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded mb-3">
              {error}
            </div>
          )}

          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Post a Message or Clarification in this Thread
          </label>
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message (e.g. 'Uploaded the prescription with doctor clinic seal')..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white mb-2"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded transition"
            >
              {sending ? "Sending..." : "Send Message"}
            </button>
          </div>
        </form>
      ) : (
        <div className="border-t border-slate-100 pt-3 text-xs text-slate-400 italic">
          Discussion thread is closed for this application.
        </div>
      )}
    </div>
  );
}
