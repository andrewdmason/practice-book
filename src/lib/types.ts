// Enums matching database
export type PieceStatus = "active" | "upcoming" | "archived";
export type MasteryLevel =
  | "learning"
  | "playable"
  | "performance_ready"
  | "memorized";

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

// Composite types for views
export type PieceWithBookmarks = Piece & {
  bookmarks: Bookmark[];
};

export type CollectionWithPieces = Collection & {
  pieces: Piece[];
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
