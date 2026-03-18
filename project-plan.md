# Practice Book — Project Plan

## Overview

Practice Book is a personal web app for logging piano practice sessions, tracking repertoire, and capturing lesson notes. It's designed to be used at the piano on a 13" MacBook Pro, with full mobile support for reviewing notes and goals on the go.

The app is built around a daily practice workflow: open the app, start the timer, write notes as you practice, and review goals from your last lesson. Over time, it becomes a rich, searchable archive of your musical development.

## Design Philosophy

**Warm, calm, and slightly analog.** The app should feel like a beautiful music notebook, not a SaaS dashboard. Cream/warm white backgrounds, a serif or semi-serif font for headings (Lora or Newsreader), clean sans-serif for body text (Inter or similar), and muted accent colors. Notion-like cleanliness but warmer — something that belongs at the piano.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database & Auth:** Supabase (Postgres + Row Level Security + Auth)
- **Rich Text Editor:** Tiptap
- **Hosting:** Vercel
- **Auth method:** Email magic link, locked to a single authorized email address

## Layout

### Desktop (primary)

- **Header:** App title/logo, global navigation (Practice, Lessons, Repertoire, Reports), global search (Cmd+K)
- **Two-column practice view (default):**
  - **Left column (feed):** A unified chronological feed containing both daily practice entries and lesson entries, most recent at top. New days appear at the top; scroll down to see history. Lessons are inserted inline in the feed on the day they occurred.
  - **Right column (repertoire focus panel):** A contextual panel that shows content for the currently selected repertoire piece. Automatically switches when you switch pieces in the timer. Contains:
	1. **Open tasks** related to this piece (from goals/inline tasks) at the top
	2. **Recent mentions** — a chronological feed of all notes and lesson excerpts that reference this piece
	3. When no piece is actively selected (e.g. timer is on Technique/Sight Reading or stopped), the right column shows a default repertoire overview: all active pieces with their status, mastery level, and last played date.
- **Footer (sticky):** Practice timer bar. Start/stop button, elapsed time display, horizontal row of pill buttons for each active repertoire piece + "Technique" + "Sight Reading." Active piece is highlighted. Clicking a different pill switches attribution without stopping the timer **and flips the right column to that piece's context.**

### Mobile

- **Timer footer:** Simplified — start/stop + dropdown picker for piece selection instead of pill buttons
- **Right column:** Becomes a collapsible section below the feed, or accessible via a tab/toggle
- **Full read/write access** to all views, with a simplified Tiptap toolbar (floating toolbar or markdown shortcuts)
- **Search:** Full functionality via search icon in header

### Lesson entry in the feed

- Lessons appear inline in the feed on their date, visually distinct from practice entries (different card style, "Lesson" label)
- Clicking into a lesson entry expands it into a focused, full-width zen mode editor (no right column, no timer bar) optimized for fast, uninterrupted live note-taking
- Lessons can be created from the feed with a "New Lesson" button or from the Lessons nav item

## Data Model

### Repertoire

	collections
	  - id (uuid, PK)
	  - name (text) — e.g. "Goldberg Variations", "Chopin Etudes Op. 10"
	  - composer (text)
	  - notes (text, optional)
	  - created_at (timestamp)
	  - updated_at (timestamp)
	
	pieces
	  - id (uuid, PK)
	  - collection_id (uuid, FK → collections, nullable)
	  - name (text) — e.g. "Variation 15", "Scherzo No. 2 in B-flat minor"
	  - composer (text) — denormalized for standalone pieces without a collection
	  - status (enum: active, upcoming, archived)
	  - mastery_level (enum: learning, playable, performance_ready, memorized)
	  - notes (text, optional)
	  - created_at (timestamp)
	  - updated_at (timestamp)
	
	bookmarks
	  - id (uuid, PK)
	  - piece_id (uuid, FK → pieces)
	  - name (text) — e.g. "hard passage", "exposition", "coda"
	  - measure_start (int)
	  - measure_end (int, nullable) — null if single measure
	  - created_at (timestamp)

**Derived field:** `last_played` is computed from the most recent `timer_entries` record for that piece, not stored directly.

