import { createClient } from "@/lib/supabase/server";
import type { CalendarSource } from "./types";

type Row = {
  id: string;
  display_name: string;
  feed_url: string;
};

export async function loadCalendarSources(): Promise<CalendarSource[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_calendar_sources")
    .select("id, display_name, feed_url")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    feedUrl: row.feed_url,
  }));
}
