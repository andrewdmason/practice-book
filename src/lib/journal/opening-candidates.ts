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

export type QuestionCategory = {
  name: string;
  description: string;
  weight: number;
};

/**
 * Pull a weighted category list out of the Interviewer file's
 * "## The daily set of three" section. Recognises lines shaped like
 * `- 25% name — description` (em dash, en dash, or hyphen). Returns [] if no
 * such section/lines exist — callers fall back to the prose-only instruction.
 */
export function parseQuestionMix(interviewer: string): QuestionCategory[] {
  const section = interviewer.match(
    /##\s+The daily set of three[\s\S]*?(?=\n##\s+|$)/i
  );
  if (!section) return [];
  // Separator is em dash, en dash, or a hyphen with whitespace on BOTH sides
  // (so `recent-calendar` survives intact as the name).
  const lineRe = /^\s*[-*]\s*(\d+)\s*%\s+(\S.*?)\s+(?:[—–]|-)\s+(.+?)\s*$/gm;
  const out: QuestionCategory[] = [];
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(section[0])) !== null) {
    const weight = parseInt(m[1], 10);
    if (weight <= 0) continue;
    out.push({ weight, name: m[2].trim(), description: m[3].trim() });
  }
  return out;
}

/**
 * Weighted sample without replacement. The LLM is bad at honouring a
 * probability distribution across N=3 picks (it converges on the top-K
 * categories every morning), so we do the sampling in code and just tell the
 * model which three categories it got today.
 */
export function sampleQuestionMix(
  categories: QuestionCategory[],
  n: number,
  rand: () => number = Math.random
): QuestionCategory[] {
  const pool = categories.slice();
  const picks: QuestionCategory[] = [];
  while (picks.length < n && pool.length > 0) {
    const total = pool.reduce((s, c) => s + c.weight, 0);
    if (total <= 0) break;
    let r = rand() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picks;
}

export function buildCandidatesInstruction(
  rejected: string[],
  recentlyShown: string[] = [],
  sampled: QuestionCategory[] = []
): string {
  const lines: string[] = ["", "=== Today's question picker ==="];
  if (sampled.length === 3) {
    lines.push(
      "Propose exactly three opening questions for today by calling the `propose_questions` tool. The three categories below were sampled this morning from the weighted mix in the Interviewer file (\"The daily set of three\"). Produce one question per category, in this order — do not merge, swap, or substitute categories, and do not let two questions collapse into the same domain:"
    );
    sampled.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.name} — ${c.description}`);
    });
    lines.push(
      "Each question should still sound like you (see the rest of the Interviewer file): one or two sentences, warm, like a friend texting in the morning."
    );
  } else {
    lines.push(
      "Instead of asking a single opening question, propose exactly three for the user to choose from by calling the `propose_questions` tool. See the Interviewer file above — \"The daily set of three\" describes how the three should vary, and the rest of the file describes what makes a good question."
    );
  }
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
  const sampled = sampleQuestionMix(parseQuestionMix(files.Interviewer), 3);
  const system =
    buildSystemPrompt(files, history, today, calendarBlock) +
    "\n" +
    buildCandidatesInstruction(rejected, recentlyShown, sampled);

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
