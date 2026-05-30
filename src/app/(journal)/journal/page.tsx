import { HistoryList } from "@/components/journal/history-list";
import { JournalListDropZone } from "@/components/journal/journal-list-drop-zone";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/journal/auth";
import {
  getEntriesImageGenerationStates,
  getEntriesPhotos,
} from "@/app/(journal)/journal/actions";
import { getUserTimezone, localDate } from "@/lib/date-utils";
import type { JournalEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const { feed } = await searchParams;
  const isFamily = feed === "family";

  const supabase = await createClient();
  const userId = await requireUserId(supabase);

  const columns =
    "id, entry_date, user_id, status, entry_type, visibility, opening_question, freeform_started_at, summary, title, pull_quote, quote_attribution, summary_stale, closed_at, created_at, updated_at";

  // Mine: the caller's own entries (private + family). The entries SELECT policy
  // is "own rows OR visibility = 'family'", so without the user_id filter this
  // query would also pull in *other* members' shared entries — Mine must stay
  // own-only. Family: every member's closed, family-shared entries.
  let query = supabase.from("journal_entries").select(columns);
  query = isFamily
    ? query.eq("visibility", "family").eq("status", "closed")
    : query.eq("user_id", userId);
  const { data } = await query;

  // Newest-first by entry_date — the date shown in the feed — with created_at
  // breaking ties within a day. Done client-side to defend against any
  // chained-order quirks in supabase-js.
  const entries = ((data ?? []) as JournalEntry[]).sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? 1 : -1;
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
  });

  // Author names and avatars for the Family feed (own rows can read every
  // member's name and photos via RLS now). Keyed by user_id; name falls back to
  // email, then a generic label.
  const authorByUser = new Map<string, string>();
  const authorPhotoByUser = new Map<string, string>();
  if (isFamily && entries.length > 0) {
    const { data: members } = await supabase
      .from("journal_members")
      .select("user_id, name, email");
    const emailByUser = new Map<string, string>();
    for (const m of members ?? []) {
      if (!m.user_id) continue;
      authorByUser.set(
        m.user_id as string,
        (m.name as string | null)?.trim() || (m.email as string) || "Family member"
      );
      emailByUser.set(m.user_id as string, m.email as string);
    }

    // Each author's primary profile photo, signed for display.
    const { data: primaryPhotos } = await supabase
      .from("journal_member_photos")
      .select("member_email, storage_path")
      .eq("is_primary", true);
    if (primaryPhotos && primaryPhotos.length > 0) {
      const pathByEmail = new Map<string, string>();
      for (const p of primaryPhotos) {
        pathByEmail.set(p.member_email as string, p.storage_path as string);
      }
      const userEmailPairs = [...emailByUser.entries()].filter(([, email]) =>
        pathByEmail.has(email)
      );
      const paths = userEmailPairs.map(([, email]) => pathByEmail.get(email)!);
      const { data: signed } = await supabase.storage
        .from("member-photos")
        .createSignedUrls(paths, 60 * 60);
      userEmailPairs.forEach(([userId], i) => {
        const url = signed?.[i]?.signedUrl;
        if (url) authorPhotoByUser.set(userId, url);
      });
    }
  }

  const entryIds = entries.map((e) => e.id);
  const [photosByEntry, imageGenerationByEntry, tz] = await Promise.all([
    getEntriesPhotos(entryIds),
    getEntriesImageGenerationStates(entryIds),
    getUserTimezone(),
  ]);
  const today = localDate(new Date(), tz);
  const entriesWithPhotos = entries
    .map((e) => ({
      ...e,
      photos: photosByEntry[e.id] ?? [],
      photoGenerationStatus: imageGenerationByEntry[e.id] ?? null,
      authorName: isFamily
        ? authorByUser.get(e.user_id) ?? "Family member"
        : null,
      authorPhotoUrl: isFamily ? authorPhotoByUser.get(e.user_id) ?? null : null,
    }))
    // Hide abandoned entries: an open entry never started (no opening question
    // picked, no freeform writing) with nothing attached is a row left behind
    // by visiting /journal/new without writing — not a real entry. (Family
    // entries are all closed, so this only affects Mine.)
    .filter(
      (e) =>
        !(
          e.status === "open" &&
          !e.opening_question &&
          !e.freeform_started_at &&
          e.photos.length === 0
        )
    );

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-24 pt-12">
      <JournalListDropZone />
      {!isFamily && (
        <JournalProgressStats entries={entriesWithPhotos} today={today} />
      )}
      <HistoryList
        entries={entriesWithPhotos}
        mode={isFamily ? "family" : "mine"}
        emptyMessage={
          isFamily ? "Nothing shared with the family yet." : "No entries yet."
        }
      />
    </div>
  );
}

function JournalProgressStats({
  entries,
  today,
}: {
  entries: JournalEntry[];
  today: string;
}) {
  const stats = getJournalProgressStats(entries, today);

  return (
    <section
      aria-label="Journal progress"
      className="mb-12 border-y border-border/70 py-4"
    >
      <div className="grid grid-cols-3 gap-4">
        <ProgressStat
          value={
            stats.currentStreak > 0 ? String(stats.currentStreak) : "Start"
          }
          label={
            stats.currentStreak === 1
              ? "day streak"
              : stats.currentStreak > 1
                ? "day streak"
                : "a streak"
          }
          accent={stats.currentStreak > 0}
        />
        <div className="min-w-0 text-center">
          <p className="font-serif text-2xl leading-none tracking-normal text-foreground">
            {stats.daysThisWeek}/7
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            this week
          </p>
          <div
            aria-label={`${stats.daysThisWeek} journal days this week`}
            className="mt-3 flex justify-center gap-1.5"
          >
            {stats.thisWeekDays.map((posted, i) => (
              <span
                key={i}
                className={
                  posted
                    ? "h-1.5 w-1.5 rounded-full bg-primary"
                    : "h-1.5 w-1.5 rounded-full bg-muted-foreground/25"
                }
              />
            ))}
          </div>
        </div>
        <ProgressStat
          value={String(stats.totalEntries)}
          label={stats.totalEntries === 1 ? "memory saved" : "memories saved"}
        />
      </div>
    </section>
  );
}

function ProgressStat({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 text-center">
      <p
        className={
          accent
            ? "font-serif text-2xl leading-none tracking-normal text-primary"
            : "font-serif text-2xl leading-none tracking-normal text-foreground"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function getJournalProgressStats(entries: JournalEntry[], today: string) {
  const entryDates = new Set(entries.map((entry) => entry.entry_date));
  const totalEntries = entries.length;
  const currentStreak = getCurrentStreak(entryDates, today);
  const weekStart = getWeekStart(today);
  const thisWeekDays = Array.from({ length: 7 }, (_, i) =>
    entryDates.has(addDays(weekStart, i))
  );
  const daysThisWeek = thisWeekDays.filter(Boolean).length;

  return {
    currentStreak,
    daysThisWeek,
    thisWeekDays,
    totalEntries,
  };
}

function getCurrentStreak(entryDates: Set<string>, today: string): number {
  let date = entryDates.has(today) ? today : addDays(today, -1);
  let streak = 0;

  while (entryDates.has(date)) {
    streak++;
    date = addDays(date, -1);
  }

  return streak;
}

function getWeekStart(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const diff = (day - 1 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return localDate(d);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
