import { NextRequest, NextResponse } from "next/server";
import { runWrap } from "@/lib/journal/wrap";
import { maybeAutoGenerateEntryPhoto } from "@/lib/journal/generated-photo";

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

  const photoResult = await maybeAutoGenerateEntryPhoto(entryId);
  if (!photoResult.ok) {
    console.error("[journal/close] generated photo failed:", photoResult.error);
  }

  return NextResponse.json({
    summary: result.summary,
    suggestionCreated: result.suggestionCreated,
  });
}
