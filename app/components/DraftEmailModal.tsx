"use client";

import { useState } from "react";
import type { EmailDraft } from "@/lib/email-template";
import type { Venue } from "@/lib/types";

export default function DraftEmailModal({
  venue,
  initialDraft,
  onClose,
  onSent,
}: {
  venue: Venue;
  initialDraft: EmailDraft;
  onClose: () => void;
  onSent: (venue: Venue) => void;
}) {
  const [subject, setSubject] = useState(initialDraft.subject);
  const [body, setBody] = useState(initialDraft.body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSend = Boolean(venue.email) && !sending && !sent;

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/venues/${venue.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send email");
      setSent(true);
      onSent(data.venue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Draft email to {venue.name}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {!venue.email && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This venue has no email address on file, so this draft can be edited and copied
              manually, but it can&apos;t be sent from here.
            </p>
          )}

          <label className="text-xs font-medium text-neutral-500">To</label>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-600">
            {venue.email ?? "No email on file"}
          </div>

          <label className="text-xs font-medium text-neutral-500">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sent}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />

          <label className="text-xs font-medium text-neutral-500">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={sent}
            rows={14}
            className="rounded-md border border-neutral-300 px-2 py-1.5 font-mono text-xs leading-relaxed"
          />
          <p className="text-xs text-neutral-400">
            The business address and an opt-out line will be appended automatically when sent.
          </p>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {sent && <p className="text-xs font-medium text-green-700">Email sent — status updated to Contacted.</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            {sent ? "Close" : "Cancel"}
          </button>
          {!sent && (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
