import { NextRequest, NextResponse } from "next/server";
import { runSearchProfile } from "@/lib/search";

// Web search across several narrowed queries can take a while — give it room.
export const maxDuration = 300;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid profile id" }, { status: 400 });
  }

  try {
    const result = await runSearchProfile(id);
    return NextResponse.json({ result });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search run failed" },
      { status: 500 },
    );
  }
}
