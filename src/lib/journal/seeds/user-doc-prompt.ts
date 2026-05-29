/**
 * Builds the prompt a user copies into a chatbot (ChatGPT, Claude, etc.). The
 * chatbot interviews them and writes their User profile doc in the exact format
 * the journal's interviewer expects, which they paste back into the app.
 *
 * When the owner has filled in the shared Family doc, it's prepended so the
 * chatbot already knows who's around the user and can match its tone to who
 * they are (e.g. keep it light for a kid).
 */
export function buildUserDocPrompt({
  familyDoc,
  memberName,
}: {
  familyDoc?: string | null;
  memberName?: string | null;
}): string {
  const hasFamily = !!familyDoc && familyDoc.trim().length > 0;
  const name = memberName?.trim();
  const parts: string[] = [];

  if (hasFamily) {
    parts.push("Context about my family:");
    parts.push("");
    parts.push(familyDoc.trim());
    parts.push("");
  }

  parts.push(
    `I use a journaling app with an AI "interviewer" that asks me one thoughtful question each morning. To do that well, it reads a short profile of me. I'd like your help writing that profile.${
      name ? ` You're helping ${name}.` : ""
    }

Please interview me to build it. Ask me questions ONE AT A TIME — don't dump a list. Start broad (who I am and what my life looks like right now), then follow up to fill in:

- the people who matter most to me${
      hasFamily
        ? " (you already know my family from the context above — focus on the others, and only confirm family details if it helps)"
        : " (family, friends, colleagues)"
    } and a bit about each
- what I'm working on or focused on these days (projects, goals, commitments)
- my interests — the things I care about and keep coming back to
- the rhythms of my week (work, school, standing plans, routines)
- anything I'm currently chewing on or sitting with

Keep it conversational and warm. Match your tone to me — if I'm a child, keep the language simple and the questions light and playful. Follow up when an answer is interesting, and move on when I've said enough. It's fine if I skip things.

When I say I'm done (or you have enough), write my profile as a single Markdown document using EXACTLY these section headers, including only what we actually covered:

# About me

## Who I am

## People in my life

## What I'm working on

## Interests

## Rhythms

## Open threads

Write in plain, factual prose and short bullet points — just state the facts. No preamble, no commentary, no closing remarks around the document — output only the Markdown, so I can paste it straight into my app.

Start by asking me your first question.`
  );

  return parts.join("\n");
}
