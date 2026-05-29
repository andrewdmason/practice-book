import { anthropic, JOURNAL_MODEL } from "@/lib/journal/anthropic";
import {
  buildSystemPrompt,
  loadAgentFiles,
  loadFamilyDoc,
  loadHistory,
  loadQuestionTypes,
  loadSettings,
} from "@/lib/journal/context";
import { loadCalendarBlock } from "@/lib/journal/calendar";
import { formatNow, getUserTimezone, localDate } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/server";
import type { JournalOpeningCandidate, JournalQuestionType } from "@/lib/types";

export const OPENING_CANDIDATES_TOOL_NAME = "propose_questions";

/**
 * The candidate tool's shape depends on how many questions the user wants each
 * day, so we build it per request rather than as a module constant.
 */
export function buildOpeningCandidatesTool(n: number) {
  return {
    name: OPENING_CANDIDATES_TOOL_NAME,
    description:
      `Propose exactly ${n} opening question(s) for today's journal entry. The ` +
      "user will see all of them and pick the one they want to answer.",
    input_schema: {
      type: "object" as const,
      properties: {
        questions: {
          type: "array",
          minItems: n,
          maxItems: n,
          description: `Exactly ${n} genuinely different question(s).`,
          items: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description:
                  "ONLY the question itself as the user will read it, in your voice — one or two sentences. Never include your reasoning, the category name, or any explanation of how or why you chose it or whether a constraint could be met.",
              },
            },
            required: ["text"],
          },
        },
      },
      required: ["questions"],
    },
  };
}

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
 * Build a `QuestionCategory` from a stored question type, folding the user's
 * free-text style note onto the locked base description.
 */
export function questionTypeToCategory(t: JournalQuestionType): QuestionCategory {
  return {
    name: t.name,
    description: t.base_description + (t.style_note.trim() ? " " + t.style_note.trim() : ""),
    weight: t.weight,
  };
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
  n: number,
  rejected: string[],
  recentlyShown: string[] = [],
  sampled: QuestionCategory[] = [],
  forcedCategory?: QuestionCategory
): string {
  const lines: string[] = ["", "=== Today's question picker ==="];
  const voiceNote =
    "Each question should still sound like you (see the Interviewer file): one or two sentences, warm, like a friend texting in the morning. Each question's text is exactly what the user reads — never narrate your reasoning, name the category, or explain your choice inside it. A category's extra instructions are soft preferences: if one can't be satisfied from the available context, quietly ask a natural question of that category instead — never write about the conflict or that you're skipping or substituting anything.";
  if (forcedCategory) {
    lines.push(
      `The user asked specifically for questions of one kind. Propose exactly ${n} opening question(s) by calling the \`propose_questions\` tool, all in this single category — make them genuinely different angles on it, not restatements of one question:`,
      `- ${forcedCategory.name} — ${forcedCategory.description}`,
      voiceNote
    );
  } else if (sampled.length === n) {
    lines.push(
      `Propose exactly ${n} opening question(s) for today by calling the \`propose_questions\` tool. The categories below were sampled this morning from the user's configured question types. Produce one question per category, in this order — do not merge, swap, or substitute categories, and do not let two questions collapse into the same domain:`
    );
    sampled.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.name} — ${c.description}`);
    });
    lines.push(voiceNote);
  } else {
    lines.push(
      `Instead of asking a single opening question, propose exactly ${n} for the user to choose from by calling the \`propose_questions\` tool. Make them genuinely different in mood and angle — never variations of one question, never the same domain twice. ${voiceNote}`
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
 * Generate the day's varied opening-question candidates for an entry.
 * `rejected` lists questions the user already turned down (from prior rerolls)
 * so the model avoids repeating them. When `forcedCategoryName` is given, all
 * candidates are produced in that single question type (the user asked for a
 * specific kind), even if that type is currently disabled.
 */
export async function generateCandidates(
  entryId: string,
  rejected: string[],
  forcedCategoryName?: string
): Promise<JournalOpeningCandidate[]> {
  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);
  const [files, history, calendarBlock, recentlyShown, questionTypes, settings, familyDoc] =
    await Promise.all([
      loadAgentFiles(),
      loadHistory(today, entryId),
      loadCalendarBlock(today, tz),
      loadRecentlyShown(today),
      loadQuestionTypes(),
      loadSettings(),
      loadFamilyDoc(),
    ]);

  const n = settings.questions_per_day;

  let sampled: QuestionCategory[] = [];
  let forced: QuestionCategory | undefined;
  if (forcedCategoryName) {
    const t = questionTypes.find((q) => q.name === forcedCategoryName);
    forced = t ? questionTypeToCategory(t) : undefined;
  } else {
    const enabled = questionTypes
      .filter((t) => t.enabled && t.weight > 0)
      .map(questionTypeToCategory);
    sampled = sampleQuestionMix(enabled, n);
  }

  const system =
    buildSystemPrompt(files, history, today, calendarBlock, formatNow(new Date(), tz), familyDoc) +
    "\n" +
    buildCandidatesInstruction(n, rejected, recentlyShown, sampled, forced);

  const client = anthropic();
  const message = await client.messages.create({
    model: JOURNAL_MODEL,
    max_tokens: 1024,
    system,
    tools: [buildOpeningCandidatesTool(n)],
    tool_choice: { type: "tool", name: OPENING_CANDIDATES_TOOL_NAME },
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
  if (questions.length !== n) {
    throw new Error(`expected ${n} question candidates, got ${questions.length}`);
  }
  // Label each question with the type it was generated for: the forced type
  // (all questions), the per-slot sampled type (one each, in order), or null
  // when we fell back to an untyped varied set.
  return questions.map((text, i) => ({
    text,
    type: forced ? forced.name : sampled.length === n ? sampled[i]?.name ?? null : null,
  }));
}
