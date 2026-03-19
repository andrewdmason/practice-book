import { createClient } from "@/lib/supabase/server";
import { RepertoireList } from "@/components/repertoire/repertoire-list";
import { getPiecesWithLastPlayed } from "@/app/(app)/timer/actions";
import type { Piece, CollectionWithPieces } from "@/lib/types";

const STALE_THRESHOLD_DAYS = 14;

export default async function RepertoirePage() {
  const supabase = await createClient();

  const [{ data: pieces }, { data: collections }, piecesWithLastPlayed] =
    await Promise.all([
      supabase.from("pieces").select("*").order("name"),
      supabase.from("collections").select("*, pieces(*)").order("name"),
      getPiecesWithLastPlayed(),
    ]);

  const stalePieces = piecesWithLastPlayed.filter((p) => {
    if (!p.last_played) return true;
    const daysSince = Math.floor(
      (Date.now() - new Date(p.last_played).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince >= STALE_THRESHOLD_DAYS;
  });

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <RepertoireList
        pieces={(pieces as Piece[]) ?? []}
        collections={(collections as CollectionWithPieces[]) ?? []}
        stalePieces={stalePieces}
      />
    </div>
  );
}
