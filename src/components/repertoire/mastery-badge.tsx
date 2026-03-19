import { Badge } from "@/components/ui/badge";
import type { MasteryLevel } from "@/lib/types";
import { MASTERY_LEVEL_LABELS } from "@/lib/types";

const masteryClasses: Record<MasteryLevel, string> = {
  learning:
    "bg-amber-100 text-amber-800 border-amber-200",
  playable:
    "bg-emerald-50 text-emerald-700 border-emerald-200",
  performance_ready:
    "bg-sky-50 text-sky-700 border-sky-200",
  memorized:
    "bg-primary/10 text-primary border-primary/20",
};

export function MasteryBadge({
  level,
  size = "default",
}: {
  level: MasteryLevel;
  size?: "default" | "sm";
}) {
  return (
    <Badge
      variant="outline"
      className={`${masteryClasses[level]} ${size === "sm" ? "text-[10px] px-1.5 py-0" : ""}`}
    >
      {MASTERY_LEVEL_LABELS[level]}
    </Badge>
  );
}
