# Family journal — shared feed (phase 2)

Spec for the shared "family journal" we deliberately scoped out of the family-accounts PR. Phase 1 made the journal multi-user (each member has their own private posts + their own interviewer). Phase 2 adds the Day One–style shared layer: posts can be **private** or **family**, and there's a **family feed** alongside each person's private feed. Captured here so we don't re-derive the intent, the decisions already made, or the open questions.

## Why this exists

The original family pitch had two phases. From the first conversation:

> There will be posts that are private to the user and posts that are family posts, kind of like how an app like Day One has a shared journal. I can look at my own private journal feed or the family journal feed, and on any given post I can decide whether I want to post it to the family journal or the personal journal.

And a key decision from planning: each member's **interviewer should be able to read everyone's family-shared posts** ("weave the family together"). The insight there was that family-awareness should surface as **new question type(s)** rather than dumping every member's posts into every prompt.

## What's already shipped that's relevant (phase 1 groundwork)

Phase 1 was built with this feature in mind, so several seams already exist:

- **`journal_entries.visibility`** — `text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','family'))`. Already on the table; nothing sets it to `'family'` yet.
- **The entries SELECT policy is already in its final form:**
  ```sql
  CREATE POLICY "Read own or family" ON journal_entries FOR SELECT
    USING (user_id = auth.uid() OR visibility = 'family');
  ```
  So a family-visible entry is **already readable by every member** at the entries level — no RLS migration needed for the feed's top-level query. Writes stay own-row (`Insert/Update/Delete own`).
- **`journal_members`** (`user_id`, `name`, `email`, `is_owner`) — the source for **author attribution** in the family feed.
- **Shared family-context doc** (`journal_family`, single row, readable by all) is already injected into every member's interviewer system prompt via `loadFamilyDoc()` in `src/lib/journal/context.ts` → `buildSystemPrompt`. Phase 2's family-aware *questions* are a different mechanism (see below), but the precedent for cross-member context is set.
- **Per-user question types** (`journal_question_types`) with the opening-candidate sampler (`src/lib/journal/opening-candidates.ts`, `sampleQuestionMix`) and age-based mixes (`src/lib/journal/seeds/interviewer-templates.ts`). A `family-followup` type slots into this machinery.

**The one place phase 1 stopped short:** the child tables still scope to the author only —
```sql
-- journal_messages, journal_entry_photos
CREATE POLICY "Own rows" ... USING (user_id = auth.uid());
```
So today another member can read a family entry's *row* (summary, title, pull_quote, visibility) but **not its messages or photos**. Closing that gap is part of this PR (see Data model).

## Scope of this PR

**In scope:**

1. **Per-post visibility control.** On an entry, the author can set it **private** or **family** (and change it back). Default stays private; sharing is always an explicit action. A server action updates `visibility` on the author's own row (already allowed by the `Update own` policy).
2. **Two feeds.** A switcher on `/journal` between **Mine** (your own entries, private + family) and **Family** (every member's `visibility = 'family'` entries, most recent first), with author attribution.
3. **Reading a shared entry.** Opening a family entry from another member shows its content — which requires the child-table RLS seam below.
4. **Family-aware interviewer.** One or more new built-in question types (e.g. `family-followup`) that pull a recent family-shared entry from *another* member into an opening question ("Jenny wrote about the camping trip — how was that for you?"). Wired into the existing candidate generator and the age mixes.
5. **Attribution + light presence.** Family-feed items show who wrote them (name from `journal_members`); your own shared entries show a "Shared to family" badge in your Mine feed.

**Out of scope (future):**

- Comments, reactions, or likes on family posts.
- Notifications / push when someone shares (consistent with the standing "no morning push" preference).
- Per-person visibility (only all-family vs. private — no "share with just Dad").
- Any cross-member *editing*; you only ever control your own posts.
- Owner moderation / review of kids' shared posts (revisit if needed).

## Architecture sketch

### Data model

**Child-table read seam (migration).** Let members read the messages/photos of a *family* entry, while keeping private entries owner-only:

```sql
-- journal_messages
DROP POLICY "Own rows" ON journal_messages;
CREATE POLICY "Read own or family" ON journal_messages FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM journal_entries e
      WHERE e.id = journal_messages.entry_id AND e.visibility = 'family'
    )
  );
-- writes stay own-row:
CREATE POLICY "Write own" ON journal_messages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own" ON journal_messages FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Delete own" ON journal_messages FOR DELETE USING (user_id = auth.uid());
-- same shape for journal_entry_photos
```

**Decision to make first:** does the family feed show the *full transcript* of another member's entry, or just the **summary / title / pull_quote / photos**? The intimate, recommended default is **summary-level** (title, pull_quote, photos, maybe the opening question) — richer than a headline, but it doesn't expose every word of someone's morning reflection to the whole family. If we go summary-level, the `journal_messages` seam above is **not needed yet** (only the photos seam is), which keeps the surface smaller. Pick this before writing the migration.

**Sharing timestamp (optional).** Family-feed ordering by `entry_date`/`created_at` is probably fine. If we want "most recently *shared*" ordering distinct from when the entry was written, add `shared_at timestamptz` set when visibility flips to `'family'`. Defer unless ordering feels wrong.

**Index.** Partial index for the family feed query:
```sql
CREATE INDEX idx_journal_entries_family ON journal_entries (created_at DESC)
  WHERE visibility = 'family';
```

### Feeds

- **Mine** = today's `/journal` behavior (RLS already returns the caller's own rows; family ones included).
- **Family** = `select … from journal_entries where visibility = 'family' order by created_at desc`, then join author names from `journal_members` (by `user_id`). RLS already permits the read.
- Switcher state via a query param (`/journal?feed=family`) or a sub-route. Keep the existing list/card components; add an author line in family mode.
- Files: `src/app/(journal)/journal/page.tsx` (list query), the journal list/card components, and a new visibility action alongside `src/app/(journal)/journal/actions.ts`.

