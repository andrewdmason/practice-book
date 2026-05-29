import { PracticeTable } from "@/components/practice-table/practice-table";
import { RepertoireFocusPanel } from "@/components/timer/repertoire-focus-panel";
import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { PracticeLogHeader } from "@/components/layout/practice-log-header";
import { getFeedPage } from "@/app/practice/feed/actions";

export default async function FeedPage() {
  const initialData = await getFeedPage();

  return (
    <>
      <PracticeLogHeader />
      <TwoColumnLayout
        left={<PracticeTable initialData={initialData} />}
        right={<RepertoireFocusPanel />}
      />
    </>
  );
}
