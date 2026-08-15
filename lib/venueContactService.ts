// DB-integrated helpers built on top of `contactInfo.ts`. Used by both the
// per-venue and bulk API routes so the query/update logic lives in one place.
//
// ASSUMPTION: `./db` exports a `query(text, params) => Promise<{ rows: T[] }>`
// function (the common `pg`-Pool-wrapper pattern) and the `venues` table has
// at least `id, name, address, website, phone, email` columns. If your real
// db.ts differs (e.g. Prisma, `@vercel/postgres` sql-tag, different column
// names), adjust the four queries below — the rest of this file doesn't
// need to change.

import { query } from "./db"; // adjust path/import to match your project
import { findContactInfo, type ContactInfoResult, type VenueContactLookup } from "./contactInfo";

interface VenueRow extends VenueContactLookup {
  id: string | number;
  name: string;
  address: string | null;
  website: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyContactInfo(venueId: string | number, result: ContactInfoResult): Promise<void> {
  await query(
    `UPDATE venues
     SET phone   = CASE WHEN phone IS NULL OR phone = '' THEN $1 ELSE phone END,
         email   = CASE WHEN email IS NULL OR email = '' THEN $2 ELSE email END,
         website = CASE WHEN website IS NULL OR website = '' THEN $3 ELSE website END
     WHERE id = $4`,
    [result.phone, result.email, result.website, venueId]
  );
}

/** Runs the contact lookup for a single venue (by id) and saves what it finds. */
export async function runContactLookupForVenue(
  venueId: string | number
): Promise<(ContactInfoResult & { venueId: string | number; name: string }) | null> {
  const { rows } = await query<VenueRow>(
    "SELECT id, name, address, website FROM venues WHERE id = $1",
    [venueId]
  );
  const venue = rows[0];
  if (!venue) return null;

  const result = await findContactInfo(venue);
  await applyContactInfo(venue.id, result);

  return { venueId: venue.id, name: venue.name, ...result };
}

/** Runs the contact lookup for every venue currently missing a phone or email. */
export async function runContactLookupForMissingVenues(): Promise<
  Array<ContactInfoResult & { venueId: string | number; name: string; error?: boolean }>
> {
  const { rows: venues } = await query<VenueRow>(
    `SELECT id, name, address, website FROM venues
     WHERE (phone IS NULL OR phone = '') OR (email IS NULL OR email = '')`
  );

  const results: Array<ContactInfoResult & { venueId: string | number; name: string; error?: boolean }> = [];

  for (const venue of venues) {
    try {
      const result = await findContactInfo(venue);
      await applyContactInfo(venue.id, result);
      results.push({ venueId: venue.id, name: venue.name, ...result });
    } catch (error) {
      console.error(`Contact lookup failed for venue ${venue.id} (${venue.name})`, error);
      results.push({
        venueId: venue.id,
        name: venue.name,
        phone: null,
        email: null,
        website: null,
        source: null,
        error: true,
      });
    }
    await sleep(500); // be polite / avoid hammering many different sites back-to-back
  }

  return results;
}
