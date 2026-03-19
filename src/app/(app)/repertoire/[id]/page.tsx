import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PieceDetailHeader } from "@/components/repertoire/piece-detail-header";
import { PieceMasteryControl } from "@/components/repertoire/piece-mastery-control";
import { PieceNotes } from "@/components/repertoire/piece-notes";
import { BookmarkList } from "@/components/repertoire/bookmark-list";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PieceWithBookmarks, Collection } from "@/lib/types";

export default async function PieceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: piece } = await supabase
    .from("pieces")
    .select("*, bookmarks(*)")
    .eq("id", id)
    .single();

  if (!piece) {
    notFound();
  }

  const typedPiece = piece as unknown as PieceWithBookmarks;

  let collection: Collection | null = null;
  if (typedPiece.collection_id) {
    const { data } = await supabase
      .from("collections")
      .select("*")
      .eq("id", typedPiece.collection_id)
      .single();
    collection = data as Collection | null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
      <Link
        href="/repertoire"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to repertoire
      </Link>

      <PieceDetailHeader piece={typedPiece} collection={collection} />

      <div className="mt-6 space-y-6">
        <PieceMasteryControl
          pieceId={typedPiece.id}
          initialLevel={typedPiece.mastery_level}
        />

        <Separator />

        <PieceNotes pieceId={typedPiece.id} initialNotes={typedPiece.notes} />

        <Separator />

        <BookmarkList
          pieceId={typedPiece.id}
          bookmarks={typedPiece.bookmarks ?? []}
        />

        <Separator />

        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm">
              Practice mentions will appear here once the editor is connected.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
