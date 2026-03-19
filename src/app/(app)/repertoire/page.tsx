import { createClient } from "@/lib/supabase/server";
import { RepertoireList } from "@/components/repertoire/repertoire-list";
import type { Piece, CollectionWithPieces } from "@/lib/types";

export default async function RepertoirePage() {
  const supabase = await createClient();

  const [{ data: pieces }, { data: collections }] = await Promise.all([
    supabase.from("pieces").select("*").order("name"),
    supabase.from("collections").select("*, pieces(*)").order("name"),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <RepertoireList
        pieces={(pieces as Piece[]) ?? []}
        collections={(collections as CollectionWithPieces[]) ?? []}
      />
    </div>
  );
}
