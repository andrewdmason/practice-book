# Practice Book — Implementation Plan

> See also: [Project Plan](./project-plan.md) for the full product spec, data model, and feature details.

## PR 1: Foundation ✅ COMPLETED

**Goal:** Project scaffolding, database, auth, and layout shell.

- ✅ Initialize Next.js project with App Router, Tailwind, shadcn/ui
- ✅ Set up Supabase project: database, auth configuration
- ✅ Implement email magic link auth with single-user lockdown
- ✅ Create all database tables and RLS policies (full schema from above)
- ✅ Build the app layout shell:
  - ✅ Header with navigation (Practice, Lessons, Repertoire, Reports) and search placeholder
  - ✅ Two-column layout: left column (feed) + right column (repertoire focus panel)
  - ✅ Sticky footer bar placeholder
  - ✅ Responsive breakpoints (right column → collapsible section on mobile, footer simplification)
- ✅ Basic routing: `/` (practice), `/lessons`, `/repertoire`, `/reports`
- ✅ Warm visual design: color palette, typography (serif headings, sans-serif body), spacing system

**Implementation notes:**
- Using `@supabase/ssr` with three-client pattern (browser, server, middleware) for Next.js 16 App Router
- Auth callback route enforces single-user lockdown via `AUTHORIZED_EMAIL` env var
- Middleware handles session refresh and route protection
- RLS policies check `auth.uid() IS NOT NULL` (sufficient for single-user app)
- Database schema includes all 11 tables, 5 enums, indexes, triggers, and RLS
- Warm theme: cream backgrounds (oklch 0.98), warm dark foreground, muted terracotta accents
- Typography: Inter (body via `next/font`), Lora (headings via `next/font`)
- Layout uses route group `(app)/` to cleanly separate authenticated pages from login
- shadcn/ui v4 (base-nova style) with custom color overrides in globals.css

## PR 2: Repertoire Database

**Goal:** Full repertoire CRUD and the object page (without mention feeds).

- Repertoire list view grouped by status (Active, Upcoming, Archived)
- Collection support: expandable rows with nested child pieces
- Add/edit forms for pieces and collections
- Piece object page: metadata display, notes field, bookmarks section (add/edit/delete)
- Mastery level selector
- "Getting Stale" section (active pieces with last\_played \> 14 days, using placeholder data until timer is wired)
- Status transitions (active → archived, etc.) with mastery level prompt on archive

## PR 3: Timer ✅ COMPLETED

**Goal:** Working practice timer with piece switching, time logging, and right-column context switching.

- ✅ Sticky footer timer bar with start/stop and elapsed time display
- ✅ Pill buttons for each active piece + Technique + Sight Reading
- ✅ Continuous switching behavior (click a new pill, attribution changes, timer keeps running)
- ✅ Switching pieces updates the right column's repertoire focus panel (show selected piece's context, or repertoire overview when on Technique/Sight Reading/stopped)
- ✅ Write `practice_sessions` and `timer_entries` to Supabase
- ✅ Auto-generate time summary for the current day
- ✅ Wire up `last_played` on repertoire (computed from timer\_entries)
- ✅ "Getting Stale" now uses real data
- ✅ Mobile: dropdown picker replacing pill buttons

**Implementation notes:**
- React Context (`TimerContext`) manages cross-component timer state with localStorage persistence
- Server actions handle all timer mutations (start/switch/stop sessions)
- Elapsed time updates via `setInterval` at 1s granularity, calculated from `Date.now() - sessionStartedAt`
- Abandoned session cleanup: if a stored session is >12 hours old, auto-close it on mount
- JWT expiry set to 1 year in local Supabase for dev convenience
- Dev login button added to bypass auth in development (uses service role key to auto-sign in `andrew@mason.io`)

## PR 4: Rich Text Editor ✅ COMPLETED

**Goal:** Tiptap editor with @ mentions, inline tasks, metronome markings, and /goal command.

- ✅ Tiptap integration with a clean, Notion-like editing experience (Floating UI positioning)
- ✅ Custom inline nodes:
  - Piece mention (`@` trigger, fuzzy autocomplete from repertoire) with styled pill + music icon
  - Metronome marking (`@120` → `♩=120` styled tag in secondary color)
  - Inline task (`[ ]` trigger creates interactive checkbox with taskId for persistence)
- ✅ `/goal` slash command that creates an inline goal block (lesson editor only) with border accent + Target icon
- ✅ Extraction on save: parse Tiptap document and upsert records into `mentions`, `tasks`, and `goals` tables
- ✅ BubbleMenu floating toolbar for text selection formatting (bold, italic, headings, lists, blockquote)
- ✅ Headings (H2, H3), bold, italic, bullet lists, ordered lists, blockquote
- ✅ Auto-save with 1.5s debounce + save on blur; content persists across reloads via Supabase JSONB
- ✅ Demo page (`/editor-demo`) for testing both practice and lesson editors with full round-trip saves

