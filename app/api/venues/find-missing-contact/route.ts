import { NextResponse } from "next/server";
import { runContactLookupForMissingVenues } from "../../../../lib/venueContactService";

// Best-effort — only takes effect on Vercel plans that support it. Runs
// sequentially over every venue missing contact info, so this can take a
// while if there are many. If your venue list is large, consider moving
// this to a background job/queue instead of a single request/response.
export const maxDuration = 300;

export async function POST() {
  const results = await runContactLookupForMissingVenues();
  return NextResponse.json({ count: results.length, results });
}
