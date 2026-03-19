import { Badge } from "@/components/ui/badge";
import type { PieceStatus } from "@/lib/types";
import { PIECE_STATUS_LABELS } from "@/lib/types";

const statusVariant: Record<PieceStatus, "default" | "secondary" | "outline"> =
  {
    active: "default",
    upcoming: "secondary",
    archived: "outline",
  };

export function StatusBadge({ status }: { status: PieceStatus }) {
  return <Badge variant={statusVariant[status]}>{PIECE_STATUS_LABELS[status]}</Badge>;
}
