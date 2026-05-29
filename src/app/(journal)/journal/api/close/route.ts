import { NextRequest, NextResponse } from "next/server";
import { runWrap } from "@/lib/journal/wrap";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { entryId: string };
  const { entryId } = body;
  if (!entryId) {
    return NextResponse.json({ error: "entryId required" }, { status: 400 });
  }

  const result = await runWrap(entryId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    summary: result.summary,
    suggestionCreated: result.suggestionCreated,
  });
}
