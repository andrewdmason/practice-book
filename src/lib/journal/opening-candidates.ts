import { anthropic, JOURNAL_MODEL } from "@/lib/journal/anthropic";
import {
  buildSystemPrompt,
  loadAgentFiles,
  loadHistory,
} from "@/lib/journal/context";
import { loadCalendarBlock } from "@/lib/journal/calendar";
import { getUserTimezone, localDate } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/server";

export const OPENING_CANDIDATES_TOOL = {
  name: "propose_questions",
  description:
    "Propose exactly three opening questions for today's journal entry. The " +
    "user will see all three and pick the one they want to answer.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        description: "Exactly three genuinely different questions.",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The question itself, in your voice — one or two sentences.",
            },
          },
          required: ["text"],
        },
      },
    },
    required: ["questions"],
  },
};

/**
 * Window (in days) of recently-shown-but-not-picked questions fed back to the
 * model as a soft avoid.
 */
const RECENTLY_SHOWN_DAYS = 14;

export function buildCandidatesInstruction(
  rejected: string[],
  recentlyShown: string[] = []
): string {
  const lines: string[] = [
    "",
    "=== Today's question picker ===",
    "Instead of asking a single opening question, propose exactly three for the user to choose from by calling the `propose_questions` tool. See the Interviewer file above — \"The daily set of three\" describes how the three should vary, and the rest of the file describes what makes a good question.",
  ];
  if (rejected.length > 0) {
    lines.push(
      "",
      "The user just rejected the questions below and wants a different set. Do not repeat them, anything close in shape, or anything in the same domain:",
      ...rejected.map((q, i) => `${i + 1}. ${q}`)
    );
  }
  if (recentlyShown.length > 0) {
    lines.push(
      "",
      "The questions below were shown to the user on recent days and not chosen. Don't repeat any of them word-for-word, but the underlying topics are fine to revisit if today's context makes them relevant:",
      ...recentlyShown.map((q, i) => `${i + 1}. ${q}`)
    );
  }
  return lines.join("\n");
}

/**
 * Load the distinct questions the picker showed but the user didn't choose,
 * within the last `RECENTLY_SHOWN_DAYS` days.
 */
export async function loadRecentlyShown(today: string): Promise<string[]> {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENTLY_SHOWN_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_skipped_questions")
    .select("question")
    .gte("skipped_on", cutoffDate);
  if (error) throw error;

  return [...new Set((data ?? []).map((r) => r.question as string))];
}

/**
 * Generate three varied opening-question candidates for an entry. `rejected`
 * lists questions the user already turned down (from prior rerolls) so the
 * model avoids repeating them.
 */
export async function generateCandidates(
  entryId: string,
  rejected: string[]
): Promise<string[]> {
  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);
  const [files, history, calendarBlock, recentlyShown] = await Promise.all([
    loadAgentFiles(),
    loadHistory(today, entryId),
    loadCalendarBlock(today, tz),
    loadRecentlyShown(today),
  ]);
  const system =
    buildSystemPrompt(files, history, today, calendarBlock) +
    "\n" +
    buildCandidatesInstruction(rejected, recentlyShown);

  const client = anthropic();
  const message = await client.messages.create({
    model: JOURNAL_MODEL,
    max_tokens: 1024,
    system,
    tools: [OPENING_CANDIDATES_TOOL],
    tool_choice: { type: "tool", name: "propose_questions" },
    messages: [{ role: "user", content: "It's morning. Propose today's questions." }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("model did not return question candidates");
  }
  const input = toolUse.input as { questions?: { text?: unknown }[] };
  const questions = (input.questions ?? [])
    .map((q) => (typeof q.text === "string" ? q.text.trim() : ""))
    .filter((t) => t.length > 0);
  if (questions.length !== 3) {
    throw new Error(
      `expected 3 question candidates, got ${questions.length}`
    );
  }
  return questions;
}
