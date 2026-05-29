// Code-level defaults for a brand-new journal user.
//
// New family members are normally seeded by *copying the owner's* tuned
// Interviewer voice, question types, and settings (see provisioning.ts). These
// constants are the fallback for the very first owner on a fresh database (where
// there's no tuned owner to copy yet) and keep the seed content in one place
// rather than only in SQL migrations.

/** The interviewer voice file. Mirrors the seed in migration 00045. */
export const DEFAULT_INTERVIEWER = `# Interviewer

You are a thoughtful friend, not a therapist or coach.

## Voice

Warm. Quiet. Curious. The voice of someone who has known the user a long time and pays attention. Never performative.

## How you ask the opening question

- One or two sentences. Never longer. Never multi-part.
- Genuinely curious, not formulaic.
- Mix specific/concrete questions with reflective/abstract ones.
- Small moments are valid. They often produce the best entries.
- Vary across days. Don't ask about the same domain two days in a row.
- Reserve deeply reflective questions ("what have you been chewing on that you haven't told anyone about?") for the right moment — high risk, high reward.
- Output only the question itself. No preamble, no greeting, no framing.
- Never narrate research or reasoning. The question just shows up, perfectly timed, like a friend texting in the morning.
- Never use "I notice that..." or "It sounds like..." preambles. Just ask.

## How you follow up

- One follow-up at a time.
- Stay in the territory the user opened — don't pivot.
- It's okay to be brief ("what made it land that way?").
- It's okay to be specific ("which part of it surprised you?").
- Don't summarize what they said back to them. Just ask the next thing.
- Don't push if they seem done.

## What to avoid

- Generic prompts like "How are you feeling today?"
- Anything that reads like a self-help worksheet.
- Therapist-speak ("how does that make you feel", "sit with that").
- Coach-speak ("what would success look like", "what's one thing you could do").
- Showing the user any "context" or "reasoning" about how you chose the question.
`;

/** New users start with an empty profile — it fills in as they journal. */
export const DEFAULT_USER_PROFILE = "";

export const DEFAULT_QUESTIONS_PER_DAY = 3;

export type BuiltinQuestionType = {
  name: string;
  base_description: string;
  weight: number;
  sort_order: number;
};

/** The 13 built-in question types. Mirrors the seed in migration 00047. */
export const BUILTIN_QUESTION_TYPES: BuiltinQuestionType[] = [
  { name: "recent-calendar", weight: 12, sort_order: 1, base_description: "Pulls a specific event from your connected calendar in the last few days and asks about it — best once it has already happened." },
  { name: "upcoming-calendar", weight: 3, sort_order: 2, base_description: "Looks ahead on your calendar and asks about something coming up. Used sparingly." },
  { name: "historical-followup", weight: 6, sort_order: 3, base_description: "Re-reads your recent journal entries and picks up a specific thread you wrote about, referencing it directly." },
  { name: "me-topic", weight: 6, sort_order: 4, base_description: "Draws on your User file — projects, interests, people — and asks about one, rotating so it doesn't fixate on the same thing." },
  { name: "deep-introspective", weight: 6, sort_order: 5, base_description: "An open, reflective prompt aimed at something unspoken or unresolved. Not tied to any event — high risk, high reward." },
  { name: "gratitude", weight: 3, sort_order: 6, base_description: "A simple prompt to name something you're grateful for right now. Not drawn from any particular source." },
  { name: "mood-check-in", weight: 3, sort_order: 7, base_description: "A concrete read on how you're feeling today. General, not tied to a specific event." },
  { name: "daily-recap", weight: 6, sort_order: 8, base_description: "Asks about a small, concrete moment from today or yesterday, leaning on the time of day and your calendar rather than past entries." },
  { name: "intentions", weight: 3, sort_order: 9, base_description: "A forward-looking prompt about what you want from today or the week ahead, with a light read on what's on your calendar." },
  { name: "unresolved-loop", weight: 3, sort_order: 10, base_description: "Scans your recent entries for an open worry or tension you mentioned but didn't resolve, and checks back on it." },
  { name: "relationship", weight: 3, sort_order: 11, base_description: "Surfaces a specific person from your User file or recent entries and asks about a recent moment with them." },
  { name: "curveball", weight: 1, sort_order: 12, base_description: "A deliberately unexpected, playful prompt from an angle you wouldn't predict. Not based on your data." },
  { name: "sensory-moment", weight: 3, sort_order: 13, base_description: "Asks you to capture a sensory detail — something you saw, heard, tasted, or felt recently. Not tied to a specific source." },
];
