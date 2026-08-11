import { NextRequest, NextResponse } from "next/server";
import { createVenue, listVenues } from "@/lib/venues";
import { VENUE_STATUSES } from "@/lib/types";

export async function GET() {
  try {
    const venues = await listVenues();
    return NextResponse.json({ venues });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load venues" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
    }
    if (body.status && !VENUE_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const venue = await createVenue({
      name: body.name.trim(),
      city: body.city ?? null,
      state: body.state ?? null,
      venue_type: body.venue_type ?? null,
      capacity: body.capacity ?? null,
      notes: body.notes ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      website: body.website ?? null,
      status: body.status ?? "New",
    });

    return NextResponse.json({ venue }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create venue" },
      { status: 500 },
    );
  }
}
