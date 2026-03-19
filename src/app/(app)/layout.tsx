import { Header } from "@/components/layout/header";
import { FooterBar } from "@/components/layout/footer-bar";
import { TimerProvider } from "@/components/timer/timer-context";
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
    .order("name");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <TimerProvider activePieces={(activePieces as Piece[]) ?? []}>
        <div className="flex flex-1 flex-col">{children}</div>
        <FooterBar />
      </TimerProvider>
    </div>
  );
}
