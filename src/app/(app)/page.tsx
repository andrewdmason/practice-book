import { PracticeTable } from "@/components/practice-table/practice-table";
import { RepertoireFocusPanel } from "@/components/timer/repertoire-focus-panel";
import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { getFeedPage } from "@/app/(app)/feed/actions";
import type { PracticeTaskType } from "@/lib/types";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const typeFilter: PracticeTaskType | undefined =
    typeParam === "practice" || typeParam === "lesson" ? typeParam : undefined;

  const initialData = await getFeedPage(undefined, 7, typeFilter);

  return (
    <TwoColumnLayout
      left={<PracticeTable initialData={initialData} typeFilter={typeFilter} />}
      right={<RepertoireFocusPanel />}
    />
  );
}
