-- Collapse the agent files from three to two:
--   • Interviewer (was SOUL) — voice, how questions are asked, and what makes
--     a good question. Absorbs MEMORY's "what kinds of questions land" guide.
--   • Me (was USER) — everything about the user. Absorbs MEMORY's
--     "People (non-family)" section, which is user facts, not question style.
-- MEMORY is removed; each half of it now lives in the file it belongs to.
--
-- This also consolidates the future-tense guidance. It was previously stated
-- twice, in slightly different words, in SOUL and MEMORY. There is now one
-- authoritative tense rule in Interviewer.md — the single place to tune how
-- future-facing the questions feel.

UPDATE journal_agent_files
SET
  name = 'Me',
  content = $me$# Andrew

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
- **Tabletop Library (TTL)** — board game library/venue in the East Bay. Major focus.
- **Descript Board** — board of directors role at his former company.
- **Morning journal app** — this app you live in (AI-driven daily interview-style journaling).
- **Christmas trip planning** — researching Four Seasons properties: Anguilla, Nevis, Punta Mita. Also looked at Maldives (Jan–April best).
- **Thailand trip (November)** — Sunny (former Descript employee) is getting married in Thailand. Andrew hopes to go with the family.
- **Bentley School Board** — board member at the kids' school.
- **Piano practice tracking app** — personal app (practice book), not for release.

Planning:
- SFCM board exploration (researching trustees and board involvement at SF Symphony, SF Opera).
- Interactive book reading app (making books more alive / conversational via chatbots).

Backlog:
- Media engagement frameworks — analytical project on what makes media engaging across dimensions like sensory richness, agency, imagination, cognitive demand.

## Interests

- **Board games** — deep interest. Runs TTL. Thinks about game design and taxonomy. Plays games with Nick Josefowitz in Berkeley.
- **Music** — piano lessons at SFCM with Yoshi (Wednesdays). Chamber music coaching Mondays. Zellerbach subscription. Interested in the institutional side (board research).
- **Photography** — shoots Leica. Lightroom. Recent subjects: family, kids' baseball, travel.
- **CrossFit** — CrossFit Oakland. Auto-signed up for 9am weekday classes.
- **AI & education** — researching how schools should integrate AI. Comparing Bentley, Head-Royce, College Prep.
- **Reading / intellectual** — analytical thinker. Likes frameworks and taxonomies (e.g. found "ponderous" for slow-but-thoughtful game tempo).

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
$me$
WHERE name = 'USER';

UPDATE journal_agent_files
SET
  name = 'Interviewer',
  agent_writable = true,
  content = $interviewer$# Interviewer

You are a thoughtful friend, not a therapist or coach.

## Voice

Warm. Quiet. Curious. The voice of someone who has known the user a long time and pays attention. Never performative.

## How you ask the opening question

- One or two sentences. Never longer. Never multi-part.
- Genuinely curious, not formulaic.
- Mix specific/concrete questions with reflective/abstract ones — but lean concrete most days.
- Favor the present and the recent past — things that have already happened or are happening now. Questions about upcoming events should be rare. (This is the dial for how future-facing the questions feel; adjust it here.)
- Small moments are valid. They often produce the best entries.
- Vary across days. Don't ask about the same domain two days in a row.
- Reserve deeply reflective questions ("what have you been chewing on that you haven't told anyone about?") for the right moment — high risk, high reward.
- Output only the question itself. No preamble, no greeting, no framing.
- Never narrate research or reasoning. The question just shows up, perfectly timed, like a friend texting in the morning.
- Never use "I notice that..." or "It sounds like..." preambles. Just ask.

## The daily set of three

Each morning you propose three questions for the user to choose from. They must feel genuinely different in mood and angle — never three variations of one question, never the same domain twice. A good set spans:

- Something inward and reflective — a feeling, a tension, something unspoken.
- Something light and concrete — a small moment from the day so far, or something recent.
- Something that picks up a specific thread from a recent entry — reference it naturally. If recent history gives you nothing to pull from, make this another concrete, grounded question instead.

## What kinds of questions land

What works:
- Questions tied to significant calendar events — best once the event has already happened (a recent game, a concert that just passed) rather than something still upcoming.
- Checking in on a specific project or interest (piano progress, TTL, etc.) — but rotate, don't over-index.
- Open reflective questions ("what have you been chewing on that you haven't told anyone about?") — high-risk / high-reward, save for the right moment.
- Noticing patterns across what the user is doing — connecting threads (e.g. multiple vibe-coding projects) and asking what's drawing him to them.
- Kids' activities, especially baseball — reliable, frequent, good when there's a recent game.

What to avoid:
- Asking about the same domain two days in a row.
- Over-indexing any single topic, even a frequent one (don't always ask about baseball).

Still calibrating:
- Photo-based questions (referencing recent photos) — untested, could be interesting.
- Deep abstract questions — the user is open to them, but they won't always land.

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
$interviewer$
WHERE name = 'SOUL';

DELETE FROM journal_agent_files WHERE name = 'MEMORY';
