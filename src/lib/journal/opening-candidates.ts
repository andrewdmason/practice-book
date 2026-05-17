import { anthropic, JOURNAL_MODEL } from "@/lib/journal/anthropic";
import {
  buildSystemPrompt,
  loadAgentFiles,
  loadHistory,
} from "@/lib/journal/context";
import { loadCalendarBlock } from "@/lib/journal/calendar";
import { getUserTimezone, localDate } from "@/lib/date-utils";

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

export function buildCandidatesInstruction(rejected: string[]): string {
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
  return lines.join("\n");
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
  const [files, history, calendarBlock] = await Promise.all([
    loadAgentFiles(),
    loadHistory(today, entryId),
    loadCalendarBlock(today, tz),
  ]);
  const system =
    buildSystemPrompt(files, history, today, calendarBlock) +
    "\n" +
    buildCandidatesInstruction(rejected);

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
