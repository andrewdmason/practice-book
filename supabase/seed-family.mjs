// Seeds three family members (Jenny, Oscar, Sebastian) and a handful of journal
// entries for them — including family-shared ones — so the Family feed and the
// `family-followup` question type have content locally.
//
// Auth users can't be created by the SQL `db reset` seed (GoTrue manages
// auth.users + identities), so this runs separately via the admin API, like
// seed-journal-photos.mjs. It's local-only dev data, NOT a production migration.
//
// Idempotent: members are upserted by email; entries are keyed by fixed UUIDs
// and deleted-then-reinserted on each run. Members are intentionally left
// un-provisioned (seeded_at untouched) so their question types/agent files are
// seeded the normal way on their first dev-login.
//
// Usage (local Supabase running):
//   npm run seed:family

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

// Members to seed. Jenny is an adult; Oscar and Sebastian are kids.
const MEMBERS = [
  { email: "jenny@mason.io", name: "Jenny" },
  { email: "oscar@mason.io", name: "Oscar" },
  { email: "sebastian@mason.io", name: "Sebastian" },
];

// Entries per member email. Each `family` entry is closed + visibility 'family'
// so it surfaces in the Family feed and can be drawn on by family-followup.
// Fixed ids make reseeding idempotent. Timestamps cluster around late May 2026.
const ENTRIES = {
  "jenny@mason.io": [
    {
      id: "a0000002-0001-4001-8001-000000000001",
      entry_date: "2026-05-25",
      visibility: "family",
      title: "the camping trip",
      summary:
        "A weekend camping at Big Basin — cold mornings, a smoky dinner, and the kids finally sleeping through.",
      pull_quote:
        "Sebastian gasped at the redwoods like they were a magic trick.",
      opening_question: "How was the camping trip this weekend?",
      messages: [
        ["assistant", "How was the camping trip this weekend?"],
        [
          "user",
          "Honestly so good. The first morning was freezing and I questioned everything, but by the second day we'd all settled in. The kids were feral in the best way.",
        ],
        ["assistant", "What's the moment you'll keep from it?"],
        [
          "user",
          "Sebastian gasped at the redwoods like they were a magic trick. I want to remember that face for a long time.",
        ],
      ],
    },
    {
      id: "a0000002-0001-4001-8001-000000000002",
      entry_date: "2026-05-27",
      visibility: "private",
      title: "a quiet worry",
      summary: "Turning over a work decision I haven't said out loud yet.",
      pull_quote: "I keep circling it instead of just deciding.",
      opening_question: "What have you been chewing on that you haven't told anyone?",
      messages: [
        ["assistant", "What have you been chewing on that you haven't told anyone?"],
        [
          "user",
          "Whether to take the new role. It's more money but more travel, and I keep circling it instead of just deciding.",
        ],
      ],
    },
  ],
  "oscar@mason.io": [
    {
      id: "a0000002-0002-4001-8001-000000000001",
      entry_date: "2026-05-26",
      visibility: "family",
      title: "the volcano won",
      summary:
        "Oscar's baking-soda volcano took first place at the school science fair.",
      pull_quote: "It erupted way bigger than at home and everyone cheered.",
      opening_question: "What was the best part of the science fair today?",
      messages: [
        ["assistant", "What was the best part of the science fair today?"],
        [
          "user",
          "MY VOLCANO WON. It erupted way bigger than at home and everyone cheered. Mr. Diaz said it was the loudest one.",
        ],
        ["assistant", "What made it go so big this time?"],
        ["user", "I used warm water and WAY more vinegar. Science!"],
      ],
    },
  ],
  "sebastian@mason.io": [
    {
      id: "a0000002-0003-4001-8001-000000000001",
      entry_date: "2026-05-28",
      visibility: "family",
      title: "i scored a goal",
      summary: "Sebastian scored his first goal of the soccer season.",
      pull_quote: "The ball went in and my whole team ran at me!",
      opening_question: "Did anything exciting happen at soccer today?",
      messages: [
        ["assistant", "Did anything exciting happen at soccer today?"],
        [
          "user",
          "I SCORED!! The ball went in and my whole team ran at me. I almost fell over.",
        ],
        ["assistant", "How did it feel right when it went in?"],
        ["user", "Like my tummy did a flip. The good kind."],
      ],
    },
  ],
};

