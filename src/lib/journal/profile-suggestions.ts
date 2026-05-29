import { createClient } from "@/lib/supabase/server";
import type { JournalProfileSuggestionChangeType } from "@/lib/types";

export type UserFileChange = {
  change_type: JournalProfileSuggestionChangeType;
  find: string | null;
  replace: string | null;
};

export type ApplyResult =
  | { ok: true; before: string; after: string }
  | { ok: false; error: string };

/**
 * Apply a single proposed change to the `User` profile doc in
 * `journal_agent_files`. For edit/remove, `find` must match exactly once.
 *
 *  - `add`    → append `replace` to the end (leading newline if needed)
 *  - `edit`   → replace the single occurrence of `find` with `replace`
 *  - `remove` → excise the single occurrence of `find`, tidying blank lines
 */
export async function applyUserFileChange(change: UserFileChange): Promise<ApplyResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_agent_files")
    .select("id, content")
    .eq("name", "User")
    .single();
  if (error || !data) {
    return { ok: false, error: `User file not found: ${error?.message ?? "missing"}` };
  }

  const before = data.content ?? "";
  let after: string;

  if (change.change_type === "add") {
    const text = change.replace ?? "";
    if (text.length === 0) return { ok: false, error: "Nothing to add." };
    const sep = before.length === 0 || before.endsWith("\n") ? "" : "\n";
    after = before + sep + text + (text.endsWith("\n") ? "" : "\n");
  } else {
    const find = change.find ?? "";
    if (find.length === 0) {
      return { ok: false, error: "`find` must not be empty." };
    }
    const first = before.indexOf(find);
    if (first === -1) {
      return {
        ok: false,
        error: "The text to change is no longer in your profile — it may have already been edited.",
      };
    }
    const second = before.indexOf(find, first + find.length);
    if (second !== -1) {
      return { ok: false, error: "The text to change appears more than once and is ambiguous." };
    }
    if (change.change_type === "edit") {
      after = before.slice(0, first) + (change.replace ?? "") + before.slice(first + find.length);
    } else {
      // remove: excise the match, then collapse a doubled blank line / trailing
      // whitespace left behind so the doc doesn't accumulate gaps.
      const excised = before.slice(0, first) + before.slice(first + find.length);
      after = excised.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
    }
  }

  const { error: writeErr } = await supabase
    .from("journal_agent_files")
    .update({ content: after })
    .eq("id", data.id);
  if (writeErr) return { ok: false, error: writeErr.message };

  return { ok: true, before, after };
}
