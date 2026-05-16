import Link from "next/link";
import type { JournalEntry } from "@/lib/types";

type HistoryEntry = JournalEntry & {
  photos: { id: string; displayUrl: string }[];
};

export function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="font-serif text-muted-foreground italic">
        No entries yet.
      </p>
    );
  }

  return (
    <ul className="space-y-10">
      {entries.map((e) => (
        <li key={e.id}>
          <Link href={`/journal/history/${e.id}`} className="block group">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-xs text-muted-foreground tabular-nums">
                {formatDate(e.entry_date)}
              </span>
              {e.status === "open" && (
                <span className="font-serif text-[10px] uppercase tracking-wider text-muted-foreground">
                  open
                </span>
              )}
            </div>
            <p className="mt-2 font-serif text-2xl leading-tight text-foreground group-hover:underline group-hover:underline-offset-4 group-hover:decoration-foreground/30">
              {displayTitle(e)}
            </p>
            {e.pull_quote && (
              <p className="mt-3 font-serif text-base italic leading-relaxed text-muted-foreground">
                <span className="mr-1 text-muted-foreground/60">“</span>
                {e.pull_quote}
                <span className="ml-0.5 text-muted-foreground/60">”</span>
              </p>
            )}
            {e.photos.length > 0 && (
              <div className="mt-4 flex gap-2">
                {e.photos.slice(0, 3).map((photo) => (
                  <div
                    key={photo.id}
                    className="h-52 min-w-0 flex-1 overflow-hidden rounded-lg bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.displayUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                ))}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function displayTitle(e: JournalEntry): string {
  if (e.title && e.title.trim().length > 0) return e.title;
  if (e.summary && e.summary.trim().length > 0) return e.summary;
  if (e.opening_question && e.opening_question.trim().length > 0) return e.opening_question;
  if (e.status === "open") return "in progress";
  return "untitled";
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
