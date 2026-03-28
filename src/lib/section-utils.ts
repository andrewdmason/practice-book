import type {
  PieceSectionWithChildren,
  PieceSection,
  SectionStatus,
} from "@/lib/types";
import { SECTION_STATUS_PERCENTAGE } from "@/lib/types";

/** Calculate practice tempo from status and effective target tempo */
export function practiceTempo(
  status: SectionStatus,
  effectiveTempo: number | null
): number | null {
  if (status === 0 || !effectiveTempo) return null;
  return Math.round(SECTION_STATUS_PERCENTAGE[status] * effectiveTempo);
}

/** Flatten sections + children into a single ordered list (leaf sections only) */
export function flattenSections(
  sections: PieceSectionWithChildren[]
): PieceSection[] {
  const flat: PieceSection[] = [];
  for (const section of sections) {
    if (section.children.length === 0) {
      flat.push(section);
    } else {
      for (const child of section.children) {
        flat.push(child);
      }
    }
  }
  return flat;
}
