import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PieceDetailHeader } from "@/components/repertoire/piece-detail-header";
import { SectionManager } from "@/components/repertoire/section-manager";
import { SectionTimestampEditor } from "@/components/repertoire/section-timestamp-editor";
import { TaskList } from "@/components/repertoire/task-list";
import dynamic from "next/dynamic";

const PieceCumulativeChart = dynamic(() =>
  import("@/components/repertoire/piece-cumulative-chart").then(
    (m) => m.PieceCumulativeChart
  )
);
import { MentionFeed } from "@/components/repertoire/mention-feed";
import { Separator } from "@/components/ui/separator";
import {
  getPieceFocusData,
  getPieceMentions,
} from "@/app/(app)/focus-panel/actions";
import { getSections } from "@/app/(app)/repertoire/section-actions";
import { getVideos, getTimestamps } from "@/app/(app)/repertoire/video-actions";
import { getPieceCumulativeData } from "@/app/(app)/reports/actions";
import { flattenSections } from "@/lib/section-utils";
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

  const [collection, focusData, mentionPage, cumulativeData, sections, videos] = await Promise.all([
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
    getPieceCumulativeData(id),
    getSections(id),
    getVideos(id),
  ]);

  const videoTimestamps = videos[0]
    ? await getTimestamps(videos[0].id)
    : [];

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
        <SectionManager
          pieceId={typedPiece.id}
          pieceTargetTempo={typedPiece.target_tempo}
          initialSections={sections}
        />

        <SectionTimestampEditor
          pieceId={typedPiece.id}
          sections={flattenSections(sections)}
          initialVideos={videos}
          initialTimestamps={videoTimestamps}
        />

        {(focusData.openTasks.length > 0 || focusData.completedTasks.length > 0) && <Separator />}

        <TaskList initialTasks={[...focusData.openTasks, ...focusData.completedTasks]} />

        <Separator />

        <PieceCumulativeChart data={cumulativeData} />

        <Separator />

        <MentionFeed initialData={mentionPage} loadMore={loadMoreMentions} />
      </div>
    </div>
  );
}
