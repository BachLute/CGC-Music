// DB-integrated helpers built on top of `contactInfo.ts`. Used by both the
// per-venue and bulk API routes so the query/update logic lives in one place.

import { sql } from "./db";
import { findContactInfo, type ContactInfoResult, type VenueContactLookup } from "./contactInfo";

interface VenueRow extends VenueContactLookup {
  id: string | number;
  name: string;
  city: string | null;
  state: string | null;
  website: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyContactInfo(venueId: string | number, result: ContactInfoResult): Promise<void> {
  await sql`
    UPDATE venues
    SET phone   = CASE WHEN phone IS NULL OR phone = '' THEN ${result.phone} ELSE phone END,
        email   = CASE WHEN email IS NULL OR email = '' THEN ${result.email} ELSE email END,
        website = CASE WHEN website IS NULL OR website = '' THEN ${result.website} ELSE website END
    WHERE id = ${venueId}
  `;
}

/** Runs the contact lookup for a single venue (by id) and saves what it finds. */
export async function runContactLookupForVenue(
  venueId: string | number
): Promise<(ContactInfoResult & { venueId: string | number; name: string }) | null> {
  const { rows } = await sql<VenueRow>`
    SELECT id, name, city, state, website FROM venues WHERE id = ${venueId}
  `;
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
  const { rows: venues } = await sql<VenueRow>`
    SELECT id, name, city, state, website FROM venues
    WHERE (phone IS NULL OR phone = '') OR (email IS NULL OR email = '')
  `;

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
