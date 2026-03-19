import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MasteryBadge } from "@/components/repertoire/mastery-badge";
import { TaskList } from "@/components/repertoire/task-list";
import { MentionFeed } from "@/components/repertoire/mention-feed";
import { Separator } from "@/components/ui/separator";
import {
  getCollectionFocusData,
  getCollectionMentions,
} from "@/app/(app)/repertoire/actions";
import type { Collection, Piece, MasteryLevel } from "@/lib/types";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single();

  if (!collection) {
    notFound();
  }

  const typedCollection = collection as Collection;

  const [{ data: rawPieces }, focusData, mentionPage] = await Promise.all([
    supabase
      .from("pieces")
      .select("*")
      .eq("collection_id", id)
      .order("name"),
    getCollectionFocusData(id),
    getCollectionMentions(id),
  ]);

  const pieces = (rawPieces ?? []) as Piece[];

  async function loadMoreMentions(cursor: string) {
    "use server";
    return getCollectionMentions(id, cursor);
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

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold">
          {typedCollection.name}
        </h1>
        {typedCollection.composer && (
          <p className="text-muted-foreground mt-1">
            {typedCollection.composer}
          </p>
        )}
      </div>

      <div className="space-y-6">
        {/* Child pieces */}
        {pieces.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Pieces ({pieces.length})
            </h3>
            <div className="space-y-1">
              {pieces.map((piece) => (
                <Link
                  key={piece.id}
                  href={`/repertoire/${piece.id}`}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{piece.name}</p>
                    {piece.composer && (
                      <p className="text-xs text-muted-foreground truncate">
                        {piece.composer}
                      </p>
                    )}
                  </div>
                  <MasteryBadge
                    level={piece.mastery_level as MasteryLevel}
                    size="sm"
                  />
                </Link>
              ))}
            </div>
          </div>
        )}

        {focusData.tasks.length > 0 && <Separator />}

        <TaskList initialTasks={focusData.tasks} />

        <Separator />

        <MentionFeed initialData={mentionPage} loadMore={loadMoreMentions} />
      </div>
    </div>
  );
}
