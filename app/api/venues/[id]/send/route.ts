import { NextRequest, NextResponse } from "next/server";
import { getVenue, updateVenue } from "@/lib/venues";
import { sendVenueEmail } from "@/lib/mail";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid venue id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const emailBody = typeof body.body === "string" ? body.body : "";

    if (!subject || !emailBody.trim()) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
    }

    const venue = await getVenue(id);
    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    if (venue.status === "Opted Out") {
      return NextResponse.json(
        { error: "This venue has opted out and cannot be emailed." },
        { status: 409 },
      );
    }
    if (!venue.email) {
      return NextResponse.json(
        { error: "This venue has no email address on file." },
        { status: 400 },
      );
    }

    await sendVenueEmail({ to: venue.email, subject, body: emailBody });

    const updated = await updateVenue(id, {
      status: "Contacted",
      date_last_contacted: new Date().toISOString(),
    });

    return NextResponse.json({ venue: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 },
    );
  }
}
