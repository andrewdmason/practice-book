import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { RepertoireFocusPanel } from "@/components/timer/repertoire-focus-panel";
import { PracticeFeed } from "@/components/feed/practice-feed";
import { ensureTodayEntry, getFeedPage } from "@/app/(app)/feed/actions";
import { createClient } from "@/lib/supabase/server";
import type { PieceSuggestion, PracticeEntryType } from "@/lib/types";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const typeFilter: PracticeEntryType | undefined =
    typeParam === "practice" || typeParam === "lesson" ? typeParam : undefined;

  // Ensure today's entry and sections exist
  await ensureTodayEntry();

  // Fetch initial feed data in parallel
  const [initialData, supabase] = await Promise.all([
    getFeedPage(undefined, 7, typeFilter),
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
          key={typeFilter ?? "all"}
          initialData={initialData}
          pieces={(pieces as PieceSuggestion[]) ?? []}
          typeFilter={typeFilter}
        />
      }
      right={<RepertoireFocusPanel />}
    />
  );
}