### Timer

	practice_sessions
	  - id (uuid, PK)
	  - date (date) — the practice day
	  - started_at (timestamp)
	  - ended_at (timestamp, nullable) — null if session is still active
	  - created_at (timestamp)
	
	timer_entries
	  - id (uuid, PK)
	  - session_id (uuid, FK → practice_sessions)
	  - piece_id (uuid, FK → pieces, nullable) — null for technique/sight reading
	  - category (enum: piece, technique, sight_reading)
	  - started_at (timestamp)
	  - ended_at (timestamp, nullable)

### Practice Log

	practice_entries
	  - id (uuid, PK)
	  - date (date, unique) — one entry per day, auto-created
	  - created_at (timestamp)
	  - updated_at (timestamp)
	
	practice_entry_sections
	  - id (uuid, PK)
	  - practice_entry_id (uuid, FK → practice_entries)
	  - piece_id (uuid, FK → pieces, nullable) — null for technique/sight_reading/general sections
	  - category (enum: piece, technique, sight_reading, general) — type of section
	  - content (jsonb) — Tiptap JSON document
	  - sort_order (int) — display ordering
	  - created_at (timestamp)
	  - updated_at (timestamp)

When a practice entry is auto-created for the day, it generates one section per active repertoire piece, plus "Technique," "Sight Reading," and "General Notes" sections. Sections with no content are visually collapsed/minimal — they don't clutter the view if you didn't work on that piece today.

### Lesson Log

	lessons
	  - id (uuid, PK)
	  - date (date)
	  - content (jsonb) — Tiptap JSON document
	  - created_at (timestamp)
	  - updated_at (timestamp)
	
	goals
	  - id (uuid, PK)
	  - lesson_id (uuid, FK → lessons)
	  - piece_id (uuid, FK → pieces, nullable) — linked to a specific piece if relevant
	  - text (text) — goal description
	  - content (jsonb, nullable) — rich text if created via /goal inline command
	  - completed (boolean, default false)
	  - note (text, nullable) — optional inline progress note
	  - created_at (timestamp)
	  - updated_at (timestamp)

### Mentions (for backlinks)

	mentions
	  - id (uuid, PK)
	  - piece_id (uuid, FK → pieces)
	  - source_type (enum: practice_entry, lesson)
	  - source_id (uuid) — FK to practice_entries or lessons
	  - context_snippet (text) — surrounding paragraph for display on repertoire page
	  - created_at (timestamp)

### Inline Tasks

	tasks
	  - id (uuid, PK)
	  - source_type (enum: practice_entry, lesson)
	  - source_id (uuid) — FK to practice_entries or lessons
	  - piece_id (uuid, FK → pieces, nullable) — linked to a piece if the task contains an @ mention or is in a piece-scoped section
	  - text (text) — task description
	  - completed (boolean, default false)
	  - created_at (timestamp)
	  - updated_at (timestamp)

Tasks are created by typing `[]` in any editor (practice notes or lesson notes). They render as interactive checkboxes inline in the text. On save, tasks are extracted to the `tasks` table so they can be queried and displayed in the right column's repertoire focus panel. Tasks linked to a piece (via @ mention or section context) show up as open tasks on that piece's focus panel.

## Rich Text Editor (Tiptap)

Both practice entry sections and lesson entries use the same Tiptap editor. The editor is intentionally simple for v1 — the focus is on fast, frictionless note-taking.

### Basic formatting

Standard Notion-like: headings (H1, H2, H3), bold, italic, bullet list, numbered list, blockquote, horizontal rule. Clean floating toolbar on selection.

### Custom inline nodes

**Piece Mention (`@` trigger):**
- Typing `@` opens an autocomplete popup listing repertoire pieces
- Fuzzy matching — `@scher` matches "Scherzo No. 2 in B-flat minor"
- Fast — must not interrupt typing flow during live lesson note-taking
- Selecting a piece inserts a styled inline tag (warm background pill with the piece name)
- The tag is a link to the piece's object page

