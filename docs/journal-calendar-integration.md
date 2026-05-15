# Journal — calendar integration (deferred)

Spec for the calendar feature we deliberately scoped out of the initial journal app PR. Captured here so the next time we pick this up we don't re-derive the intent or the open questions.

## Why this exists

The original journal pitch leaned heavily on calendar awareness as the source of "the magic":

> Checks the user's calendar for today and the next few days across all relevant calendars (work, family, kids' activities). Asking about events after they happen tends to work better than before.
>
> Calendar-driven [questions are best] when something interesting just happened or is coming up.

Without calendar context, the interviewer is working from USER.md (static life context) + MEMORY.md (slowly-accumulated style guide) + recent journal history. That's enough to generate decent questions — but it can't know that the kids had a baseball playoff yesterday, or that there's a board meeting today, or that the permit walkthrough finally happened on Thursday. Calendar fills that gap and turns a thoughtful interviewer into one that "already knows your life."

## What's already shipped that's relevant

- Journal interviewer at `/journal` with streaming chat (see `src/app/(journal)/`).
- Per-turn system prompt assembly in `src/lib/journal/context.ts` — already injects SOUL/USER/MEMORY + recent journal history. Calendar events would fold in here as another context block.
- Single-user auth lockdown via `AUTHORIZED_EMAIL` (one Google account).
- Wrap pass that surfaces noticeable things into the agent chat sidebar (`src/app/(journal)/journal/api/close/route.ts`). When a session references a calendar event, the wrap pass could later suggest "add this recurring thing to USER.md."

## Scope of this future PR

**In scope**:
- Connect a Google account, store OAuth tokens in Supabase.
- Pre-fetch calendar events from a configurable window (default: last 3 days + next 7 days).
- Inject them into the journal interviewer's system prompt as a structured block.
- Settings UI to (a) connect/disconnect, (b) pick which calendars to include, (c) preview what's currently in scope.
- Graceful degradation: if Google is unreachable or tokens expired, the interviewer still works — just without calendar context — and a "calendar disconnected" notice surfaces in the agent chat.

