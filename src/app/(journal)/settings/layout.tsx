import { SettingsNav } from "@/components/journal/settings-nav";
import { LogoutButton } from "@/components/journal/logout-button";
import { createClient } from "@/lib/supabase/server";
import { getIsOwner } from "@/lib/journal/auth";
import type { JournalAgentFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const isOwner = await getIsOwner(supabase);
  const { data } = await supabase
    .from("journal_agent_files")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false });
  const recentEdits = ((data ?? []) as Pick<
    JournalAgentFile,
    "id" | "name" | "updated_at"
  >[]).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-24 pt-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_240px]">
        <div>
          <SettingsNav isOwner={isOwner} />
          {children}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="font-serif text-sm uppercase tracking-wide text-muted-foreground">
            Recent file edits
          </h2>
          <ul className="mt-3 space-y-3">
            {recentEdits.map((f) => (
              <li key={f.id} className="font-serif text-sm">
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {f.updated_at.slice(0, 10)}
                </span>
                <span className="text-foreground">{f.name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 font-serif text-xs italic text-muted-foreground">
            Edits you make here, or accept from a suggestion, update these
            timestamps.
          </p>

          <div className="mt-8 border-t border-border pt-6">
            <LogoutButton />
          </div>
        </aside>
      </div>
    </div>
  );
}
