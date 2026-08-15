"use client";

import { useState } from "react";

export interface FindContactResult {
  phone: string | null;
  email: string | null;
  website: string | null;
  source: string | null;
}

interface FindContactButtonProps {
  venueId: string | number;
  onResult?: (result: FindContactResult) => void;
}

// Drop this into each venue row's action cell in the dashboard table, e.g.:
//   <FindContactButton venueId={venue.id} onResult={(r) => updateVenueRow(venue.id, r)} />
export function FindContactButton({ venueId, onResult }: FindContactButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/venues/${venueId}/find-contact`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Lookup failed");
      }
      const result: FindContactResult = await response.json();
      onResult?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={error ?? undefined}
      style={{
        padding: "0.35rem 0.65rem",
        fontSize: "0.8rem",
        borderRadius: "6px",
        border: "1px solid #d4d4d4",
        background: error ? "#fef2f2" : "#ffffff",
        color: error ? "#d92d20" : "#111111",
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Searching…" : error ? "Retry" : "Find Contact Info"}
    </button>
  );
}
