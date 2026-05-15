-- Seed Andrew's personal USER.md and MEMORY.md content. Single-user app —
-- this is the only user — so committing the personal context to a migration
-- is the simplest way to get it into production.
--
-- Conditional on `content = ''` so this is safe to re-run and won't clobber
-- edits made via the agent chat sidebar or the agent settings page after
-- the migration first applied.

UPDATE journal_agent_files SET content = $user$# Andrew

## Situation

Left Descript (was CEO/founder). Not currently working a traditional job — not retired, but flexible. Has many interests; usually has half a dozen project ideas in various stages.

## Family

- Jenny — wife (Jenny Gillespie Mason). Coordinates the family calendar.
- Sebastian — older son. Bentley School (K-8). Plays guitar (Thursday lessons), baseball / batting cage (FSB).
- Oscar — younger son. Baseball with Coach Ben (Tuesdays 4–6pm at FSB, ages 8–12). Basketball Saturdays.
- Kids attend school in the East Bay. Andrew does morning drop-off (~7:55am).

## Currently working on

Active:
- **Tabletop Library (TTL)** — board game library/venue in the East Bay. Major focus.
- **Descript Board** — board of directors role at his former company.
- **Morning journal app** — this app you live in (AI-driven daily interview-style journaling).
- **Christmas trip planning** — researching Four Seasons properties: Anguilla, Nevis, Punta Mita. Also looked at Maldives (Jan–April best).
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
$user$
WHERE name = 'USER' AND (content IS NULL OR content = '');

UPDATE journal_agent_files SET content = $mem$# Memory

## Style guide — what kinds of questions land for Andrew

What works:
- Questions tied to significant calendar events — slightly better when asked AFTER the event than before.
- Checking in on a specific project or interest (piano progress, TTL, etc.) — but rotate, don't over-index.
- Open reflective questions ("what have you been chewing on that you haven't told anyone about?") — high-risk / high-reward, save for the right moment.
- Noticing patterns across what Andrew is doing — connecting threads (e.g. multiple vibe-coding projects) and asking what's drawing him to them.
- Kids' activities, especially baseball — reliable, frequent, good when there's a recent game.

What to avoid:
- Asking about the same domain two days in a row.
- Over-indexing any single topic, even a frequent one (don't always ask about baseball).

Still calibrating:
- Photo-based questions (referencing recent photos) — untested, could be interesting.
- Deep abstract questions — Andrew is open to them, but they won't always land.
$mem$
WHERE name = 'MEMORY' AND (content IS NULL OR content = '');
