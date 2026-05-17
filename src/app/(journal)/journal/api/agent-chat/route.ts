import { NextRequest } from "next/server";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { createClient } from "@/lib/supabase/server";
import { anthropic, JOURNAL_MODEL } from "@/lib/journal/anthropic";
import { loadAgentFiles } from "@/lib/journal/context";
import {
  AGENT_CHAT_TOOLS,
  executeAgentChatTool,
} from "@/lib/journal/agent-chat-tools";
import type { JournalAgentChatMessage, JournalMessage } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    userMessage?: string;
    currentEntryId?: string | null;
  };
  const userMessage = body.userMessage?.trim() ?? "";
  const currentEntryId = body.currentEntryId ?? null;

  if (userMessage.length === 0) {
    return new Response("userMessage required", { status: 400 });
  }

  const supabase = await createClient();

  // Persist the user turn before generating a reply.
  await supabase
    .from("journal_agent_chat_messages")
    .insert({ role: "user", content: userMessage });

  // Load full chat history for this thread (user + assistant only — system
  // messages we may add later are display-only and shouldn't go to Claude).
  const { data: history } = await supabase
    .from("journal_agent_chat_messages")
    .select("id, role, content, source_entry_id, created_at")
    .order("created_at", { ascending: true });

  const thread = ((history ?? []) as JournalAgentChatMessage[]).filter(
    (m) => m.role === "user" || m.role === "assistant"
  );

  // System prompt: agent files + (optional) current entry transcript.
  const files = await loadAgentFiles();
  let system = [
    "You are an assistant that helps Andrew tune the journal interviewer agent.",
    "You can read and edit two markdown files: Interviewer.md (the interviewer's voice, how it asks, and what makes a good question) and Me.md (who Andrew is — life context, family, projects).",
    "",
    "Use the smallest, most surgical edit that accomplishes what Andrew asked.",
    "Prefer `edit_agent_file` over `replace_agent_file`. Confirm what you did in plain language after each tool call.",
    "Be concise — replies should usually be one or two sentences.",
    "Only edit when Andrew explicitly approves a change. If a wrap-pass message surfaced a suggestion, wait for Andrew to say yes before acting.",
    "",
    "=== Interviewer.md ===",
    files.Interviewer || "(empty)",
    "",
    "=== Me.md ===",
    files.Me || "(empty)",
  ].join("\n");

  if (currentEntryId) {
    const { data: entry } = await supabase
      .from("journal_entries")
      .select("entry_date, status, opening_question, summary")
      .eq("id", currentEntryId)
      .maybeSingle();
    if (entry) {
      const { data: msgs } = await supabase
        .from("journal_messages")
        .select("role, content, created_at")
        .eq("entry_id", currentEntryId)
        .order("created_at", { ascending: true });

      const transcript = ((msgs ?? []) as Pick<JournalMessage, "role" | "content">[])
        .map((m) => `${m.role === "assistant" ? "Interviewer" : "Andrew"}: ${m.content}`)
        .join("\n");

      system +=
        `\n\n=== Currently open journal entry (${entry.entry_date}, ${entry.status}) ===\n` +
        (entry.opening_question ? `Opening: ${entry.opening_question}\n\n` : "") +
        (transcript || "(no messages yet)");
    }
  }

  // Build initial Anthropic messages from the persisted thread.
  const messages: MessageParam[] = thread.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const client = anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Accumulator for the final assistant turn we'll persist.
      let persistedAssistant = "";

      const writeChunk = (s: string) => {
        persistedAssistant += s;
        controller.enqueue(encoder.encode(s));
      };

      try {
        // Tool loop: keep going while Claude wants to use tools.
        // Hard cap on iterations to prevent runaway loops.
        for (let iter = 0; iter < 8; iter++) {
          const claudeStream = client.messages.stream({
            model: JOURNAL_MODEL,
            max_tokens: 2048,
            system,
            tools: AGENT_CHAT_TOOLS,
            messages,
          });

          for await (const event of claudeStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              writeChunk(event.delta.text);
            }
          }

          const finalMessage = await claudeStream.finalMessage();

          // Append the assistant turn (text + tool_use blocks) to messages
          // so subsequent iterations see it.
          messages.push({ role: "assistant", content: finalMessage.content });

          if (finalMessage.stop_reason !== "tool_use") {
            break;
          }

          // Execute each tool_use block and assemble tool_result blocks.
          const toolResults: Array<{
            type: "tool_result";
            tool_use_id: string;
            content: string;
            is_error?: boolean;
          }> = [];

          for (const block of finalMessage.content) {
            if (block.type !== "tool_use") continue;
            const result = await executeAgentChatTool(
              block.name,
              block.input as Record<string, unknown>
            );
            if (result.marker) {
              writeChunk(`\n\n${result.marker}\n\n`);
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result.toolResult,
              is_error: result.isError,
            });
          }

          messages.push({ role: "user", content: toolResults });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        writeChunk(`\n\n[error: ${msg}]`);
      } finally {
        // Persist the full assembled assistant message (text + markers).
        const trimmed = persistedAssistant.trim();
        if (trimmed.length > 0) {
          await supabase
            .from("journal_agent_chat_messages")
            .insert({ role: "assistant", content: trimmed });
        }
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
