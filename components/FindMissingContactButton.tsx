"use client";

import { useState } from "react";
import type { FindContactResult } from "./FindContactButton";

export interface FindMissingContactSummary {
  count: number;
  results: Array<FindContactResult & { venueId: string | number; name: string; error?: boolean }>;
}

interface FindMissingContactButtonProps {
  onComplete?: (summary: FindMissingContactSummary) => void;
}

// Drop this above the venues table, next to the existing "Run now" button, e.g.:
//   <FindMissingContactButton onComplete={(summary) => refetchVenues()} />
export function FindMissingContactButton({ onComplete }: FindMissingContactButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<FindMissingContactSummary | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/venues/find-missing-contact", { method: "POST" });
      if (!response.ok) throw new Error("Bulk contact lookup failed");
      const summary: FindMissingContactSummary = await response.json();
      setLastSummary(summary);
      onComplete?.(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk contact lookup failed");
    } finally {
      setLoading(false);
    }
  }

  const foundCount = lastSummary?.results.filter((r) => r.phone || r.email).length ?? 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: "0.5rem 0.9rem",
          fontSize: "0.9rem",
          fontWeight: 500,
          borderRadius: "8px",
          border: "none",
          background: "#111111",
          color: "#ffffff",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Finding contact info…" : "Find Missing Contact Info"}
      </button>

      {error && <span style={{ color: "#d92d20", fontSize: "0.85rem" }}>{error}</span>}

      {!error && lastSummary && (
        <span style={{ color: "#666666", fontSize: "0.85rem" }}>
          Checked {lastSummary.count} venue{lastSummary.count === 1 ? "" : "s"}, found new info for{" "}
          {foundCount}.
        </span>
      )}
    </div>
  );
}