## PR 5: Practice Feed & Unified Timeline ✅ COMPLETED

**Goal:** The main daily practice view with per-piece sections and lessons inline in the feed.

- ✅ Practice feed as the home/default view (left column)
- ✅ Auto-create today's `practice_entry` on first visit or timer start, with `practice_entry_sections` generated for each active piece + Technique + Sight Reading + General Notes
- ✅ Each day shows: date header, time summary block (from timer data), then collapsible per-piece sections with Tiptap editors
- ✅ Empty sections stay collapsed (just the header); sections with content are expanded
- ✅ **Lesson entries appear inline in the feed** on their date, visually distinct from practice entries
- ✅ Today's entry is editable; previous days are read-only in the feed (use `readOnly` prop on RichTextEditor)
- ✅ Clicking into a lesson transitions to zen mode (full-width, no right column) via `/lessons/[id]` route with ZenModeProvider context
- ✅ "New Lesson" button in the feed header and lessons page
- ✅ Infinite scroll / paginated loading for history (cursor-based by date)
- ✅ Mention and task extraction on section save already wired up via existing `saveEditorContent` action

**Implementation notes:**
- Server actions in `src/app/(app)/feed/actions.ts`: `ensureTodayEntry()` called on home page load to ensure today's entry and auto-generated sections exist. `getFeedPage(cursor?, limit=7)` provides cursor-based pagination. `getTimeSummaryForDate(date)` generalizes timer summary logic.
- `FeedSection` component uses shadcn Collapsible, renders editor with context-aware `readOnly` prop and save callbacks.
- `ZenModeProvider` context wraps lesson editor to signal footer bar to hide itself.
- `RichTextEditor` updated with `readOnly` prop: sets `editable: false`, hides BubbleToolbar, disables auto-save.

## PR 6: Lesson Goals & Repertoire Focus Panel ✅ COMPLETED

**Goal:** Goal extraction from lessons, inline tasks wired to the right column, and the full repertoire focus panel.

- `/goal` command in lesson editor creates goal blocks extracted to the `goals` table
- Goals can be linked to a piece via @ mention within the goal text
- Right column repertoire focus panel fully wired:
  - When a piece is selected: shows open tasks, open goals, and recent mentions for that piece
  - When no piece selected: shows repertoire overview with active pieces, last played, and task/goal counts
  - Checkboxes for tasks and goals are interactive from the focus panel
- Mobile: focus panel as collapsible section or tab below the feed

## PR 7: Repertoire Object Pages ✅ COMPLETED

**Goal:** Full repertoire object pages (the dedicated `/repertoire/[id]` view), completing the backlink system.

- ✅ Piece detail page wired with full mention feed (cursor-paginated with infinite scroll)
- ✅ Piece detail page shows open goals and tasks (toggleable checkboxes)
- ✅ Each mention rendered as a card: date, source badge, context snippet
- ✅ Mention cards clickable to source lesson or practice entry
- ✅ New `/repertoire/collections/[id]` collection detail page
- ✅ Collection page aggregates child pieces, goals, tasks, and mentions across all children
- ✅ Navigation: collection links in piece header and collection row now point to collection detail pages

**Implementation notes:**
- Extracted `resolveMentionSources` helper in `focus-panel/actions.ts` to avoid duplication across piece and collection actions
- `getPieceMentions` and `getCollectionMentions` use cursor-based pagination (limit=20) with `created_at` cursors
- New client components: `GoalList`, `TaskList` for toggleable checkboxes; `MentionFeed` for infinite scroll (same pattern as `PracticeFeed`)
- New server component: `MentionCard` for individual mention display
- Collection detail page reuses all object page components for consistent UX
- Build verified clean: no TypeScript errors, all routes properly registered

## PR 8: Reporting

**Goal:** Practice analytics and streak tracking.

- Weekly summary bar chart (total practice time per week, last 3 months)
- Piece breakdown chart (horizontal bars, selectable time range)
- Streak counter and days-practiced-this-week indicator
- Streak/consistency shown subtly on the main practice view
- Use a lightweight charting library (Recharts)

## PR 9: Search

**Goal:** Global search with typeahead.

- Cmd+K activated search modal
- Typeahead: as you type, matching repertoire pieces appear as quick-jump options
- Full-text search across practice entries, lesson entries, repertoire names, bookmarks
- Results grouped by type with preview text and dates
- Clicking a result navigates to the entry
- Postgres full-text search indexes on all content fields
