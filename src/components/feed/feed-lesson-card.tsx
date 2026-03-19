"use client";

import Link from "next/link";
import { BookMarkedIcon, ArrowRightIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FeedLesson } from "@/lib/types";

function getContentPreview(content: unknown): string {
  if (!content) return "Empty lesson";
  const doc = content as { content?: Array<{ content?: Array<{ text?: string }> }> };
  if (!doc.content) return "Empty lesson";

  const texts: string[] = [];
  for (const node of doc.content) {
    if (node.content) {
      for (const inline of node.content) {
        if (inline.text) texts.push(inline.text);
      }
    }
    if (texts.join(" ").length > 120) break;
  }

  const preview = texts.join(" ").slice(0, 120);
  return preview || "Empty lesson";
}

export function FeedLessonCard({ lesson }: { lesson: FeedLesson }) {
  const preview = getContentPreview(lesson.content);

  return (
    <Link href={`/lessons/${lesson.id}`}>
      <Card className="border-l-4 border-l-primary/50 transition-colors hover:bg-muted/30">
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <BookMarkedIcon className="size-4 text-primary/70" />
                <Badge variant="secondary" className="text-xs">
                  Lesson
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {preview}
              </p>
            </div>
            <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