### Visibility toggle

- Action `setEntryVisibility(entryId, 'private' | 'family')` in `journal/actions.ts` — `update({ visibility }).eq('id', entryId)` (own-row via RLS), `revalidatePath('/journal')`.
- Surfaced on the entry view (`/journal/[id]`) and optionally inline on the list. Probably only allow sharing a **closed** entry (after the wrap pass has produced a title/summary) so the family feed always has something presentable — confirm.

### Family-aware interviewer

- New built-in type `family-followup` (consider also `family-recent`): added to `BUILTIN_QUESTION_TYPES` (`src/lib/journal/seeds/defaults.ts`) + a migration to backfill existing members (mirror `00055_kid_question_types.sql`), and woven into the age `mix` maps in `interviewer-templates.ts`.
- In candidate generation (`opening-candidates.ts`), when this type is sampled, fetch a recent **family-shared entry from another member** (`visibility='family' AND user_id <> me`, newest, with author name) and pass its title/summary/pull_quote into the prompt so the model can ask about it. Keep it to summary-level content to match the feed decision and preserve intimacy.
- This reuses `sampleQuestionMix` and the existing candidate flow; no new prompt-assembly path.

### Privacy model (unchanged philosophy)

- Private means private; only family-flagged posts cross members. Writes are always own-row. Un-sharing (family → private) immediately drops a post from the family feed and re-restricts its children.
- The owner gets no special read beyond what any member sees (raw DB access remains acceptable/out of scope, per phase 1).
- Kids use the same model. Whether young kids should have a guardian review step before sharing is an explicit **open question**, not a default.

## Open questions

1. **Feed depth:** summary-level (recommended) vs. full transcript for other members' family entries. Drives whether the `journal_messages` seam is needed now.
2. **Interviewer depth:** should a family-followup question draw on another member's full entry or just its summary/quote? (Recommend summary/quote.)
3. **Share timing:** only closed entries, or any entry? (Recommend closed.)
4. **Quote entries** (`entry_type = 'quote'`): shareable to family too? (Probably yes — they're low-stakes and nice to share.)
5. **Kids + sharing:** any guardian review before a young kid's post hits the family feed, or trust + un-share? (Default: trust; revisit.)
6. **Un-share semantics:** if A shares then unshares, and B's interviewer already referenced it — fine (it just won't resurface). Confirm no audit needed.
7. **Empty states:** family feed before anyone has shared; family-followup question type when there are no other-member family posts yet (it should no-op / fall back to another type in the sampler).

## Verification plan

- **RLS:** as member B, can read member A's `visibility='family'` entry (and its photos / messages per the depth decision); **cannot** read A's `private` entry or its children. Writes to A's rows still rejected. (Mirror the JWT-claims psql tests from the phase-1 verification.)
- **Toggle:** share/un-share flips `visibility`, appears/disappears in the Family feed, and child content follows.
- **Feeds:** Mine shows own private + family with a "shared" badge; Family shows all members' shared posts with correct author names, newest first.
- **Interviewer:** with at least one other-member family post present, the `family-followup` type produces an opening question that references it by author; with none present, the sampler falls back cleanly.
- `npm run build` + `tsc --noEmit` clean.
