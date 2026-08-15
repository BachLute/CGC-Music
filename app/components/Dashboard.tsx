"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VENUE_STATUSES, type Venue, type VenueStatus } from "@/lib/types";
import { draftEmail } from "@/lib/email-template";
import DraftEmailModal from "./DraftEmailModal";
import AddVenueModal from "./AddVenueModal";
import { FindContactButton } from "../../components/FindContactButton";
   import { FindMissingContactButton } from "../../components/FindMissingContactButton";

type SortKey = "name" | "location" | "venue_type" | "capacity" | "status" | "date_added" | "date_last_contacted";

const STATUS_STYLES: Record<VenueStatus, string> = {
  New: "bg-blue-50 text-blue-700 border-blue-200",
  Contacted: "bg-purple-50 text-purple-700 border-purple-200",
  "Follow-up Needed": "bg-amber-50 text-amber-700 border-amber-200",
  Booked: "bg-green-50 text-green-700 border-green-200",
  Passed: "bg-neutral-100 text-neutral-500 border-neutral-200",
  "Opted Out": "bg-red-50 text-red-700 border-red-200",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function csvEscape(value: string | number | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(venues: Venue[]) {
  const headers = [
    "Name", "City", "State", "Venue Type", "Capacity", "Status", "Phone", "Email", "Website",
    "Notes", "Date Added", "Date Last Contacted", "Source Search Profile",
  ];
  const rows = venues.map((v) => [
    v.name, v.city, v.state, v.venue_type, v.capacity, v.status, v.phone, v.email, v.website,
    v.notes, v.date_added ? v.date_added.slice(0, 10) : "", v.date_last_contacted ? v.date_last_contacted.slice(0, 10) : "",
    v.source_profile_name,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `venues-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard({ initialVenues }: { initialVenues: Venue[] }) {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date_added");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [draftFor, setDraftFor] = useState<Venue | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVenues(initialVenues);
  }, [initialVenues]);

  const venueTypes = useMemo(() => {
    const set = new Set<string>();
    for (const v of venues) if (v.venue_type) set.add(v.venue_type);
    return Array.from(set).sort();
  }, [venues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = venues.filter((v) => {
      if (statusFilter !== "All" && v.status !== statusFilter) return false;
      if (typeFilter !== "All" && v.venue_type !== typeFilter) return false;
      if (q) {
        const hay = `${v.name} ${v.city ?? ""} ${v.state ?? ""} ${v.venue_type ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case "location":
          av = `${a.state ?? ""} ${a.city ?? ""}`;
          bv = `${b.state ?? ""} ${b.city ?? ""}`;
          break;
        case "capacity":
          av = a.capacity ?? -1;
          bv = b.capacity ?? -1;
          break;
        case "date_added":
          av = a.date_added;
          bv = b.date_added;
          break;
        case "date_last_contacted":
          av = a.date_last_contacted ?? "";
          bv = b.date_last_contacted ?? "";
          break;
        default:
          av = (a[sortKey] ?? "") as string;
          bv = (b[sortKey] ?? "") as string;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [venues, statusFilter, typeFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleStatusChange(venue: Venue, status: VenueStatus) {
    setBusyId(venue.id);
    setError(null);
    const prev = venues;
    setVenues((vs) => vs.map((v) => (v.id === venue.id ? { ...v, status } : v)));
    try {
      const res = await fetch(`/api/venues/${venue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update status");
      const { venue: updated } = await res.json();
      setVenues((vs) => vs.map((v) => (v.id === venue.id ? updated : v)));
    } catch (err) {
      setVenues(prev);
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  }

  function handleSent(updated: Venue) {
    setVenues((vs) => vs.map((v) => (v.id === updated.id ? updated : v)));
    setDraftFor(null);
  }

  function handleAdded(venue: Venue) {
    setVenues((vs) => [venue, ...vs]);
    setShowAdd(false);
  }

  function handleContactFound(venueId: number, result: { phone?: string | null; email?: string | null; website?: string | null }) {
    setVenues((vs) =>
      vs.map((v) =>
        v.id === venueId
          ? {
              ...v,
              phone: v.phone || result.phone || v.phone,
              email: v.email || result.email || v.email,
              website: v.website || result.website || v.website,
            }
          : v
      )
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Venues</h1>
        <div className="flex flex-wrap items-center gap-2">
          <FindMissingContactButton onComplete={() => router.refresh()} />
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            + Add Venue
          </button>
          <button
            onClick={() => downloadCsv(filtered)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, city, state…"
          className="w-56 rounded-md border border-neutral-300 px-2 py-1.5"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1.5"
        >
          <option value="All">All statuses</option>
          {VENUE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1.5"
        >
          <option value="All">All venue types</option>
          {venueTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-neutral-500">
          {filtered.length} of {venues.length} venues
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th label="Name" sortKey="name" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Location" sortKey="location" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Type" sortKey="venue_type" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Capacity" sortKey="capacity" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Status" sortKey="status" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Added" sortKey="date_added" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th
                label="Last Contacted"
                sortKey="date_last_contacted"
                active={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const optedOut = v.status === "Opted Out";
              return (
                <tr
                  key={v.id}
                  className={`border-b border-neutral-100 last:border-0 ${optedOut ? "opacity-50" : ""}`}
                >
                  <td className="px-3 py-2 font-medium">
                    {v.website ? (
                      
                        href={v.website}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {v.name}
                      </a>
                    ) : (
                      v.name
                    )}
                    {v.notes && <div className="max-w-[220px] truncate text-xs text-neutral-400" title={v.notes}>{v.notes}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {[v.city, v.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{v.venue_type ?? "—"}</td>
                  <td className="px-3 py-2">{v.capacity ?? "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={v.status}
                      disabled={busyId === v.id}
                      onChange={(e) => handleStatusChange(v, e.target.value as VenueStatus)}
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${STATUS_STYLES[v.status]}`}
                    >
                      {VENUE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-neutral-500">{formatDate(v.date_added)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-neutral-500">
                    {formatDate(v.date_last_contacted)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-neutral-500">
                    {v.source_profile_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {!optedOut && (
                        <button
                          onClick={() => setDraftFor(v)}
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
                        >
                          Draft Email
                        </button>
                      )}
                      {!optedOut && (
                        <FindContactButton
                          venueId={v.id}
                          onResult={(result) => handleContactFound(v.id, result)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-neutral-400">
                  No venues match your filters yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {draftFor && (
        <DraftEmailModal
          venue={draftFor}
          initialDraft={draftEmail(draftFor)}
          onClose={() => setDraftFor(null)}
          onSent={handleSent}
        />
      )}

      {showAdd && <AddVenueModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
    </div>
  );
}

function Th({
  label,
  sortKey,
  active,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onClick: (key: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <th
      onClick={() => onClick(sortKey)}
      className="cursor-pointer select-none px-3 py-2 hover:text-neutral-700"
    >
      {label}
      {isActive && <span className="ml-1">{dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}
