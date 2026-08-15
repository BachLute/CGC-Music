import { NextRequest, NextResponse } from "next/server";
import { runContactLookupForVenue } from "../../../../../lib/venueContactService";

// Best-effort — only takes effect on Vercel plans that support it (Hobby
// caps at 60s regardless). Homepage + up to 3 subpages, each with a 10s
// fetch timeout, can take a while in the worst case.
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await runContactLookupForVenue(id);

  if (!result) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