// Inline comments on the family-shared entries above, so the Family feed and
// post views show the commenting feature with real content. Each comment is
// anchored to a block_index — for these standard entries that's the message
// ordinal (0 = opening question, 1 = first answer, 2 = next question, 3 = next
// answer). `commenter` is an email resolved to a user_id at seed time; any
// commenter without a provisioned member row is skipped. Array order sets the
// comment timestamps, which the byline uses to order "with comments from …".
const COMMENTS = [
  // Jenny's "camping trip" — the kids (and Dad) chime in.
  {
    entryId: "a0000002-0001-4001-8001-000000000001",
    commenter: "oscar@mason.io",
    blockIndex: 1,
    content: "I was NOT feral 😤",
  },
  {
    entryId: "a0000002-0001-4001-8001-000000000001",
    commenter: "sebastian@mason.io",
    blockIndex: 3,
    content: "the trees were SO tall i couldn't see the top",
  },
  {
    entryId: "a0000002-0001-4001-8001-000000000001",
    commenter: "andrew@mason.io",
    blockIndex: 3,
    content: "I got the photo of that exact face. Framing it.",
  },
  // Oscar's "the volcano won" — Mom and brother celebrate.
  {
    entryId: "a0000002-0002-4001-8001-000000000001",
    commenter: "jenny@mason.io",
    blockIndex: 1,
    content: "We are SO proud of you, bud. 🌋",
  },
  {
    entryId: "a0000002-0002-4001-8001-000000000001",
    commenter: "sebastian@mason.io",
    blockIndex: 1,
    content: "it was the loudest one!!!",
  },
  {
    entryId: "a0000002-0002-4001-8001-000000000001",
    commenter: "jenny@mason.io",
    blockIndex: 3,
    content: "Future scientist over here.",
  },
  // Sebastian's "i scored a goal" — Mom and brother.
  {
    entryId: "a0000002-0003-4001-8001-000000000001",
    commenter: "jenny@mason.io",
    blockIndex: 1,
    content: "I cheered so loud I lost my voice. Worth it.",
  },
  {
    entryId: "a0000002-0003-4001-8001-000000000001",
    commenter: "oscar@mason.io",
    blockIndex: 3,
    content: "haha the good kind. nice one seb",
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

async function ensureMember(supabase, { email, name }) {
  // Ensure the auth user exists (create on first run).
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;
  let user = list?.users?.find((u) => u.email === email);
  if (!user) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw error;
    user = created.user;
    console.log(`  created auth user ${email}`);
  }

  // Upsert the membership row without disturbing seeded_at (so normal
  // provisioning still runs on this member's first sign-in).
  const { data: existing } = await supabase
    .from("journal_members")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("journal_members")
      .update({ name, user_id: user.id })
      .eq("email", email);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("journal_members")
      .insert({ email, name, user_id: user.id, is_owner: false });
    if (error) throw error;
  }
  return user.id;
}

async function seedEntries(supabase, userId, entries) {
  for (const e of entries) {
    // Idempotent: drop any prior version (messages cascade on entry delete).
    await supabase.from("journal_messages").delete().eq("entry_id", e.id);
    await supabase.from("journal_entries").delete().eq("id", e.id);

    const closedAt = `${e.entry_date} 14:05:00+00`;
    const createdAt = `${e.entry_date} 14:00:00+00`;
    const { error: entryErr } = await supabase.from("journal_entries").insert({
      id: e.id,
      user_id: userId,
      entry_date: e.entry_date,
      status: "closed",
      entry_type: "standard",
      visibility: e.visibility,
      opening_question: e.opening_question,
      summary: e.summary,
      title: e.title,
      pull_quote: e.pull_quote,
      summary_stale: false,
      closed_at: closedAt,
      created_at: createdAt,
      updated_at: closedAt,
    });
    if (entryErr) throw entryErr;

    let t = new Date(`${e.entry_date}T14:00:00Z`).getTime();
    const rows = e.messages.map(([role, content]) => {
      t += 90_000; // 90s between turns
      return {
        entry_id: e.id,
        role,
        content,
        user_id: userId,
        created_at: new Date(t).toISOString(),
      };
    });
    const { error: msgErr } = await supabase.from("journal_messages").insert(rows);
    if (msgErr) throw msgErr;

    console.log(`  seeded "${e.title}" (${e.visibility}) for ${userId}`);
  }
}

async function seedComments(supabase) {
  // Resolve commenter emails to user_ids from the membership table, so any
  // provisioned member (including the account owner) can comment.
  const { data: members, error: membersErr } = await supabase
    .from("journal_members")
    .select("email, user_id");
  if (membersErr) throw membersErr;
  const userIdByEmail = new Map(
    (members ?? [])
      .filter((m) => m.user_id)
      .map((m) => [m.email, m.user_id])
  );

  // Idempotent: clear comments on the entries we're about to seed. (Reseeding
  // an entry already cascade-deletes its comments, but this also covers running
  // the comment seed on its own.)
  const entryIds = [...new Set(COMMENTS.map((c) => c.entryId))];
  await supabase.from("journal_inline_comments").delete().in("entry_id", entryIds);

  let order = 0;
  const rows = [];
  for (const c of COMMENTS) {
    const userId = userIdByEmail.get(c.commenter);
    if (!userId) {
      console.log(`  skipped comment from ${c.commenter} (no member row)`);
      continue;
    }
    // Stamp created_at in array order so the byline lists commenters in a
    // stable, intentional sequence. Anchor a few minutes after entries close.
    const created = new Date(Date.UTC(2026, 4, 29, 15, 0, 0) + order * 60_000);
    order += 1;
    rows.push({
      entry_id: c.entryId,
      user_id: userId,
      block_index: c.blockIndex,
      content: c.content,
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("journal_inline_comments").insert(rows);
    if (error) throw error;
  }
  console.log(`Seeded ${rows.length} inline comments.`);
}

async function main() {
  const { url, serviceKey } = supabaseConfig();
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  for (const member of MEMBERS) {
    console.log(`Member ${member.name} <${member.email}>`);
    const userId = await ensureMember(supabase, member);
    await seedEntries(supabase, userId, ENTRIES[member.email] ?? []);
  }

  await seedComments(supabase);

  console.log("Done seeding family members, entries, and comments.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
