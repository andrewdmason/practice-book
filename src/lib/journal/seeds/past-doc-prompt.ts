/**
 * Builds the prompt a user copies into a chatbot (ChatGPT, Claude, etc.) to
 * write their Past doc — their life story. The chatbot interviews them about
 * their history one question at a time and outputs Markdown in the exact format
 * the journal's interviewer expects, which they paste back into the app.
 *
 * Mirrors buildUserDocPrompt (the Present-doc version): same family-blockquote
 * and age-note structure, but pointed at the past — childhood, roots, turning
 * points, the people and places that shaped them — rather than current life.
 */

/**
 * A first-person note about the writer's reading level, keyed by interviewer
 * template id, so the chatbot pitches its questions for the right age. Empty for
 * adult / unknown — no special handling needed.
 */
const AGE_NOTE: Record<string, string> = {
  elementary:
    "I'm a kid in elementary school (around a 5th-grade level), so use simple words and short questions, and keep it warm and concrete — where I was little, things I remember, people and places from when I was younger.",
  middle:
    "I'm in middle school (around an 8th-grade level), so keep it casual and real — not too heavy or formal.",
  high:
    "I'm in high school, so you can go a little deeper into how things shaped me, but stay genuine and easygoing — not preachy.",
};

export function buildPastDocPrompt({
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

  const intro = `I use a journaling app with an AI "interviewer" that asks me one thoughtful question each morning. Sometimes I'd like it to invite me to reminisce — to tell a story from my past. To do that well, it reads a short account of my life story, and I'd like your help writing that.${
    name ? ` I'm ${name}.` : ""
  }${ageNote ? ` ${ageNote}` : ""}`;

  // Blockquote the family doc so it clearly reads as reference material, not as
  // part of the life story to produce. I'm one of the people in it, so it's
  // context for who's around me — the story is still about my own past.
  const familyBackground = hasFamily
    ? `

The app already has this shared context about my family, and I'm one of the people in it${
        name ? "" : " (work out which one as we talk, or just ask me)"
      }. This is about my own life story — use the context so you know who my family is and don't need me to introduce them, but keep your questions focused on my past:

${familyDoc!
        .trim()
        .split("\n")
        .map((line) => (line.trim() ? `> ${line}` : ">"))
        .join("\n")}`
    : "";

  const body = `

Please interview me to capture my life story. Ask me questions ONE AT A TIME — don't dump a list. Start broad (where I come from and what my early life was like), then follow up to cover:

- where I grew up — places, home, the world I came from
- my childhood and growing-up years — school, what those years were like
- the people who shaped me${
    hasFamily ? " beyond the family already described" : " (family, mentors, friends)"
  } and how
- turning points — big moves, decisions, or events that changed my course
- places I've lived over the years
- the stories I find myself coming back to

Keep it conversational and warm.${
    ageNote
      ? ""
      : " Match your tone to me — if I'm a child, keep the language simple and the questions gentle."
  } Follow up when a memory is rich, and move on when I've said enough. It's fine if I skip things or don't remember.

When I say I'm done (or you have enough), write my life story as a single Markdown document using EXACTLY these section headers, including only what we actually covered:

# My past

## Where I come from

## Growing up

## People who shaped me

## Turning points

## Places I've lived

## Stories I come back to

Write in plain, factual prose and short bullet points — just tell the story. No preamble, no commentary, no closing remarks around the document — output only the Markdown, so I can paste it straight into my app.

Start by asking me your first question.`;

  return intro + familyBackground + body;
}
