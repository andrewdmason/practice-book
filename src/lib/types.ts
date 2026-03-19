// Enums matching database
export type PieceStatus = "active" | "upcoming" | "archived";
export type MasteryLevel =
  | "learning"
  | "playable"
  | "performance_ready"
  | "memorized";
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
  mastery_level: MasteryLevel;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Bookmark = {
  id: string;
  piece_id: string;
  name: string;
  measure_start: number;
  measure_end: number | null;
  created_at: string;
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
  started_at: string;
  ended_at: string | null;
};

export type TimerTarget =
  | { category: "piece"; pieceId: string; pieceName: string; composer: string | null }
  | { category: "technique" }
  | { category: "sight_reading" };

export type TimeSummaryEntry = {
  category: TimerCategory;
  piece_id: string | null;
  piece_name: string | null;
  total_seconds: number;
};

// Composite types for views
export type PieceWithBookmarks = Piece & {
  bookmarks: Bookmark[];
};

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

export const MASTERY_LEVEL_LABELS: Record<MasteryLevel, string> = {
  learning: "Learning",
  playable: "Playable",
  performance_ready: "Performance Ready",
  memorized: "Memorized",
};

export const PIECE_STATUSES: PieceStatus[] = ["active", "upcoming", "archived"];
export const MASTERY_LEVELS: MasteryLevel[] = [
  "learning",
  "playable",
  "performance_ready",
  "memorized",
];

// Editor types
export type SourceType = "practice_entry" | "lesson";
export type EntrySectionCategory = "piece" | "technique" | "sight_reading" | "general";

export type Mention = {
  id: string;
  piece_id: string;
  source_type: SourceType;
  source_id: string;
  context_snippet: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  source_type: SourceType;
  source_id: string;
  piece_id: string | null;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  lesson_id: string;
  piece_id: string | null;
  text: string;
  content: unknown;
  completed: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type PieceSuggestion = {
  id: string;
  name: string;
  composer: string | null;
};

// Focus panel types
export type MentionWithSource = Mention & {
  source_date: string;
  source_label: string;
};

export type RepertoireOverviewItem = {
  id: string;
  name: string;
  composer: string | null;
  mastery_level: MasteryLevel;
  last_played: string | null;
  open_tasks: number;
  open_goals: number;
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
  sections: PracticeEntrySection[];
};

export type FeedLesson = {
  id: string;
  date: string;
  content: unknown;
};

export type FeedDay = {
  date: string;
  practiceEntry: FeedPracticeEntry | null;
  lessons: FeedLesson[];
  timeSummary: TimeSummaryEntry[];
};
