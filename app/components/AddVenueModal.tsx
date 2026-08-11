"use client";

import { useState } from "react";
import type { Venue } from "@/lib/types";

const emptyForm = {
  name: "",
  city: "",
  state: "",
  venue_type: "",
  capacity: "",
  phone: "",
  email: "",
  website: "",
  notes: "",
};

export default function AddVenueModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (venue: Venue) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          venue_type: form.venue_type.trim() || null,
          capacity: form.capacity ? Number(form.capacity) : null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          website: form.website.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add venue");
      onAdded(data.venue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add venue");
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
          <h2 className="text-sm font-semibold">Add venue</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto px-4 py-3 text-sm">
          <Field label="Name *" className="col-span-2">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" required />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className="input" />
          </Field>
          <Field label="State">
            <input value={form.state} onChange={(e) => set("state", e.target.value)} className="input" />
          </Field>
          <Field label="Venue Type">
            <input value={form.venue_type} onChange={(e) => set("venue_type", e.target.value)} className="input" />
          </Field>
          <Field label="Capacity (approx)">
            <input
              type="number"
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" />
          </Field>
          <Field label="Email">
            <input value={form.email} onChange={(e) => set("email", e.target.value)} className="input" />
          </Field>
          <Field label="Website" className="col-span-2">
            <input value={form.website} onChange={(e) => set("website", e.target.value)} className="input" />
          </Field>
          <Field label="Notes" className="col-span-2">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="input" />
          </Field>
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
            {saving ? "Saving…" : "Add venue"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
