import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, JOURNAL_MODEL } from "@/lib/journal/anthropic";
import {
  buildSystemPrompt,
  loadAgentFiles,
  loadHistory,
} from "@/lib/journal/context";
import { loadCalendarBlock } from "@/lib/journal/calendar";
import { getUserTimezone, localDate } from "@/lib/date-utils";

export const runtime = "nodejs";

const OPENING_PRIMER = "It's morning. Ask me today's question.";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { entryId: string; rejected?: string[] };
  const { entryId } = body;
  const rejected = (body.rejected ?? []).map((s) => s.trim()).filter(Boolean);

  if (!entryId) {
    return new Response("entryId required", { status: 400 });
  }

  const supabase = await createClient();

  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .select("id, status")
    .eq("id", entryId)
    .single();
  if (entryErr || !entry) {
    return new Response("entry not found", { status: 404 });
  }
  if (entry.status !== "open") {
    return new Response("entry is closed", { status: 409 });
  }

  // Reject only allowed before the user has replied
  const { count: userCount, error: countErr } = await supabase
    .from("journal_messages")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId)
    .eq("role", "user");
  if (countErr) {
    return new Response(countErr.message, { status: 500 });
  }
  if ((userCount ?? 0) > 0) {
    return new Response("cannot reroll after replying", { status: 409 });
  }

  // Wipe any prior assistant message(s) and clear opening_question
  await supabase.from("journal_messages").delete().eq("entry_id", entryId);
  await supabase
    .from("journal_entries")
    .update({ opening_question: null })
    .eq("id", entryId);

  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);
  const [files, history, calendarBlock] = await Promise.all([
    loadAgentFiles(),
    loadHistory(today, entryId),
    loadCalendarBlock(today, tz),
  ]);
  const baseSystem = buildSystemPrompt(files, history, today, calendarBlock);
  const system =
    rejected.length === 0
      ? baseSystem
      : baseSystem +
        "\n\n=== Reroll ===\nThe user just rejected the following opening question(s) for today and wants something different. Do not repeat them, anything close in shape, or anything in the same domain.\n\n" +
        rejected.map((q, i) => `${i + 1}. ${q}`).join("\n");

  const client = anthropic();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let full = "";
      try {
        const claudeStream = client.messages.stream({
          model: JOURNAL_MODEL,
          max_tokens: 1024,
          system,
          messages: [{ role: "user" as const, content: OPENING_PRIMER }],
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            full += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }

        const trimmed = full.trim();
        if (trimmed.length > 0) {
          await supabase
            .from("journal_messages")
            .insert({ entry_id: entryId, role: "assistant", content: trimmed });
          await supabase
            .from("journal_entries")
            .update({ opening_question: trimmed })
            .eq("id", entryId);
        }

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
