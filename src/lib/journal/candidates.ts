import type { JournalOpeningCandidate } from "@/lib/types";

/**
 * Coerce a stored `opening_candidates` value into the current object shape.
 * Tolerates legacy rows that stored a plain string[] (no type labels).
 * Client-safe — no server imports — so the picker and server code can share it.
 */
export function normalizeCandidates(raw: unknown): JournalOpeningCandidate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c): JournalOpeningCandidate => {
      if (typeof c === "string") return { text: c, type: null };
      const obj = (c ?? {}) as { text?: unknown; type?: unknown };
      return {
        text: typeof obj.text === "string" ? obj.text : "",
        type: typeof obj.type === "string" ? obj.type : null,
      };
    })
    .filter((c) => c.text.length > 0);
}

/** Just the question texts, for skip/avoid lists. */
export function candidateTexts(raw: unknown): string[] {
  return normalizeCandidates(raw).map((c) => c.text);
}

/** A human label from a kebab-case type name (e.g. "recent-calendar" → "Recent calendar"). */
export function typeLabel(type: string | null): string | null {
  if (!type) return null;
  const s = type.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
