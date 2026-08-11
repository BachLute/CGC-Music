import { NextRequest, NextResponse } from "next/server";
import { deleteVenue, updateVenue } from "@/lib/venues";
import { VENUE_STATUSES } from "@/lib/types";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid venue id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    if (body.status !== undefined && !VENUE_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const venue = await updateVenue(id, {
      name: body.name,
      city: body.city,
      state: body.state,
      venue_type: body.venue_type,
      capacity: body.capacity,
      notes: body.notes,
      phone: body.phone,
      email: body.email,
      website: body.website,
      status: body.status,
    });

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    return NextResponse.json({ venue });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update venue" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid venue id" }, { status: 400 });
  }

  try {
    const ok = await deleteVenue(id);
    if (!ok) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete venue" },
      { status: 500 },
    );
  }
}
