import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, MusicIcon } from "lucide-react";
import type { MentionWithSource } from "@/lib/types";
import { SECTION_STATUS_COLORS } from "@/lib/types";

export function MentionCard({ mention }: { mention: MentionWithSource }) {
  const isLesson = mention.source_label === "Lesson";
  const href = isLesson
    ? `/?date=${mention.source_date}`
    : `/`;

  const date = new Date(mention.source_date + "T00:00:00");
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={href}
      className="block rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {isLesson ? (
            <BookOpenIcon className="size-3" />
          ) : (
            <MusicIcon className="size-3" />
          )}
          {mention.source_label}
        </span>
        <span className="text-xs text-muted-foreground">&middot;</span>
        <span className="text-xs text-muted-foreground">{formatted}</span>
      </div>
      {mention.context_snippet && (
        <p className="text-sm text-foreground leading-relaxed">
          &ldquo;{mention.context_snippet}&rdquo;
        </p>
      )}
      {mention.statusChanges && mention.statusChanges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {mention.statusChanges.map((change) => (
            <span
              key={change.sectionLabel}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            >
              <span className="font-medium text-foreground">
                {change.sectionLabel}
              </span>
              <span
                className={`inline-block size-2.5 rounded-sm ${SECTION_STATUS_COLORS[change.oldStatus]}`}
              />
              <ArrowRightIcon className="size-2.5" />
              <span
                className={`inline-block size-2.5 rounded-sm ${SECTION_STATUS_COLORS[change.newStatus]}`}
              />
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
