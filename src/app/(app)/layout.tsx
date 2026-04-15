import { Header } from "@/components/layout/header";
import { FooterBar } from "@/components/layout/footer-bar";
import { ScrubberBar } from "@/components/layout/scrubber-bar";
import { TimerProvider } from "@/components/timer/timer-context";
import { MetronomeProvider } from "@/components/metronome/metronome-context";
import { TaskTimerProvider } from "@/components/timer/task-timer-context";
import { VideoProvider } from "@/components/video/video-context";
import { SearchProvider } from "@/components/search/search-provider";
import { TimezoneProvider } from "@/components/timezone-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/server";
import type { Piece } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: activePieces } = await supabase
    .from("pieces")
    .select("id, collection_id, name, composer, status, sort_order, notes, target_tempo, created_at, updated_at")
    .eq("status", "active")
    .order("sort_order")
    .order("name");

  return (
    <SearchProvider>
      <MetronomeProvider>
        <TooltipProvider>
          <TimezoneProvider />
          <div className="flex min-h-full flex-1 flex-col">
            <Header />
            <VideoProvider>
              <TimerProvider activePieces={(activePieces as Piece[]) ?? []}>
                <TaskTimerProvider>
                  <FooterBar />
                  <ScrubberBar />
                  <div className="flex flex-1 flex-col">{children}</div>
                </TaskTimerProvider>
              </TimerProvider>
            </VideoProvider>
          </div>
        </TooltipProvider>
      </MetronomeProvider>
    </SearchProvider>
  );
}
