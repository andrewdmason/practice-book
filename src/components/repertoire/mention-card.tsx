import Link from "next/link";
import { BookOpenIcon, MusicIcon } from "lucide-react";
import type { MentionWithSource } from "@/lib/types";

export function MentionCard({ mention }: { mention: MentionWithSource }) {
  const href =
    mention.source_type === "lesson"
      ? `/lessons/${mention.source_id}`
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
          {mention.source_type === "lesson" ? (
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
    </Link>
  );
}
