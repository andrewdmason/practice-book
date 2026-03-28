import { Header } from "@/components/layout/header";
import { FooterBar } from "@/components/layout/footer-bar";
import { TimerProvider } from "@/components/timer/timer-context";
import { MetronomeProvider } from "@/components/metronome/metronome-context";
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
    .select("*")
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
            <TimerProvider activePieces={(activePieces as Piece[]) ?? []}>
              <FooterBar />
              <div className="flex flex-1 flex-col">{children}</div>
            </TimerProvider>
          </div>
        </TooltipProvider>
      </MetronomeProvider>
    </SearchProvider>
  );
}