**Metronome Marking (`@` + number trigger):**
- Typing `@` followed immediately by a number (e.g. `@120`) inserts a metronome marking tag: `♩=120`
- Rendered as a styled inline pill, visually distinct from piece mentions
- **Future enhancement:** clicking the metronome tag opens a built-in metronome set to that tempo. For v1, it's just a visual tag.

**Inline Task (`[]` trigger):**
- Typing `[]` at any point in the editor creates an interactive checkbox inline in the text
- The checkbox is toggleable directly in the editor
- On save, tasks are extracted to the `tasks` table with their text content and any piece association (from @ mention in the task text, or from the practice section context)
- Tasks appear in the right column's repertoire focus panel when linked to a piece

**Goal block (`/goal` slash command) — lesson editor only:**
- Typing `/goal` at the start of a line creates a special goal block
- The goal block has a distinct visual style (e.g. left border accent, goal icon)
- Content inside the goal block is extracted on save and inserted into the `goals` table
- If the goal contains an @ piece mention, the goal is linked to that piece via `goals.piece_id`

### Extraction on save

When any editor (practice section or lesson) is saved, two extraction passes run:

**Mention extraction:**
- Parse the Tiptap document for all piece mention nodes
- For each mention, extract: piece\_id, source entry, context snippet (surrounding paragraph)
- Upsert into the `mentions` table (delete old mentions for this source, insert new ones)
- Practice entry sections scoped to a specific piece also generate implicit mentions (even without explicit @ mention)

**Task extraction:**
- Parse the Tiptap document for all task/checkbox nodes
- For each task, extract: text content, completed state, piece association (from @ mention in the task or section context)
- Upsert into the `tasks` table

These mentions and tasks power the repertoire focus panel in the right column and the repertoire object pages.

## Feature Details

### Repertoire Database

