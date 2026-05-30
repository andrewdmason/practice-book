// Seeds photos onto the journal entries from seeds/05_journal_entries.sql.
//
// Storage objects can't be created by the SQL `db reset` seed, so this runs
// separately. Images are pulled from Lorem Picsum (a stable, key-free public
// source) so the seed is reproducible without committing binaries.
//
// Usage: run after `npx supabase db reset --local`
//   npm run seed:photos

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "journal-photos";

// Each journal entry (from seeds/05_journal_entries.sql) and the photos to
// attach. `seed` makes the Picsum image deterministic.
const ENTRIES = [
  {
    id: "f0000001-0001-4001-8001-000000000001", // Morning light
    photos: [
      { seed: "journal-morning-coffee" },
      { seed: "journal-window-light" },
    ],
  },
  {
    id: "f0000001-0001-4001-8001-000000000002", // The hard measure
    photos: [{ seed: "journal-sheet-music" }],
  },
  {
    id: "f0000001-0001-4001-8001-000000000003", // Letting it ring
    photos: [
      { seed: "journal-piano-keys" },
      { seed: "journal-evening-practice" },
    ],
  },
];

function supabaseConfig() {
  const status = JSON.parse(
    execSync("npx supabase status -o json", { encoding: "utf8" })
  );
  if (!status.API_URL || !status.SERVICE_ROLE_KEY) {
    throw new Error("Could not read local Supabase status. Is it running?");
  }
  return { url: status.API_URL, serviceKey: status.SERVICE_ROLE_KEY };
}

async function fetchImage(seed, width, height) {
  const url = `https://picsum.photos/seed/${seed}/${width}/${height}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const { url, serviceKey } = supabaseConfig();
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // Photos are stored under the owning user's id so the app's RLS-scoped
  // signed URLs can read them: {user_id}/{entry_id}/{photo_id}-*.jpg
  const { data: userList, error: userErr } =
    await supabase.auth.admin.listUsers();
  if (userErr) throw userErr;
  const userId = userList?.users?.[0]?.id;
  if (!userId) {
    throw new Error("No auth user found — sign in to the app once, then rerun.");
  }
  console.log(`Using owner ${userId}`);

  for (const entry of ENTRIES) {
    // Idempotent: clear any previously seeded photos for this entry.
    const { data: existing } = await supabase
      .from("journal_entry_photos")
      .select("original_path, display_path")
      .eq("entry_id", entry.id);
    if (existing?.length) {
      const paths = existing.flatMap((p) => [p.original_path, p.display_path]);
      await supabase.storage.from(BUCKET).remove(paths);
      await supabase
        .from("journal_entry_photos")
        .delete()
        .eq("entry_id", entry.id);
    }

    for (const photo of entry.photos) {
      const photoId = crypto.randomUUID();
      const originalPath = `${userId}/${entry.id}/${photoId}-original.jpg`;
      const displayPath = `${userId}/${entry.id}/${photoId}-display.jpg`;

      const original = await fetchImage(photo.seed, 3000, 2000);
      const display = await fetchImage(photo.seed, 2000, 1333);

      const up1 = await supabase.storage
        .from(BUCKET)
        .upload(originalPath, original, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (up1.error) throw up1.error;

      const up2 = await supabase.storage
        .from(BUCKET)
        .upload(displayPath, display, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (up2.error) throw up2.error;

      const { error: insErr } = await supabase
        .from("journal_entry_photos")
        .insert({
          entry_id: entry.id,
          original_path: originalPath,
          display_path: displayPath,
        });
      if (insErr) throw insErr;

      console.log(`  attached ${photo.seed} to ${entry.id}`);
    }
  }

  console.log("Done seeding journal photos.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
