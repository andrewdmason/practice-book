// Enums matching database
export type PieceStatus = "active" | "upcoming" | "archived";
export type TimerCategory = "piece" | "technique" | "sight_reading";

// Database row types
export type Collection = {
  id: string;
  name: string;
  composer: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Piece = {
  id: string;
  collection_id: string | null;
  name: string;
  composer: string | null;
  status: PieceStatus;
  sort_order: number;
  notes: string | null;
  target_tempo: number | null;
  created_at: string;
  updated_at: string;
};

// Timer types
export type PracticeSession = {
  id: string;
  date: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export type TimerEntry = {
  id: string;
  session_id: string;
  piece_id: string | null;
  category: TimerCategory;
  section_id: string | null;
  started_at: string;
  ended_at: string | null;
};

export type TimerTarget =
  | { category: "piece"; pieceId: string; pieceName: string; composer: string | null; sectionId?: string; sectionLabel?: string }
  | { category: "technique" }
  | { category: "sight_reading" };

export type TimeSummaryEntry = {
  category: TimerCategory;
  piece_id: string | null;
  piece_name: string | null;
  total_seconds: number;
};

export type LessonTimeSummary = {
  entries: TimeSummaryEntry[];
  totalSeconds: number;
  dayCount: number;
  calendarDays: number;
};

// Composite types for views
export type CollectionWithPieces = Collection & {
  pieces: Piece[];
};

export type PieceWithLastPlayed = Piece & {
  last_played: string | null;
};

// Label constants
export const PIECE_STATUS_LABELS: Record<PieceStatus, string> = {
  active: "Active",
  upcoming: "Upcoming",
  archived: "Archived",
};

export const PIECE_STATUSES: PieceStatus[] = ["active", "upcoming", "archived"];

// Editor types
export type SourceType = "practice_entry";
export type PracticeEntryType = "practice" | "lesson";
export type EntrySectionCategory = "piece" | "technique" | "sight_reading" | "general";

export type Assignment = {
  id: string;
  source_type: SourceType;
  source_id: string;
  piece_id: string | null;
  text: string;
  progress: number;
  completed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type PracticeTask = {
  id: string;
  piece_id: string;
  section_id: string | null;
  date: string;
  text: string;
  metronome_speed: number | null;
  timer_seconds: number;
  timer_remaining_seconds: number;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PieceSuggestion = {
  id: string;
  name: string;
  composer: string | null;
};

// Report types
export type WeeklyPracticeData = {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekLabel: string; // "Mar 10"
  totalSeconds: number;
};

export type PieceBreakdownData = {
  pieceId: string | null;
  label: string;
  totalSeconds: number;
  category: TimerCategory;
};

export type StreakData = {
  currentStreak: number;
  daysPracticedThisWeek: number;
  thisWeekDays: boolean[]; // Mon-Sun
};

export type PieceWeeklyCumulativeData = {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekLabel: string; // "Mar 10"
  weekSeconds: number;
  cumulativeSeconds: number;
  completionPct?: number; // 0-100, % of sections fully complete
};

export type PieceOption = {
  id: string;
  name: string;
  composer: string | null;
};

export type CompletedAssignmentMarker = {
  weekStart: string;
  weekLabel: string;
  cumulativeHours: number;
  assignments: { id: string; text: string; completedAt: string }[];
};

// Search types
export type SearchResultType =
  | "piece"
  | "collection"
  | "practice_entry"
  | "lesson";

export type SearchResult = {
  result_type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  preview: string | null;
  date: string | null;
  url: string;
  rank: number;
};

export type TypeaheadResult = {
  id: string;
  name: string;
  composer: string | null;
  type: "piece" | "collection";
  url: string;
};

// Focus panel types
export type StatusChange = {
  sectionLabel: string;
  oldStatus: SectionStatus;
  newStatus: SectionStatus;
};

export type RepertoireOverviewItem = {
  id: string;
  name: string;
  composer: string | null;
  last_played: string | null;
  open_assignments: number;
};

// Feed types
export type PracticeEntrySection = {
  id: string;
  practice_entry_id: string;
  piece_id: string | null;
  category: EntrySectionCategory;
  content: unknown;
  sort_order: number;
  piece_name?: string | null;
  composer?: string | null;
};

export type FeedPracticeEntry = {
  id: string;
  date: string;
  type: PracticeEntryType;
  sections: PracticeEntrySection[];
};

export type FeedDay = {
  date: string;
  practiceEntry: FeedPracticeEntry | null;
  lessons: FeedPracticeEntry[];
  timeSummary: TimeSummaryEntry[];
  lessonTimeSummaries?: Record<string, LessonTimeSummary>;
  /** Status changes grouped by piece_id for this date */
  statusChangesByPiece?: Record<string, StatusChange[]>;
};

// Piece section types
export type SectionStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const SECTION_STATUS_PERCENTAGE: Record<SectionStatus, number> = {
  0: 0,
  1: 0.4,
  2: 0.5,
  3: 0.6,
  4: 0.7,
  5: 0.8,
  6: 0.9,
  7: 1,
  8: 1,
};

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  0: "Not started",
  1: "40% target tempo",
  2: "50% target tempo",
  3: "60% target tempo",
  4: "70% target tempo",
  5: "80% target tempo",
  6: "90% target tempo",
  7: "100% target tempo",
  8: "Complete",
};

export const SECTION_STATUS_COLORS: Record<SectionStatus, string> = {
  0: "bg-white dark:bg-muted",
  1: "bg-[#D6E4F0]",
  2: "bg-[#B8D4F0]",
  3: "bg-[#94BDE8]",
  4: "bg-[#6FA3DE]",
  5: "bg-[#4D8AD4]",
  6: "bg-[#3070C4]",
  7: "bg-[#1A56B0]",
  8: "bg-[#22C55E]",
};

export const SECTION_STATUS_DOT_COLORS: Record<SectionStatus, string> = {
  0: "text-muted-foreground",
  1: "text-[#D6E4F0]",
  2: "text-[#B8D4F0]",
  3: "text-[#94BDE8]",
  4: "text-[#6FA3DE]",
  5: "text-[#4D8AD4]",
  6: "text-[#3070C4]",
  7: "text-[#1A56B0]",
  8: "text-[#22C55E]",
};

export const SECTION_STATUS_HEX_COLORS: Record<SectionStatus, string> = {
  0: "#E5E7EB",
  1: "#D6E4F0",
  2: "#B8D4F0",
  3: "#94BDE8",
  4: "#6FA3DE",
  5: "#4D8AD4",
  6: "#3070C4",
  7: "#1A56B0",
  8: "#22C55E",
};

export type SectionStatusSnapshot = {
  id: string;
  piece_id: string;
  section_id: string;
  old_status: SectionStatus;
  new_status: SectionStatus;
  snapshot_date: string;
  created_at: string;
  updated_at: string;
};

export type PieceSection = {
  id: string;
  piece_id: string;
  parent_id: string | null;
  label: string;
  sort_order: number;
  status: SectionStatus;
  target_tempo: number | null;
  created_at: string;
  updated_at: string;
};

export type PieceSectionWithChildren = PieceSection & {
  children: PieceSection[];
};

export type PieceVideo = {
  id: string;
  piece_id: string;
  youtube_video_id: string;
  title: string | null;
  sort_order: number;
  start_seconds: number | null;
  end_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type PieceSectionTimestamp = {
  id: string;
  section_id: string;
  video_id: string;
  start_seconds: number;
  end_seconds: number | null;
  created_at: string;
  updated_at: string;
};
