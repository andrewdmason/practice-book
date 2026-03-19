import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusIcon, BookMarkedIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { createLesson } from "@/app/(app)/feed/actions";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function LessonsPage() {
  const supabase = await createClient();

  const { data: lessons } = await supabase
    .from("practice_entries")
    .select("id, date")
    .eq("type", "lesson")
    .order("date", { ascending: false });

  async function handleNewLesson() {
    "use server";
    const id = await createLesson();
    redirect(`/lessons/${id}`);
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Lessons</h2>
        <form action={handleNewLesson}>
          <Button variant="outline" size="sm" type="submit">
            <PlusIcon className="size-4" />
            New Lesson
          </Button>
        </form>
      </div>

      {!lessons || lessons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No lessons yet. Click &ldquo;New Lesson&rdquo; to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <Link key={lesson.id} href={`/lessons/${lesson.id}`}>
              <Card className="border-l-4 border-l-primary/50 transition-colors hover:bg-muted/30">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <BookMarkedIcon className="size-4 text-primary/70 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {formatDate(lesson.date)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          Lesson
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
