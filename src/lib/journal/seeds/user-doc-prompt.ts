/**
 * Builds the prompt a user copies into a chatbot (ChatGPT, Claude, etc.). The
 * chatbot interviews them and writes their User profile doc in the exact format
 * the journal's interviewer expects, which they paste back into the app.
 *
 * When the owner has filled in the shared Family doc, it's woven in as clearly
 * labeled reference material (blockquoted, so it reads as background rather than
 * a second document) and the chatbot is told to focus its questions elsewhere.
 */
/**
 * A first-person note about the writer's reading level, keyed by interviewer
 * template id, so the chatbot pitches its questions for the right age. Empty for
 * adult / unknown — no special handling needed.
 */
const AGE_NOTE: Record<string, string> = {
  elementary:
    "I'm a kid in elementary school (around a 5th-grade level), so use simple words and short questions, and keep it playful and concrete — favorite things, fun or funny moments, what I did, what I imagine.",
  middle:
    "I'm in middle school (around an 8th-grade level), so keep it casual and real — not too heavy or formal.",
  high:
    "I'm in high school, so you can go a little deeper, but stay genuine and easygoing — not preachy.",
};

export function buildUserDocPrompt({
  familyDoc,
  memberName,
  ageId,
}: {
  familyDoc?: string | null;
  memberName?: string | null;
  ageId?: string | null;
}): string {
  const hasFamily = !!familyDoc && familyDoc.trim().length > 0;
  const name = memberName?.trim();
  const ageNote = ageId ? AGE_NOTE[ageId] ?? "" : "";

  const intro = `I use a journaling app with an AI "interviewer" that asks me one thoughtful question each morning. To do that well, it reads a short profile of me, and I'd like your help writing that profile.${
    name ? ` I'm ${name}.` : ""
  }${ageNote ? ` ${ageNote}` : ""}`;

  // Blockquote the family doc so it clearly reads as reference material, not as
  // part of the profile to produce (which also has Markdown headers). The key
  // subtlety: I'm one of the people in this doc, so it's reference for who's
  // around me — not a list of people to skip. The profile is still about me.
  const familyBackground = hasFamily
    ? `

The app already has this shared context about my family, and I'm one of the people in it${
        name ? "" : " (work out which one as we talk, or just ask me)"
      }. This profile is about me — use the context so you know who's around me and don't need me to introduce my family, but keep your questions focused on my own life:

${familyDoc!
        .trim()
        .split("\n")
        .map((line) => (line.trim() ? `> ${line}` : ">"))
        .join("\n")}`
    : "";

  const body = `

Please interview me to fill in the rest. Ask me questions ONE AT A TIME — don't dump a list. Start broad (who I am and what my life looks like right now), then follow up to cover:

- the people who matter most to me${
    hasFamily ? " beyond my family" : " (family, friends, colleagues)"
  } and a bit about each
- what I'm working on or focused on these days (projects, goals, commitments)
- my interests — the things I care about and keep coming back to
- the rhythms of my week (work, school, standing plans, routines)
- anything I'm currently chewing on or sitting with

Keep it conversational and warm.${
    ageNote
      ? ""
      : " Match your tone to me — if I'm a child, keep the language simple and the questions light and playful."
  } Follow up when an answer is interesting, and move on when I've said enough. It's fine if I skip things.

When I say I'm done (or you have enough), write my profile as a single Markdown document using EXACTLY these section headers, including only what we actually covered:

# About me

## Who I am

## People in my life

## What I'm working on

## Interests

## Rhythms

## Open threads

Write in plain, factual prose and short bullet points — just state the facts. No preamble, no commentary, no closing remarks around the document — output only the Markdown, so I can paste it straight into my app.

Start by asking me your first question.`;

  return intro + familyBackground + body;
}
