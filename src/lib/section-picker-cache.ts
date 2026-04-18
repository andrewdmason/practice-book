import { getSectionPickerData } from "@/app/(app)/timer/task-actions";
import type { PieceSection } from "@/lib/types";

export type SectionPickerData = {
  sections: PieceSection[];
  pieceTargetTempo: number | null;
};

const cache = new Map<string, SectionPickerData>();
const inflight = new Map<string, Promise<SectionPickerData>>();

export function getCachedSectionPickerData(
  pieceId: string
): SectionPickerData | null {
  return cache.get(pieceId) ?? null;
}

export function loadSectionPickerData(
  pieceId: string
): Promise<SectionPickerData> {
  const cached = cache.get(pieceId);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(pieceId);
  if (existing) return existing;
  const p = getSectionPickerData(pieceId)
    .then((data) => {
      cache.set(pieceId, data);
      return data;
    })
    .finally(() => {
      inflight.delete(pieceId);
    });
  inflight.set(pieceId, p);
  return p;
}
