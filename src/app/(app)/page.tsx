import { PracticeTable } from "@/components/practice-table/practice-table";
import { RepertoireFocusPanel } from "@/components/timer/repertoire-focus-panel";
import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { getFeedPage } from "@/app/(app)/feed/actions";

export default async function FeedPage() {
  const initialData = await getFeedPage();

  return (
    <TwoColumnLayout
      left={<PracticeTable initialData={initialData} />}
      right={<RepertoireFocusPanel />}
    />
  );
}
