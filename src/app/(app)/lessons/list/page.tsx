import { LessonsList } from "@/components/lessons/lessons-list";
import { RepertoireFocusPanel } from "@/components/timer/repertoire-focus-panel";
import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { getLessonsByDate } from "@/app/(app)/lessons/actions";

export default async function LessonsListPage() {
  const initialData = await getLessonsByDate();

  return (
    <TwoColumnLayout
      left={<LessonsList initialData={initialData} />}
      right={<RepertoireFocusPanel />}
    />
  );
}
