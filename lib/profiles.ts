import { ensureSchema, sql } from "./db";
import type { SearchProfile } from "./types";

function normalize(row: Record<string, unknown>): SearchProfile {
  return {
    id: row.id as number,
    name: row.name as string,
    criteria: row.criteria as string,
    schedule: row.schedule as string,
    active: row.active as boolean,
    created_at: new Date(row.created_at as string).toISOString(),
    last_run_at: row.last_run_at ? new Date(row.last_run_at as string).toISOString() : null,
  };
}

export async function listProfiles(): Promise<SearchProfile[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM search_profiles ORDER BY created_at DESC;`;
  return rows.map(normalize);
}

export async function getProfile(id: number): Promise<SearchProfile | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM search_profiles WHERE id = ${id};`;
  return rows[0] ? normalize(rows[0]) : null;
}

export interface NewProfileInput {
  name: string;
  criteria: string;
  schedule?: string;
  active?: boolean;
}

export async function createProfile(input: NewProfileInput): Promise<SearchProfile> {
  await ensureSchema();
  const { rows } = await sql`
    INSERT INTO search_profiles (name, criteria, schedule, active)
    VALUES (${input.name}, ${input.criteria}, ${input.schedule ?? "manual"}, ${input.active ?? true})
    RETURNING *;
  `;
  return normalize(rows[0]);
}

export interface ProfileUpdate {
  name?: string;
  criteria?: string;
  schedule?: string;
  active?: boolean;
  last_run_at?: string;
}

export async function updateProfile(
  id: number,
  update: ProfileUpdate,
): Promise<SearchProfile | null> {
  await ensureSchema();
  const existing = await getProfile(id);
  if (!existing) return null;

  // Strip undefined keys so a partial PATCH (e.g. just { active }) doesn't
  // blow away other fields — object spread copies `undefined` values too.
  const definedUpdate = Object.fromEntries(
    Object.entries(update).filter(([, v]) => v !== undefined),
  );
  const merged = { ...existing, ...definedUpdate };

  const { rows } = await sql`
    UPDATE search_profiles SET
      name = ${merged.name},
      criteria = ${merged.criteria},
      schedule = ${merged.schedule},
      active = ${merged.active},
      last_run_at = ${update.last_run_at !== undefined ? update.last_run_at : existing.last_run_at}
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows[0] ? normalize(rows[0]) : null;
}

export async function deleteProfile(id: number): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await sql`DELETE FROM search_profiles WHERE id = ${id};`;
  return (rowCount ?? 0) > 0;
}