**Out of scope (future-future)**:
- Photos / Apple Photos integration.
- Other "recent activity" hooks (other apps, notes, browser history).
- Scheduled morning push notifications (Andrew explicitly doesn't want this — see [original journal plan](../../.claude/plans/i-actually-think-there-lexical-parasol.md)).
- Apple Calendar, Outlook, or any non-Google source.

## Architecture sketch

### Auth

- Google OAuth 2.0 with the `https://www.googleapis.com/auth/calendar.readonly` scope.
- Reuse Supabase Auth's existing Google sign-in if it grants this scope, OR run a separate OAuth flow for calendar specifically. Probably the latter because the existing sign-in only requests basic profile.
- Store credentials in a new table:

```sql
CREATE TABLE journal_calendar_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'google',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text NOT NULL,
  account_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Single-user app means at most one row at a time. Encryption-at-rest is whatever Supabase provides; for higher safety we could encrypt with `pgcrypto` against a server-side key, but probably overkill for v1.

### Calendar source selection

After OAuth, list available calendars via Google Calendar API (`/calendar/v3/users/me/calendarList`). Persist the user's choice of which calendars to include:

```sql
CREATE TABLE journal_calendar_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_calendar_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Andrew's likely picks based on USER.md: his personal Google calendar, Jenny's shared family calendar, and the "All Going" / "All Following" KidCalendar.app calendars.

### Fetch + cache

A server-side helper `loadCalendarEvents(start, end)` that:

1. Loads enabled `journal_calendar_sources`.
2. For each, calls Google Calendar API `events.list` with `timeMin=start`, `timeMax=end`, `singleEvents=true`, `orderBy=startTime`.
3. Refreshes the access token if expired (uses refresh_token).
4. Returns a flat normalized list: `{ calendar_name, summary, start, end, location?, description? }`.

Cache aggressively — once per day per window — in a small `journal_calendar_cache` table or just in-memory if we're OK re-fetching when the server restarts. The journal opens a couple times a day; calendar API quotas aren't tight; probably no DB cache needed for v1.

### Injection into the interviewer

In `src/lib/journal/context.ts`, extend `buildSystemPrompt()` to take a calendar block:

```
=== Calendar — last 3 days + next 7 ===
Yesterday (Mon, May 13)
- 9:00 Crossfit Oakland
- 6:00pm Sebastian baseball game (FSB)
Today (Tue, May 14)
- 12:00 TTL meeting w/ Vera (3048 Claremont)
- 4:00 Oscar baseball, Coach Ben
Tomorrow (Wed, May 15)
- 5:00 Piano lesson @ SFCM with Yoshi
...
```

Format human-readable, not JSON — Claude reads natural language better and we don't need it to do reasoning over structure. Truncate event descriptions to ~200 chars. Mark all-day events explicitly. Include location if present.

Add a hint to SOUL.md (via the agent chat, after this lands) about preferring "happened yesterday" hooks over "coming up tomorrow" hooks per the original spec.

### UI

- New page `/journal/agent/calendar` (or a section inside `/journal/agent`) with:
  - "Connect Google Calendar" button (or "Connected as andrew@…" + disconnect).
  - List of available calendars with enable/disable toggles.
  - Preview pane showing the next system-prompt-injected calendar block, so the user can see what the interviewer will know.
- Add a small calendar icon next to the chat trigger in the header (or fold into the agent settings page — probably the latter).

### Tooling for the agent chat

The agent chat sidebar should be able to:
- Tell the user the calendar connection status ("connected as X, pulling 4 calendars").
- Refresh the calendar cache on demand ("re-pull calendar now").
- NOT directly read or write calendar data — it just talks about what's connected.

## Open questions

1. **OAuth scope**: read-only is enough; do we ever want write access (e.g. so the agent can add a "journal: morning" event)? Probably no, but worth deciding before requesting consent.
2. **Multi-account**: Andrew may have multiple Google accounts (personal + work). Single-account for v1; add account-switcher later if needed.
3. **Privacy filter**: should events marked "private" or "confidential" be included or skipped? Default skip.
4. **Attendee details**: the original spec mentions multi-calendar (work, family, kids'). Do attendees ever matter (e.g. "you had lunch with X yesterday")? Probably skip for v1 — adds noise + privacy load.
5. **Recurring events**: how to surface? Probably collapse to the actual instances within the window, with the recurrence stripped. The interviewer doesn't need to know "this is a weekly thing."
6. **Time zones**: events come from Google in their local TZ. Normalize to the user's IANA zone (we already track this via `tz` cookie; see `src/lib/date-utils.ts`).
7. **Stale OAuth**: when the refresh token is invalidated (user revoked, password changed), what's the recovery flow? Auto-surface in agent chat: "calendar disconnected — want to re-link?"
8. **Cost / quota**: Google Calendar API has generous free quotas; not a concern at single-user scale.

## Verification (when we build this)

1. OAuth flow: connect → see calendar list → pick subset → events appear in preview.
2. Disconnect → preview empties.
3. Token refresh: simulate expired access token → next fetch transparently refreshes.
4. Token revocation: revoke from Google → next fetch fails gracefully → agent chat gets a "calendar disconnected" message.
5. Question quality: with calendar connected and a real event happening yesterday, the interviewer asks about it (manual qualitative check across a few mornings).
6. No leakage: calendar tokens never appear in client-side bundles or in any log.

## Original spec excerpt (for posterity)

This is the relevant section of the original journal pitch — keeping it inline so we don't lose intent:

> **Research the AI does silently before generating each question:**
> - Re-reads the profile to ground itself
> - Re-reads the question log to avoid repeats and respect the style guide
> - Checks active projects for things worth following up on
> - **Checks the user's calendar for today and the next few days across all relevant calendars (work, family, kids' activities). Asking about events after they happen tends to work better than before.**
> - Skims recent activity (other app sessions, notes, photos) for fresh hooks
>
> **Question selection principles:**
> - Rotate domains — don't ask about the same topic two days in a row
> - **Calendar-driven when something interesting just happened or is coming up**
> - Project check-ins are good when paired with variety
> - Reserve deeply reflective questions for the right moment — higher risk, higher reward
> - It's okay to notice patterns across what the user is doing and ask about the connection

The "asking about events after they happen tends to work better than before" line is doing a lot of the work in this spec. The interviewer should weight retrospective hooks (yesterday's game, this morning's drop-off) over prospective ones (tomorrow's meeting), with occasional forward-looking exceptions.
