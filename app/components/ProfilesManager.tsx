"use client";

import { useState } from "react";
import type { SearchProfile, RunResult } from "@/lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ProfilesManager({ initialProfiles }: { initialProfiles: SearchProfile[] }) {
  const [profiles, setProfiles] = useState<SearchProfile[]>(initialProfiles);
  const [editing, setEditing] = useState<SearchProfile | "new" | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [runResults, setRunResults] = useState<Record<number, { text: string; error: boolean }>>(
    {},
  );

  async function handleRun(profile: SearchProfile) {
    setRunningId(profile.id);
    setRunResults((r) => ({ ...r, [profile.id]: { text: "Searching…", error: false } }));
    try {
      const res = await fetch(`/api/search-profiles/${profile.id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      const result: RunResult = data.result;
      setRunResults((r) => ({
        ...r,
        [profile.id]: {
          text: `Ran ${result.queriesRun} searches, found ${result.found} venues — added ${result.inserted} new, skipped ${result.duplicates} duplicates.`,
          error: false,
        },
      }));
      setProfiles((ps) =>
        ps.map((p) => (p.id === profile.id ? { ...p, last_run_at: new Date().toISOString() } : p)),
      );
    } catch (err) {
      setRunResults((r) => ({
        ...r,
        [profile.id]: { text: err instanceof Error ? err.message : "Search failed", error: true },
      }));
    } finally {
      setRunningId(null);
    }
  }

  async function handleToggleActive(profile: SearchProfile) {
    const next = !profile.active;
    setProfiles((ps) => ps.map((p) => (p.id === profile.id ? { ...p, active: next } : p)));
    await fetch(`/api/search-profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    });
  }

  async function handleDelete(profile: SearchProfile) {
    if (!confirm(`Delete search profile "${profile.name}"? Venues it found will be kept.`)) return;
    const res = await fetch(`/api/search-profiles/${profile.id}`, { method: "DELETE" });
    if (res.ok) setProfiles((ps) => ps.filter((p) => p.id !== profile.id));
  }

  function handleSaved(profile: SearchProfile) {
    setProfiles((ps) => {
      const exists = ps.some((p) => p.id === profile.id);
      return exists ? ps.map((p) => (p.id === profile.id ? profile : p)) : [profile, ...ps];
    });
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Search Profiles</h1>
        <button
          onClick={() => setEditing("new")}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
        >
          + New Profile
        </button>
      </div>

      <p className="text-sm text-neutral-500">
        A profile describes what to search for in free text. &quot;Run now&quot; searches the web
        with Claude, breaking your criteria into several narrower queries for better coverage, and
        adds any new venues it finds to the dashboard with status &quot;New&quot;.
      </p>

      <div className="flex flex-col gap-3">
        {profiles.map((p) => (
          <div key={p.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{p.name}</h2>
                  <label className="flex items-center gap-1 text-xs text-neutral-500">
                    <input
                      type="checkbox"
                      checked={p.active}
                      onChange={() => handleToggleActive(p)}
                    />
                    Active
                  </label>
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-500">
                    Schedule: {p.schedule}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">{p.criteria}</p>
                <p className="mt-1 text-xs text-neutral-400">Last run: {formatDate(p.last_run_at)}</p>
                {runResults[p.id] && (
                  <p
                    className={`mt-1 text-xs ${runResults[p.id].error ? "text-red-600" : "text-green-700"}`}
                  >
                    {runResults[p.id].text}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleRun(p)}
                  disabled={runningId === p.id}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {runningId === p.id ? "Running…" : "Run now"}
                </button>
                <button
                  onClick={() => setEditing(p)}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {profiles.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
            No search profiles yet. Create one to start finding venues.
          </p>
        )}
      </div>

      {editing && <ProfileForm profile={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </div>
  );
}

function ProfileForm({
  profile,
  onClose,
  onSaved,
}: {
  profile: SearchProfile | null;
  onClose: () => void;
  onSaved: (profile: SearchProfile) => void;
}) {
  const [name, setName] = useState(profile?.name ?? "");
  const [criteria, setCriteria] = useState(profile?.criteria ?? "");
  const [active, setActive] = useState(profile?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !criteria.trim()) {
      setError("Name and criteria are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = profile ? `/api/search-profiles/${profile.id}` : "/api/search-profiles";
      const method = profile ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), criteria: criteria.trim(), active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save profile");
      onSaved(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold">{profile ? "Edit" : "New"} search profile</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">Criteria</span>
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={6}
              placeholder="e.g. Wedding venues, wineries, and event spaces within 30 miles of Austin, TX that host live acoustic music."
              className="input"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">Schedule</span>
            <select className="input" value="manual" disabled>
              <option value="manual">Manual (run on demand)</option>
            </select>
            <span className="text-xs text-neutral-400">
              Automatic scheduling isn&apos;t supported yet — use &quot;Run now&quot; to search.
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span className="text-xs font-medium text-neutral-500">Active</span>
          </label>
        </div>

        {error && <p className="px-4 text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
