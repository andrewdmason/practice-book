import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { RepertoireFocusPanel } from "@/components/timer/repertoire-focus-panel";
import { PracticeFeed } from "@/components/feed/practice-feed";
import { ensureTodayEntry, getFeedPage } from "@/app/(app)/feed/actions";
import { getStreakData } from "@/app/(app)/reports/actions";
import { createClient } from "@/lib/supabase/server";
import type { PieceSuggestion } from "@/lib/types";

export default async function PracticePage() {
  // Ensure today's entry and sections exist
  await ensureTodayEntry();

  // Fetch initial feed data + streak in parallel
  const [initialData, streakData, supabase] = await Promise.all([
    getFeedPage(),
    getStreakData(),
    createClient(),
  ]);

  // Fetch pieces for editor mention autocomplete
  const { data: pieces } = await supabase
    .from("pieces")
    .select("id, name, composer")
    .eq("status", "active")
    .order("name");

  return (
    <TwoColumnLayout
      left={
        <PracticeFeed
          initialData={initialData}
          pieces={(pieces as PieceSuggestion[]) ?? []}
          streak={streakData}
        />
      }
      right={<RepertoireFocusPanel />}
    />
  );
}
