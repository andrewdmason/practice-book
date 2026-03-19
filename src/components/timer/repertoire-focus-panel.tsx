"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLinkIcon, MusicIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MasteryBadge } from "@/components/repertoire/mastery-badge";
import { useTimer } from "@/components/timer/timer-context";
import { TimeSummary } from "@/components/timer/time-summary";
import { getTodaySummary } from "@/app/(app)/timer/actions";
import { createClient } from "@/lib/supabase/client";
import { TIMER_CATEGORY_LABELS } from "@/lib/timer-utils";
import type { Bookmark, TimeSummaryEntry } from "@/lib/types";

export function RepertoireFocusPanel() {
  const { isRunning, currentTarget } = useTimer();

  if (currentTarget?.category === "piece") {
    return <PieceDetail pieceId={currentTarget.pieceId} />;
  }

  return <PracticeOverview isRunning={isRunning} currentCategory={currentTarget?.category ?? null} />;
}

function PieceDetail({ pieceId }: { pieceId: string }) {
  const [piece, setPiece] = useState<{
    name: string;
    composer: string | null;
    mastery_level: string;
    bookmarks: Bookmark[];
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("pieces")
      .select("name, composer, mastery_level, bookmarks(*)")
      .eq("id", pieceId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPiece({
            name: data.name,
            composer: data.composer,
            mastery_level: data.mastery_level,
            bookmarks: (data.bookmarks as Bookmark[]) ?? [],
          });
        }
      });
  }, [pieceId]);

  if (!piece) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{piece.name}</CardTitle>
            {piece.composer && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {piece.composer}
              </p>
            )}
          </div>
          <MasteryBadge level={piece.mastery_level as "learning" | "playable" | "performance_ready" | "memorized"} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {piece.bookmarks.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Bookmarks
            </h4>
            <div className="space-y-1">
              {piece.bookmarks.map((bk) => (
                <div key={bk.id} className="flex items-center justify-between text-sm">
                  <span>{bk.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {bk.measure_end
                      ? `mm. ${bk.measure_start}\u2013${bk.measure_end}`
                      : `m. ${bk.measure_start}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          href={`/repertoire/${pieceId}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLinkIcon className="size-3" />
          View full page
        </Link>
      </CardContent>
    </Card>
  );
}

function PracticeOverview({
  isRunning,
  currentCategory,
}: {
  isRunning: boolean;
  currentCategory: string | null;
}) {
  const [summary, setSummary] = useState<TimeSummaryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTodaySummary().then((entries) => {
      setSummary(entries);
      setLoaded(true);
    });
  }, [isRunning]);

  if (isRunning && currentCategory) {
    const label = TIMER_CATEGORY_LABELS[currentCategory] ?? currentCategory;
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MusicIcon className="size-4" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loaded && summary.length > 0 && <TimeSummary entries={summary} />}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Practice</CardTitle>
      </CardHeader>
      <CardContent>
        {loaded && summary.length > 0 ? (
          <TimeSummary entries={summary} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {loaded
              ? "No practice recorded today. Select a piece to begin."
              : "Loading..."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
