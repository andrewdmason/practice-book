import { Header } from "@/components/layout/header";
import { TransportBar } from "@/components/layout/transport-bar";
import { MetronomeProvider } from "@/components/metronome/metronome-context";
import { TaskTimerProvider } from "@/components/timer/task-timer-context";
import { VideoProvider } from "@/components/video/video-context";
import { SearchProvider } from "@/components/search/search-provider";
import { TimezoneProvider } from "@/components/timezone-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/server";
import { getTodaySummary } from "@/app/(app)/timer/actions";
import type { Piece } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const [{ data: activePieces }, { data: collections }, todaySummary] =
    await Promise.all([
      supabase
        .from("pieces")
        .select(
          "id, collection_id, name, composer, status, kind, sort_order, notes, target_tempo, created_at, updated_at"
        )
        .eq("status", "active")
        .order("sort_order")
        .order("name"),
      supabase.from("collections").select("id, name"),
      getTodaySummary(),
    ]);

  const collectionsById: Record<string, string> = {};
  for (const c of collections ?? []) collectionsById[c.id] = c.name;

  const initialDailySeconds = todaySummary.reduce(
    (sum, e) => sum + e.total_seconds,
    0
  );

  return (
    <SearchProvider>
      <MetronomeProvider>
        <TooltipProvider>
          <TimezoneProvider />
          <div className="flex min-h-full flex-1 flex-col">
            <VideoProvider>
              <TaskTimerProvider
                activePieces={(activePieces as Piece[]) ?? []}
                collectionsById={collectionsById}
                initialDailySeconds={initialDailySeconds}
              >
                <Header />
                <div className="flex flex-1 flex-col">{children}</div>
                <TransportBar />
              </TaskTimerProvider>
            </VideoProvider>
          </div>
        </TooltipProvider>
      </MetronomeProvider>
    </SearchProvider>
  );
}
