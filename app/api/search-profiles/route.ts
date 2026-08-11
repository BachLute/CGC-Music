import { NextRequest, NextResponse } from "next/server";
import { createProfile, listProfiles } from "@/lib/profiles";

export async function GET() {
  try {
    const profiles = await listProfiles();
    return NextResponse.json({ profiles });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load search profiles" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Profile name is required" }, { status: 400 });
    }
    if (!body.criteria || typeof body.criteria !== "string" || !body.criteria.trim()) {
      return NextResponse.json({ error: "Criteria is required" }, { status: 400 });
    }

    const profile = await createProfile({
      name: body.name.trim(),
      criteria: body.criteria.trim(),
      schedule: "manual",
      active: body.active ?? true,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create search profile" },
      { status: 500 },
    );
  }
}
