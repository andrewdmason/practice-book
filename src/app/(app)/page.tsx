import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { RepertoireFocusPanel } from "@/components/timer/repertoire-focus-panel";
import { PracticeFeed } from "@/components/feed/practice-feed";
import { ensureTodayEntry, getFeedPage } from "@/app/(app)/feed/actions";
import { createClient } from "@/lib/supabase/server";
import type { PieceSuggestion } from "@/lib/types";

export default async function PracticePage() {
  // Ensure today's entry and sections exist
  await ensureTodayEntry();

  // Fetch initial feed data
  const initialData = await getFeedPage();

  // Fetch pieces for editor mention autocomplete
  const supabase = await createClient();
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
        />
      }
      right={<RepertoireFocusPanel />}
    />
  );
}