- **List view:** All pieces grouped by status (Active, Upcoming, Archived). Collections shown as expandable rows with children nested underneath. Standalone pieces shown at the top level.
- **Object page (per piece):** Metadata at top (composer, status, mastery level, last played, parent collection). Named bookmarks section. Notes field. Open tasks and goals related to this piece. Below that, a reverse-chronological feed of all mentions from practice and lesson entries, each shown as a card with date, source label, and the surrounding paragraph as context. Clicking a card navigates to the full entry. (This is essentially the same content as the right-column focus panel, but as a full page — useful for deep review of a piece's history.)
- **"Getting Stale" section:** At the top of the repertoire view, shows any active piece where last played \> 14 days ago, sorted by staleness. Threshold is configurable.
- **Add/edit piece form:** Name, composer, optional collection, status, mastery level, notes.
- **Add/edit collection form:** Name, composer, notes.

### Timer

- Sticky footer bar on the practice view.
- Start/stop button, elapsed time display (current segment + total session).
- Horizontal row of pill buttons: one per active repertoire piece (truncated name if needed) + "Technique" + "Sight Reading."
- Active pill is highlighted. Clicking a different pill switches attribution continuously — no pause.
- **Switching pieces in the timer also switches the right column's repertoire focus panel** to show that piece's tasks, goals, and mentions.
- Timer data is written to `timer_entries` linked to the current `practice_session`.
- When the timer runs for a day, the corresponding `practice_entries` record shows an auto-generated time summary block: e.g. "45 min Scherzo, 20 min Technique, 15 min Sight Reading. Total: 1h 20min."
- Mobile: start/stop + dropdown picker replaces pill buttons.

### Practice Feed (Left Column)

- The default/home view of the app. A unified chronological feed in the left column.
- Contains both **daily practice entries** and **lesson entries**, interleaved by date.
- New days appear at the top; scroll down to see history.
- Each day's practice entry is auto-created the first time you open the app or start the timer that day.
- **Each practice entry is structured as sections** — one section per active repertoire piece, plus "Technique," "Sight Reading," and "General Notes." Each section has a header (piece name or category) and a Tiptap editor.
- Sections you didn't write in stay collapsed/minimal (just the header, not a big empty editor). Sections with content are expanded.
- The auto-generated time summary from timer data appears at the top of the day's entry.
- Today's entry is editable directly in the feed. Previous days are read-only in the feed (click to open in an editable view if needed).
- Infinite scroll or paginated loading for history.
- If a new piece is added to active repertoire mid-week, it appears as a section in subsequent days' entries.
- **Lesson entries** appear inline in the feed on their date, with a visually distinct card style. Clicking into a lesson opens it in zen mode.

### Lesson Log

- Lessons appear inline in the practice feed on their date, visually distinct (different card style, "Lesson" label, perhaps a subtle left border accent).
- A "New Lesson" button is available in the feed header and in the Lessons nav section.
- The "Lessons" nav item shows a dedicated list of all lessons by date for quick access.
- Each lesson entry has a full Tiptap editor (same capabilities: @ mentions, @tempo, [], /goal).
- Clicking into a lesson entry transitions to a focused, full-width zen mode editor (no right column, no timer bar) optimized for fast, uninterrupted live note-taking.
- `/goal` slash command creates an inline goal block that is both visible in the lesson notes and extracted to the `goals` table.
- Goals can be linked to a specific piece via @ mention within the goal text.

### Repertoire Focus Panel (Right Column)

The right column is a contextual panel that updates based on the currently selected piece in the timer.

**When a piece is selected (timer active on a specific piece):**
1. **Piece header:** Name, composer, mastery level, last played
2. **Open tasks** related to this piece — pulled from the `tasks` table, filtered to incomplete tasks linked to this piece. Checkboxes are interactive (can be completed from here).
3. **Open goals** related to this piece — from the `goals` table, incomplete goals linked to this piece.
4. **Recent mentions** — a chronological feed of practice notes and lesson excerpts that reference this piece, showing date, source label, and context snippet. Most recent first.

**When no piece is selected (timer on Technique/Sight Reading, or timer stopped):**
- Shows a **repertoire overview**: all active pieces listed with status, mastery level, last played date, and count of open tasks/goals. Clicking a piece manually switches the panel to that piece's context.
- "Getting Stale" pieces highlighted at the top.

### Reporting

- Accessible from main navigation.
- **Weekly summary chart:** Bar chart of total practice time per week over the last 3 months.
- **Piece breakdown:** For a selected time range, horizontal bar chart showing time distribution across pieces, technique, and sight reading.
- **Streak/consistency:** Days practiced this week, consecutive-day streak. Shown subtly on the main practice view as well.

### Search

- Global search bar in the header, activated via Cmd+K.
- Searches across: practice entry text, lesson text, repertoire names, bookmark names.
- **Typeahead matching for repertoire pieces** — as you type, matching pieces appear as quick-jump options before full-text results.
- Results grouped by type (Practice Logs, Lessons, Repertoire) with matching text previewed and date shown.
- Clicking a result navigates to that entry.
- Powered by Postgres full-text search via Supabase.

## Authentication

- Supabase Auth with email magic link.
- Single authorized email address — all other signups are rejected with a "This app is private" message.
- Row Level Security on all tables scoped to the authenticated user.

## Implementation Plan

### PR 1: Foundation

**Goal:** Project scaffolding, database, auth, and layout shell.

- Initialize Next.js project with App Router, Tailwind, shadcn/ui
- Set up Supabase project: database, auth configuration
- Implement email magic link auth with single-user lockdown
- Create all database tables and RLS policies (full schema from above)
- Build the app layout shell:
  - Header with navigation (Practice, Lessons, Repertoire, Reports) and search placeholder
  - Two-column layout: left column (feed) + right column (repertoire focus panel)
  - Sticky footer bar placeholder
  - Responsive breakpoints (right column → collapsible section on mobile, footer simplification)
- Basic routing: `/` (practice), `/lessons`, `/repertoire`, `/reports`
- Warm visual design: color palette, typography (serif headings, sans-serif body), spacing system

### PR 2: Repertoire Database

**Goal:** Full repertoire CRUD and the object page (without mention feeds).

- Repertoire list view grouped by status (Active, Upcoming, Archived)
- Collection support: expandable rows with nested child pieces
- Add/edit forms for pieces and collections
- Piece object page: metadata display, notes field, bookmarks section (add/edit/delete)
- Mastery level selector
- "Getting Stale" section (active pieces with last\_played \> 14 days, using placeholder data until timer is wired)
- Status transitions (active → archived, etc.) with mastery level prompt on archive

### PR 3: Timer

**Goal:** Working practice timer with piece switching, time logging, and right-column context switching.

- Sticky footer timer bar with start/stop and elapsed time display
- Pill buttons for each active piece + Technique + Sight Reading
- Continuous switching behavior (click a new pill, attribution changes, timer keeps running)
- Switching pieces updates the right column's repertoire focus panel (show selected piece's context, or repertoire overview when on Technique/Sight Reading/stopped)
- Write `practice_sessions` and `timer_entries` to Supabase
- Auto-generate time summary for the current day
- Wire up `last_played` on repertoire (computed from timer\_entries)
- "Getting Stale" now uses real data
- Mobile: dropdown picker replacing pill buttons

