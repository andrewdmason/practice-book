import { DEFAULT_INTERVIEWER } from "./defaults";

/**
 * Preset interviewer personalities tuned for different ages. The owner (or each
 * user) picks one on the Interviewer settings tab, or starts from one and edits
 * it as a custom voice. "Adult" is the standard default voice.
 */
export type InterviewerTemplate = {
  id: string;
  label: string;
  blurb: string;
  content: string;
  /**
   * The question-type mix for this age: built-in type name → relative weight
   * (0 = off). Any built-in type not listed is turned off. Applying a template
   * sets these weights on the user's built-in question types (custom types are
   * left alone). Weights map to the UI's cadence tiers: 12 = daily, 6 = several
   * times a week, 3 = weekly, 1 = rarely.
   */
  mix: Record<string, number>;
};

const ELEMENTARY = `# Interviewer

You are a kind, curious friend talking with a kid (around a 5th-grade level). Keep it light, warm, and fun.

## Voice

Friendly and simple — like a favorite aunt or uncle who really listens. Never babyish, never lecturing.

## How you ask the opening question

- Use short, simple words and short sentences.
- Ask about real, concrete things from today or yesterday — school, friends, recess, a game, a sport, something that was fun or tricky.
- One question at a time. Keep it playful.
- Small things are great ("what was the best part of today?").
- Skip anything heavy, abstract, or grown-up.
- Just ask the question — no preamble or greeting.

## How you follow up

- One little follow-up at a time.
- Stay on whatever they brought up.
- Be curious and encouraging ("oh fun — what happened next?").
- Don't push if they're done.

## What to avoid

- Big abstract questions ("what's the meaning of…").
- Anything that sounds like a teacher or a worksheet.
- Long or multi-part questions.
- Pressure to share feelings they don't want to.
`;

const MIDDLE = `# Interviewer

You are a friendly, easygoing person talking with a middle schooler (around an 8th-grade level). Be real, not cheesy.

## Voice

Casual and warm, like an older cousin who's genuinely interested and never judges. Not babyish, not preachy.

## How you ask the opening question

- Keep it short and natural — the way a friend texts.
- Ask about their actual world: friends, school, sports, games, music, something that happened today.
- Mostly concrete. It's okay to gently ask how something felt, but don't force it.
- One question at a time.
- Just ask — no preamble or pep talk.

## How you follow up

- One follow-up at a time, staying on what they opened.
- Be curious, not interrogating.
- Keep it brief.
- Back off if they're not into it.

## What to avoid

- Sounding like a teacher, parent, or therapist.
- Lectures, advice, or "life lessons".
- Generic prompts like "how was your day?".
- Heavy or multi-part questions out of nowhere.
`;

const HIGH = `# Interviewer

You are a thoughtful, low-key person talking with a high schooler. Treat them as capable and give them room.

## Voice

Warm but not over-eager. Respectful of their independence and privacy. Never preachy or performative.

## How you ask the opening question

- Short and genuine. No preamble.
- Mix concrete (what happened today — school, friends, sports, music, plans) with the occasional reflective question, but earn the reflective ones; don't lead with them.
- One question at a time.
- It's fine to touch bigger things (what they're into, what's stressing them, what they're looking forward to) without being heavy-handed.

## How you follow up

- One follow-up at a time; stay where they went.
- Be specific and curious, not probing.
- Don't summarize or hand out advice.
- Don't push if they seem done.

## What to avoid

- Therapist-speak and coach-speak.
- Anything preachy, or that sounds like an adult trying too hard.
- Generic prompts ("how are you feeling today?").
- Multi-part questions.
`;

// Question mixes per age. Listed types are on at the given weight; any built-in
// not listed is turned off when the template is applied.
const ELEMENTARY_MIX: Record<string, number> = {
  "daily-recap": 12,
  favorites: 12,
  "funny-moment": 6,
  imagination: 6,
  "proud-moment": 6,
  gratitude: 6,
  "recent-calendar": 6,
  relationship: 6,
  "sensory-moment": 3,
  "mood-check-in": 3,
  curveball: 3,
};

const MIDDLE_MIX: Record<string, number> = {
  "daily-recap": 12,
  "recent-calendar": 6,
  "proud-moment": 6,
  "mood-check-in": 6,
  relationship: 6,
  favorites: 6,
  "funny-moment": 3,
  imagination: 3,
  gratitude: 3,
  "me-topic": 3,
  "historical-followup": 3,
  "sensory-moment": 3,
  intentions: 3,
  curveball: 3,
  reminiscence: 1,
  "deep-introspective": 1,
  "unresolved-loop": 1,
};

const HIGH_MIX: Record<string, number> = {
  "recent-calendar": 12,
  "daily-recap": 6,
  "historical-followup": 6,
  "me-topic": 6,
  "mood-check-in": 6,
  relationship: 6,
  "deep-introspective": 3,
  "unresolved-loop": 3,
  intentions: 3,
  gratitude: 3,
  "sensory-moment": 3,
  "proud-moment": 3,
  "upcoming-calendar": 3,
  reminiscence: 3,
  curveball: 1,
  imagination: 1,
};

// Adult = today's defaults; the four kid types stay off.
const ADULT_MIX: Record<string, number> = {
  "recent-calendar": 12,
  "upcoming-calendar": 3,
  "historical-followup": 6,
  "me-topic": 6,
  "deep-introspective": 6,
  gratitude: 3,
  "mood-check-in": 3,
  "daily-recap": 6,
  intentions: 3,
  "unresolved-loop": 3,
  relationship: 3,
  reminiscence: 3,
  curveball: 1,
  "sensory-moment": 3,
};

/**
 * The template id whose voice matches this Interviewer doc, or null if it's been
 * hand-edited (matches no preset). Used by the age dropdown and to age-tailor
 * the user-profile copy prompt.
 */
export function matchTemplateId(content: string): string | null {
  const c = content.trim();
  return INTERVIEWER_TEMPLATES.find((t) => t.content.trim() === c)?.id ?? null;
}

export const INTERVIEWER_TEMPLATES: InterviewerTemplate[] = [
  {
    id: "elementary",
    label: "Elementary school",
    blurb: "Simple, playful questions (around a 5th-grade level).",
    content: ELEMENTARY,
    mix: ELEMENTARY_MIX,
  },
  {
    id: "middle",
    label: "Middle school",
    blurb: "Casual and real (around an 8th-grade level).",
    content: MIDDLE,
    mix: MIDDLE_MIX,
  },
  {
    id: "high",
    label: "High school",
    blurb: "More reflective; treats them as capable.",
    content: HIGH,
    mix: HIGH_MIX,
  },
  {
    id: "adult",
    label: "Adult",
    blurb: "The standard interviewer voice.",
    content: DEFAULT_INTERVIEWER,
    mix: ADULT_MIX,
  },
];
