// Call this on each newly-discovered venue BEFORE it's inserted into the
// database, so phone/email get filled in even when the initial discovery
// search didn't surface them. See README.md for where to wire this into
// your existing "Run now" search flow.

import { findContactInfo, type VenueContactLookup } from "./contactInfo";

export async function enrichVenueContact<
  T extends VenueContactLookup & { phone?: string | null; email?: string | null }
>(venue: T): Promise<T> {
  // Already have both — no need for a follow-up search.
  if (venue.phone && venue.email) {
    return venue;
  }

  try {
    const found = await findContactInfo(venue);
    return {
      ...venue,
      phone: venue.phone || found.phone || venue.phone,
      email: venue.email || found.email || venue.email,
      website: venue.website || found.website || venue.website,
    };
  } catch (error) {
    console.error(`Contact enrichment failed for "${venue.name}"`, error);
    return venue;
  }
}