### PR 4: Rich Text Editor

**Goal:** Tiptap editor with @ mentions, inline tasks, metronome markings, and /goal command.

- Tiptap integration with a clean, Notion-like editing experience
- Custom inline nodes:
  - Piece mention (`@` trigger, fuzzy autocomplete from repertoire)
  - Metronome marking (`@120` → `♩=120` styled tag)
  - Inline task (`[]` trigger creates interactive checkbox)
- `/goal` slash command that creates an inline goal block (for lesson editor)
- Extraction on save: parse Tiptap document and upsert records into `mentions` and `tasks` tables
- Floating toolbar for mobile
- Headings, bold, italic, bullet lists — standard rich text basics

### PR 5: Practice Feed & Unified Timeline

**Goal:** The main daily practice view with per-piece sections and lessons inline in the feed.

- Practice feed as the home/default view (left column)
- Auto-create today's `practice_entry` on first visit or timer start, with `practice_entry_sections` generated for each active piece + Technique + Sight Reading + General Notes
- Each day shows: date header, time summary block (from timer data), then collapsible per-piece sections with Tiptap editors
- Empty sections stay collapsed (just the header); sections with content are expanded
- **Lesson entries appear inline in the feed** on their date, visually distinct from practice entries
- Today's entry is editable; previous days are read-only in the feed (click to open editable view)
- Clicking into a lesson transitions to zen mode (full-width, no right column)
- "New Lesson" button in the feed header
- Infinite scroll / paginated loading for history
- Wire up mention and task extraction on section save

### PR 6: Lesson Goals & Repertoire Focus Panel

**Goal:** Goal extraction from lessons, inline tasks wired to the right column, and the full repertoire focus panel.

- `/goal` command in lesson editor creates goal blocks extracted to the `goals` table
- Goals can be linked to a piece via @ mention within the goal text
- Right column repertoire focus panel fully wired:
  - When a piece is selected: shows open tasks, open goals, and recent mentions for that piece
  - When no piece selected: shows repertoire overview with active pieces, last played, and task/goal counts
  - Checkboxes for tasks and goals are interactive from the focus panel
- Mobile: focus panel as collapsible section or tab below the feed

### PR 7: Repertoire Object Pages

**Goal:** Full repertoire object pages (the dedicated `/repertoire/[id]` view), completing the backlink system.

- Repertoire object page shows the same content as the focus panel but as a full page: metadata, bookmarks, open tasks, open goals, and a complete reverse-chronological mention feed
- Each mention rendered as a card: date, source type/label, context paragraph
- Clicking a mention card navigates to the full practice or lesson entry
- Collection pages aggregate mentions, tasks, and goals across all child pieces

### PR 8: Reporting

**Goal:** Practice analytics and streak tracking.

- Weekly summary bar chart (total practice time per week, last 3 months)
- Piece breakdown chart (horizontal bars, selectable time range)
- Streak counter and days-practiced-this-week indicator
- Streak/consistency shown subtly on the main practice view
- Use a lightweight charting library (Recharts)

### PR 9: Search

**Goal:** Global search with typeahead.

- Cmd+K activated search modal
- Typeahead: as you type, matching repertoire pieces appear as quick-jump options
- Full-text search across practice entries, lesson entries, repertoire names, bookmarks
- Results grouped by type with preview text and dates
- Clicking a result navigates to the entry
- Postgres full-text search indexes on all content fields
