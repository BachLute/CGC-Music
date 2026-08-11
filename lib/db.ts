import { Pool, type QueryResultRow } from "pg";

function resolveConnectionString(): string {
  const url =
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No Postgres connection string found. Set POSTGRES_URL (provisioned automatically when " +
        "you link a Vercel Postgres database to this project).",
    );
  }
  return url;
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = resolveConnectionString();
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

/** Tagged template helper mirroring the ergonomics of @vercel/postgres's `sql`. */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) {
  let text = strings[0];
  const params: unknown[] = [];
  values.forEach((value, i) => {
    params.push(value);
    text += `$${i + 1}${strings[i + 1]}`;
  });
  return getPool().query<T>(text, params);
}

let schemaPromise: Promise<void> | null = null;

async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS search_profiles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      criteria TEXT NOT NULL DEFAULT '',
      schedule TEXT NOT NULL DEFAULT 'manual',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_run_at TIMESTAMPTZ
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS venues (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      state TEXT,
      venue_type TEXT,
      capacity INTEGER,
      notes TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      status TEXT NOT NULL DEFAULT 'New' CHECK (
        status IN ('New', 'Contacted', 'Follow-up Needed', 'Booked', 'Passed', 'Opted Out')
      ),
      date_added TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      date_last_contacted TIMESTAMPTZ,
      source_profile_id INTEGER REFERENCES search_profiles(id) ON DELETE SET NULL,
      source_profile_name TEXT
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS venues_name_city_idx ON venues (LOWER(name), LOWER(COALESCE(city, '')));`;
}

/** Idempotent — call before any query. Cheap after the first call in a warm lambda. */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = initSchema().catch((err) => {
      // Allow retry on next call if it failed (e.g. DB not reachable yet).
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}
