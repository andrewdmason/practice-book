import type { createAdminClient } from "@/lib/supabase/admin";

// Local-dev convenience: the owner's Present (current life) and Past (life story)
// docs. New users are provisioned with EMPTY Present/Past by design — they're
// meant to be filled via the questionnaire — so on a fresh local setup the owner's
// source-grounded question types (me-topic, relationship, gratitude, reminiscence,
// principles, …) have nothing to draw on. backfillOwnerContext fills these in for
// the owner, and ONLY when they're still empty, so it never clobbers later edits.
//
// This is dev-only: it's called solely from /auth/dev-login (which is gated to
// NODE_ENV === "development" and a non-production Supabase). Production owners
// still start blank and fill the docs themselves.

type AdminClient = ReturnType<typeof createAdminClient>;

export const DEV_OWNER_PRESENT = `# Andrew

## Situation

Left Descript (was CEO/founder). Not currently working a traditional job — not retired, but flexible. Has many interests; usually has half a dozen project ideas in various stages.

## Family

- Jenny — wife (Jenny Gillespie Mason). Coordinates the family calendar.
- Sebastian — older son. Bentley School (K-8). Plays guitar (Thursday lessons), baseball / batting cage (FSB).
- Oscar — younger son. Baseball with Coach Ben (Tuesdays 4–6pm at FSB, ages 8–12). Basketball Saturdays.
- Kids attend school in the East Bay. Andrew does morning drop-off (~7:55am).

## People (non-family)

People Andrew has mentioned. Update as new names surface in journal entries.

- Nick Josefowitz — friend in Berkeley. Plays board games with Andrew.
- Vera — works with Andrew on TTL. Weekly Monday noon meeting.
- Yoshi — Andrew's piano teacher at SFCM (Wednesday lessons).
- Coach Ben — coaches Oscar's baseball (Tuesdays at FSB).
- Sunny — former Descript employee. Getting married in Thailand in November; Andrew hopes to attend with the family.

## Currently working on

Active:

- Tabletop Library (TTL) — board game library/venue in the East Bay. Major focus.
- Descript Board — board of directors role at his former company.
- Morning journal app — this app you live in (AI-driven daily interview-style journaling).
- Christmas trip planning — researching Four Seasons properties: Anguilla, Nevis, Punta Mita. Also looked at Maldives (Jan–April best).
- Thailand trip (November) — Sunny (former Descript employee) is getting married in Thailand. Andrew hopes to go with the family.
- Bentley School Board — board member at the kids' school.
- Piano practice tracking app — personal app (practice book), not for release.

Planning:

- SFCM board exploration (researching trustees and board involvement at SF Symphony, SF Opera).
- Interactive book reading app (making books more alive / conversational via chatbots).

Backlog:

- Media engagement frameworks — analytical project on what makes media engaging across dimensions like sensory richness, agency, imagination, cognitive demand.

## Interests

- Board games — deep interest. Runs TTL. Thinks about game design and taxonomy. Plays games with Nick Josefowitz in Berkeley.
- Music — piano lessons at SFCM with Yoshi (Wednesdays). Chamber music coaching Mondays. Zellerbach subscription. Interested in the institutional side (board research).
- Photography — shoots Leica. Lightroom. Recent subjects: family, kids' baseball, travel.
- CrossFit — CrossFit Oakland. Auto-signed up for 9am weekday classes.
- AI & education — researching how schools should integrate AI. Comparing Bentley, Head-Royce, College Prep.
- Reading / intellectual — analytical thinker. Likes frameworks and taxonomies (e.g. found "ponderous" for slow-but-thoughtful game tempo).

## Recurring rhythms

- Morning school drop-off ~7:55am
- CrossFit 9am weekdays
- TTL work Mondays (noon meeting with Vera + team at 3048 Claremont Ave, Berkeley)
- Piano lesson Wednesdays at SFCM
- Chamber music coaching Mondays 6–7:30pm
- Kids' sports late afternoon / evening

## Open threads

- What does this post-Descript chapter look like — identity, purpose, pace.
- What makes some media/entertainment forms more engaging than others.
- The institutional landscape of Bay Area arts organizations.
- Navigating school choices and how schools handle technology / AI.
- Building TTL — operations, hiring, brand.
- Balancing a full family schedule with personal interests.
- Lots of app ideas — what to commit to building vs. just thinking about.
`;

export const DEV_OWNER_PAST = `# My past

## Where I come from

- I was born on October 22, 1980, and grew up in the Pittsburgh area.
- I spent my childhood in the suburbs, in the world of western Pennsylvania in the 1980s and 1990s.
- My family remains rooted in Pittsburgh, and it is still a place I return to regularly.

## Growing up

- As a kid, I was drawn to projects, ideas, and building things.
- I experimented with small entrepreneurial ventures while I was young, including a bagel delivery business.
- I was interested in both creative pursuits and technology, a combination that would shape much of my later life.
- Music became an important part of my identity and eventually led me to study music in college after transferring from materials science engineering.
- I was often more interested in creating things than following conventional paths.

## Turning points

- Leaving Pittsburgh to attend Northwestern University was one of the first major transitions of my life.
- Moving to Chicago after college exposed me to new opportunities and communities.
- Leaving a graduate program in public policy was an important decision that pushed me toward entrepreneurship.
- Founding The Point, which eventually became Groupon, dramatically changed the course of my life.
- Leading Groupon through its rapid growth brought opportunities and challenges that shaped me as a leader.
- Leaving Groupon and starting again as a founder taught me how much I enjoyed building from scratch.
- Founding Detour expanded my interest in storytelling, place, and technology.
- Founding Descript allowed me to combine interests in software, media, communication, and creative tools.
- Transitioning from CEO of Descript to chairman marked another significant shift, creating space to focus on new projects and interests.

## Places I've lived

- Pittsburgh, Pennsylvania — where I grew up.
- Evanston, Illinois — while attending Northwestern University.
- Chicago, Illinois — where I spent much of my early career and where Groupon was founded.
- The San Francisco Bay Area — where I later built companies including Detour and Descript.
- Berkeley, California — where I live today with Jenny, Sebastian, Oscar, and Charlie.

## Stories I come back to

- Starting a bagel delivery business as a teenager and discovering the satisfaction of creating something from nothing.
- Leaving a more conventional path behind to pursue entrepreneurship.
- Watching a small side project evolve into Groupon and become far larger than anyone expected.
- Starting over as a founder after major successes and setbacks.
- Building products that help people communicate, create, and tell stories.
- Raising Sebastian and Oscar and seeing baseball become a centerpiece of family life.
- Continuing to learn new skills as an adult, including serious piano study, and being reminded that mastery is a lifelong process.
`;

/**
 * Fill the owner's Present/Past docs from the dev fixtures, but only where the
 * doc is still empty — so it seeds a fresh local setup without ever overwriting
 * edits made through the app or the questionnaire. Safe to call on every
 * dev-login (idempotent once the docs have content).
 */
export async function backfillOwnerContext(
  admin: AdminClient,
  userId: string
): Promise<void> {
  for (const [name, content] of [
    ["Present", DEV_OWNER_PRESENT],
    ["Past", DEV_OWNER_PAST],
  ] as const) {
    await admin
      .from("journal_agent_files")
      .update({ content })
      .eq("user_id", userId)
      .eq("name", name)
      .eq("content", "");
  }
}
