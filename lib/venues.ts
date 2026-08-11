import { ensureSchema, sql } from "./db";
import type { Venue, VenueStatus } from "./types";

function normalize(row: Record<string, unknown>): Venue {
  return {
    id: row.id as number,
    name: row.name as string,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    venue_type: (row.venue_type as string) ?? null,
    capacity: (row.capacity as number) ?? null,
    notes: (row.notes as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    website: (row.website as string) ?? null,
    status: row.status as VenueStatus,
    date_added: new Date(row.date_added as string).toISOString(),
    date_last_contacted: row.date_last_contacted
      ? new Date(row.date_last_contacted as string).toISOString()
      : null,
    source_profile_id: (row.source_profile_id as number) ?? null,
    source_profile_name: (row.source_profile_name as string) ?? null,
  };
}

export async function listVenues(): Promise<Venue[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM venues ORDER BY date_added DESC;`;
  return rows.map(normalize);
}

export async function getVenue(id: number): Promise<Venue | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM venues WHERE id = ${id};`;
  return rows[0] ? normalize(rows[0]) : null;
}

export interface NewVenueInput {
  name: string;
  city?: string | null;
  state?: string | null;
  venue_type?: string | null;
  capacity?: number | null;
  notes?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  status?: VenueStatus;
  source_profile_id?: number | null;
  source_profile_name?: string | null;
}

export async function createVenue(input: NewVenueInput): Promise<Venue> {
  await ensureSchema();
  const { rows } = await sql`
    INSERT INTO venues (
      name, city, state, venue_type, capacity, notes, phone, email, website,
      status, source_profile_id, source_profile_name
    ) VALUES (
      ${input.name}, ${input.city ?? null}, ${input.state ?? null},
      ${input.venue_type ?? null}, ${input.capacity ?? null}, ${input.notes ?? null},
      ${input.phone ?? null}, ${input.email ?? null}, ${input.website ?? null},
      ${input.status ?? "New"}, ${input.source_profile_id ?? null},
      ${input.source_profile_name ?? null}
    )
    RETURNING *;
  `;
  return normalize(rows[0]);
}

export interface VenueUpdate {
  name?: string;
  city?: string | null;
  state?: string | null;
  venue_type?: string | null;
  capacity?: number | null;
  notes?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  status?: VenueStatus;
  date_last_contacted?: string | null;
}

export async function updateVenue(id: number, update: VenueUpdate): Promise<Venue | null> {
  await ensureSchema();
  const existing = await getVenue(id);
  if (!existing) return null;

  // Strip undefined keys so a partial PATCH (e.g. just { status }) doesn't
  // blow away other fields — object spread copies `undefined` values too.
  const definedUpdate = Object.fromEntries(
    Object.entries(update).filter(([, v]) => v !== undefined),
  );
  const merged: Venue = { ...existing, ...definedUpdate } as Venue;

  const { rows } = await sql`
    UPDATE venues SET
      name = ${merged.name},
      city = ${merged.city},
      state = ${merged.state},
      venue_type = ${merged.venue_type},
      capacity = ${merged.capacity},
      notes = ${merged.notes},
      phone = ${merged.phone},
      email = ${merged.email},
      website = ${merged.website},
      status = ${merged.status},
      date_last_contacted = ${
        update.date_last_contacted !== undefined
          ? update.date_last_contacted
          : existing.date_last_contacted
      }
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows[0] ? normalize(rows[0]) : null;
}

export async function deleteVenue(id: number): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await sql`DELETE FROM venues WHERE id = ${id};`;
  return (rowCount ?? 0) > 0;
}

/** Case-insensitive name+city lookup, used to dedupe incoming search results. */
export async function findVenueByNameCity(name: string, city: string | null): Promise<boolean> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id FROM venues
    WHERE LOWER(name) = LOWER(${name})
      AND LOWER(COALESCE(city, '')) = LOWER(${city ?? ""})
    LIMIT 1;
  `;
  return rows.length > 0;
}
