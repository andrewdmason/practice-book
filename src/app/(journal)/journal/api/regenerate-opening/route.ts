import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCandidates } from "@/lib/journal/opening-candidates";
import { getUserTimezone, localDate } from "@/lib/date-utils";

export const runtime = "nodejs";

const REROLL_LIMIT = 3;

// Reroll the three-question picker: regenerate a fresh set, avoiding the
// questions the user just rejected. Capped server-side at REROLL_LIMIT.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { entryId?: string };
  const entryId = body.entryId;
  if (!entryId) {
    return new Response("entryId required", { status: 400 });
  }

  const supabase = await createClient();

  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .select("id, status, opening_candidates, candidates_reroll_count")
    .eq("id", entryId)
    .single();
  if (entryErr || !entry) {
    return new Response("entry not found", { status: 404 });
  }
  if (entry.status !== "open") {
    return new Response("entry is closed", { status: 409 });
  }

  // Can't reroll once the conversation has started.
  const { count, error: countErr } = await supabase
    .from("journal_messages")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId);
  if (countErr) {
    return new Response(countErr.message, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return new Response("entry already started", { status: 409 });
  }

  if (entry.candidates_reroll_count >= REROLL_LIMIT) {
    return new Response("reroll limit reached", { status: 409 });
  }

  const rejected = (entry.opening_candidates as string[] | null) ?? [];

  // Persist the rejected set so future days don't resurface the same prompts.
  if (rejected.length > 0) {
    const tz = await getUserTimezone();
    const today = localDate(new Date(), tz);
    await supabase.from("journal_skipped_questions").insert(
      rejected.map((q) => ({ question: q, entry_id: entryId, skipped_on: today }))
    );
  }

  let candidates: string[];
  try {
    candidates = await generateCandidates(entryId, rejected);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(msg, { status: 500 });
  }

  const rerollCount = entry.candidates_reroll_count + 1;
  const { error: writeErr } = await supabase
    .from("journal_entries")
    .update({
      opening_candidates: candidates,
      candidates_reroll_count: rerollCount,
    })
    .eq("id", entryId);
  if (writeErr) {
    return new Response(writeErr.message, { status: 500 });
  }

  return Response.json({ candidates, rerollCount });
}
