import { NextRequest, NextResponse } from "next/server";
import { deleteProfile, updateProfile } from "@/lib/profiles";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid profile id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const profile = await updateProfile(id, {
      name: body.name,
      criteria: body.criteria,
      // Schedule field is stored but only "manual" is supported for now.
      schedule: "manual",
      active: body.active,
    });

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update profile" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid profile id" }, { status: 400 });
  }

  try {
    const ok = await deleteProfile(id);
    if (!ok) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete profile" },
      { status: 500 },
    );
  }
}
