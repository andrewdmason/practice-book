import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, JOURNAL_MODEL } from "@/lib/journal/anthropic";
import {
  buildSystemPrompt,
  loadAgentFiles,
  loadHistory,
  messagesAsAnthropicTurns,
} from "@/lib/journal/context";
import { loadCalendarBlock } from "@/lib/journal/calendar";
import { getUserTimezone, localDate } from "@/lib/date-utils";
import type { JournalMessage } from "@/lib/types";

export const runtime = "nodejs";

const TOOLS = [
  {
    name: "write_wrap",
    description:
      "Wrap today's entry. Produces three things at once:\n\n" +
      "• `summary`: a single concise sentence, past tense, factual — describes what was discussed. e.g. 'Talked about feeling stuck on the second movement of the Bach.' Not a quote, not a feeling-label.\n\n" +
      "• `title`: a short evocative noun-phrase title, 2–5 words, lowercase, no trailing punctuation. Reads like the user could have written it themselves at the top of a notebook page. Concrete is better than abstract. Examples: 'the morning after the permit', 'what waiting feels like', 'maya's first violin lesson', 'a quick check-in'. Avoid adjectives doing too much work ('a profound conversation about life'); prefer the actual subject.\n\n" +
      "• `pull_quote` (optional): a short verbatim line — 5 to 18 words — taken from something the user actually said in the conversation. Pick the most striking, vulnerable, or specific moment. Do not paraphrase. Do not include attribution. Skip entirely if the user didn't say anything worth pulling (e.g. mostly one-word answers, dismissed without engaging).",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string" },
        title: { type: "string" },
        pull_quote: { type: "string" },
      },
      required: ["summary", "title"],
    },
  },
  {
    name: "surface_to_agent_chat",
    description:
      "Post a short message into the separate agent-chat thread for the user to respond to later. Call this when today's conversation contained: explicit feedback about question style or pacing, a mention of a new project / life change worth tracking, or anything the user said is worth remembering long-term. Do NOT modify any agent files yourself — the user reviews each surfaced message in the agent chat and decides whether to apply a change. Phrase the message as a short observation or question the user can quickly accept or redirect (e.g. 'Noticed you said you don't love deadline questions — want me to update SOUL?'). Skip if there's nothing notable; do not infer from tone.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: "The message body to post. One or two sentences.",
        },
      },
      required: ["message"],
    },
  },
];

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { entryId: string };
  const { entryId } = body;
  if (!entryId) {
    return NextResponse.json({ error: "entryId required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .select("id, entry_date, status, summary")
    .eq("id", entryId)
    .single();
  if (entryErr || !entry) {
    return NextResponse.json({ error: "entry not found" }, { status: 404 });
  }
  if (entry.status !== "open") {
    return NextResponse.json({ error: "entry already closed" }, { status: 409 });
  }

  const { data: msgs, error: msgsErr } = await supabase
    .from("journal_messages")
    .select("id, entry_id, role, content, created_at")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });
  if (msgsErr) {
    return NextResponse.json({ error: msgsErr.message }, { status: 500 });
  }
  const thread = (msgs ?? []) as JournalMessage[];
  if (thread.length === 0) {
    return NextResponse.json(
      { error: "cannot close empty entry" },
      { status: 400 }
    );
  }

  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);
  const [files, history, calendarBlock] = await Promise.all([
    loadAgentFiles(),
    loadHistory(today, entryId),
    loadCalendarBlock(today, tz),
  ]);
  const baseSystem = buildSystemPrompt(files, history, today, calendarBlock);
  const system =
    baseSystem +
    `\n\n=== Wrap pass ===
The user has finished today's entry.

1. Call \`write_wrap\` exactly once. It produces a summary, a short evocative title, and (optionally) a verbatim pull quote from something the user said. See the tool description for the bar on each.

2. Then optionally call \`surface_to_agent_chat\` zero or more times. You never modify any agent files yourself — that happens in a separate agent chat where the user explicitly approves each change. Use \`surface_to_agent_chat\` when the conversation contained:
   - Explicit feedback about question style or interview pacing.
   - A mention of a new project, life change, or piece of context the agent should know about going forward.
   - Anything the user said is worth remembering long-term.

   Phrase each surfaced message as a short observation or question the user can quickly accept or redirect.

   Do not infer from tone or response length. Do not surface things already documented in USER.md or MEMORY.md. If in doubt, don't surface.

After your tool calls, you may stop. The user does not see the wrap output.`;

  const turns = messagesAsAnthropicTurns(thread);
  // Anthropic requires the messages array to end with a user turn. If the
  // user closed without replying to the AI's last question, append a
  // synthetic closer so the wrap pass can run.
  if (turns.length === 0 || turns[turns.length - 1].role === "assistant") {
    turns.push({ role: "user", content: "(I'm done for today.)" });
  }

  const client = anthropic();
  let result;
  try {
    result = await client.messages.create({
      model: JOURNAL_MODEL,
      max_tokens: 2048,
      system,
      tools: TOOLS,
      messages: turns,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[journal/close] Anthropic call failed:", msg);
    return NextResponse.json(
      { error: `Claude call failed: ${msg}` },
      { status: 502 }
    );
  }

  let summary: string | null = null;
  let title: string | null = null;
  let pullQuote: string | null = null;
  const surfacedMessages: string[] = [];

  for (const block of result.content) {
    if (block.type !== "tool_use") continue;
    const input = block.input as Record<string, unknown>;
    if (block.name === "write_wrap") {
      if (typeof input.summary === "string") summary = input.summary.trim();
      if (typeof input.title === "string") {
        title = input.title.trim().replace(/[.!?]+$/, "");
      }
      if (typeof input.pull_quote === "string") {
        const q = input.pull_quote.trim().replace(/^["“]|["”]$/g, "");
        pullQuote = q.length > 0 ? q : null;
      }
    } else if (
      block.name === "surface_to_agent_chat" &&
      typeof input.message === "string"
    ) {
      const text = input.message.trim();
      if (text.length > 0) surfacedMessages.push(text);
    }
  }

  if (summary || title || pullQuote !== null) {
    const update: Record<string, unknown> = { summary_stale: false };
    if (summary !== null) update.summary = summary;
    if (title !== null) update.title = title;
    // pull_quote can be set to null explicitly when the AI chose not to surface one
    update.pull_quote = pullQuote;
    await supabase.from("journal_entries").update(update).eq("id", entryId);
  }

  // Surface messages into the agent chat thread. The user reviews and decides
  // whether to apply any agent-file changes from there. We do NOT modify
  // SOUL/AGENTS/USER/MEMORY here.
  let surfacedCount = 0;
  if (surfacedMessages.length > 0) {
    // Dedupe against any prior surfacings tied to this same entry (re-close case)
    const { data: prior } = await supabase
      .from("journal_agent_chat_messages")
      .select("content")
      .eq("source_entry_id", entryId)
      .eq("role", "assistant");
    const seen = new Set(
      (prior ?? []).map((p: { content: string }) => p.content.trim())
    );
    const fresh = surfacedMessages.filter((m) => !seen.has(m));
    if (fresh.length > 0) {
      await supabase.from("journal_agent_chat_messages").insert(
        fresh.map((message) => ({
          role: "assistant",
          content: message,
          source_entry_id: entryId,
        }))
      );
      surfacedCount = fresh.length;
    }
  }

  await supabase
    .from("journal_entries")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  return NextResponse.json({
    summary,
    surfacedCount,
  });
}
