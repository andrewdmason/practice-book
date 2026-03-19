import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PieceDetailHeader } from "@/components/repertoire/piece-detail-header";
import { PieceMasteryControl } from "@/components/repertoire/piece-mastery-control";
import { TaskList } from "@/components/repertoire/task-list";
import { MentionFeed } from "@/components/repertoire/mention-feed";
import { Separator } from "@/components/ui/separator";
import {
  getPieceFocusData,
  getPieceMentions,
} from "@/app/(app)/focus-panel/actions";
import type { Piece, Collection } from "@/lib/types";

export default async function PieceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: piece } = await supabase
    .from("pieces")
    .select("*")
    .eq("id", id)
    .single();

  if (!piece) {
    notFound();
  }

  const typedPiece = piece as Piece;

  const [collection, focusData, mentionPage] = await Promise.all([
    typedPiece.collection_id
      ? supabase
          .from("collections")
          .select("*")
          .eq("id", typedPiece.collection_id)
          .single()
          .then(({ data }) => data as Collection | null)
      : Promise.resolve(null),
    getPieceFocusData(id),
    getPieceMentions(id),
  ]);

  async function loadMoreMentions(cursor: string) {
    "use server";
    return getPieceMentions(id, cursor);
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

        {focusData.tasks.length > 0 && <Separator />}

        <TaskList initialTasks={focusData.tasks} />

        <Separator />

        <MentionFeed initialData={mentionPage} loadMore={loadMoreMentions} />
      </div>
    </div>
  );
}
