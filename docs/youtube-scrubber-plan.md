# YouTube Video Scrubber

Associate YouTube videos with pieces and navigate between sections via a colored scrubber bar.

## Confirmed Decisions

- Multiple videos per piece in DB, one active in UI
- Collapsible YouTube player above scrubber
- Section timestamps set on piece detail page with "mark current time" button while video plays
- Timer and video playback are independent
- Clicking a section on the scrubber: seeks video + sets metronome to practice tempo + switches active timer section
- Piece-level milestone timestamps calculated on-the-fly from section `updated_at`

## Database

Already created in `00010_piece_sections.sql`:

- **`piece_videos`** — `id`, `piece_id`, `youtube_video_id`, `title`, `sort_order`
- **`piece_section_timestamps`** — `id`, `section_id`, `video_id`, `start_seconds`, `end_seconds`, `UNIQUE(section_id, video_id)`

Seed data exists for Debussy Trio (`youtube_video_id = 'o2B4B4p7BDg'`) with section timestamps.

## Implementation Steps

### 1. Video Context — `src/components/video/video-context.tsx`

Provider wrapping app (added to `src/app/(app)/layout.tsx` inside MetronomeProvider):
- `videoId`, `setVideoId`, `playerRef`, `currentTime` (polled), `duration`, `isPlaying`
- `seekTo()`, `play()`, `pause()`

### 2. YouTube Player — `src/components/video/youtube-player.tsx`

- Loads YouTube IFrame API script dynamically
- Creates `YT.Player` in a ref
- Collapsible container (shadcn `Collapsible`)
- Polls `getCurrentTime()` on interval to update context
- Responsive aspect ratio embed

### 3. Video Server Actions — `src/app/(app)/repertoire/video-actions.ts`

- `getVideos(pieceId)`, `createVideo(pieceId, youtubeVideoId, title?)`
- `deleteVideo(videoId)`
- `getTimestamps(videoId)`, `upsertTimestamp(sectionId, videoId, startSeconds, endSeconds?)`

### 4. Timestamp Editor — `src/components/repertoire/section-timestamp-editor.tsx`

On piece detail page when videos exist:
- YouTube player (collapsible)
- Table: Section | Start Time | End Time | Mark
- "Mark current time" button reads `playerRef.getCurrentTime()`
- Manual MM:SS input fields
- End times auto-fill from next section's start

### 5. Section Scrubber — `src/components/layout/section-scrubber.tsx`

Renders as conditional second row in `FooterBar`:
- Section-colored horizontal segments, width proportional to duration
- Section labels centered in segments
- Scrubber head showing current video position
- Click segment → seek video + set metronome to practice tempo + switch active section

### 6. Footer Bar Redesign — `src/components/layout/footer-bar.tsx`

- Top row: unchanged (play/stop, elapsed, pills) but metronome moves to scrubber row when scrubber is visible
- Scrubber row: only shown when focused piece has sections + video with timestamps
- MetronomeControl: conditionally rendered in scrubber row or top row

### 7. Layout — `src/app/(app)/layout.tsx`

- Add `VideoProvider` wrapping children

## Files

| File | Action |
|------|--------|
| `src/components/video/video-context.tsx` | New |
| `src/components/video/youtube-player.tsx` | New |
| `src/app/(app)/repertoire/video-actions.ts` | New |
| `src/components/repertoire/section-timestamp-editor.tsx` | New |
| `src/components/layout/section-scrubber.tsx` | New |
| `src/components/layout/footer-bar.tsx` | Modify |
| `src/app/(app)/layout.tsx` | Modify |

## Verification

1. Navigate to Debussy Trio detail page → verify YouTube player loads
2. Mark timestamps for each section → verify they save
3. Focus on piece → verify scrubber bar appears with colored segments
4. Click a section segment → verify video seeks + metronome changes + timer section switches
5. Verify metronome appears in scrubber row (not top row) when scrubber is active
6. Collapse/expand YouTube player → verify it works
