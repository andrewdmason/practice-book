import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUILTIN_QUESTION_TYPES,
  DEFAULT_INTERVIEWER,
  DEFAULT_QUESTIONS_PER_DAY,
} from "@/lib/journal/seeds/defaults";

type AdminClient = ReturnType<typeof createAdminClient>;

export type MembershipResult =
  | { allowed: false }
  | { allowed: true; isOwner: boolean };

type TemplateQuestionType = {
  name: string;
  base_description: string;
  style_note: string;
  weight: number;
  enabled: boolean;
  is_builtin: boolean;
  sort_order: number;
};

type SeedTemplate = {
  interviewer: string;
  questionTypes: TemplateQuestionType[];
  questionsPerDay: number;
};

/**
 * Allowlist check + first-sign-in provisioning for a family member.
 *
 * Called on every sign-in (magic links re-fire), so it's idempotent: a member
 * whose journal is already seeded just gets their owner claim refreshed. A
 * member not on the allowlist is rejected — the caller signs them out.
 */
export async function ensureProvisioned(user: {
  id: string;
  email?: string | null;
}): Promise<MembershipResult> {
  const email = user.email?.toLowerCase().trim();
  if (!email) return { allowed: false };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("journal_members")
    .select("email, user_id, is_owner, seeded_at")
    .eq("email", email)
    .maybeSingle();
  if (!member) return { allowed: false };

  // Link the auth user to the membership row the first time we see them.
  // Middleware gates /practice by reading is_owner from this row directly.
  if (member.user_id !== user.id) {
    await admin
      .from("journal_members")
      .update({ user_id: user.id })
      .eq("email", email);
  }

  if (!member.seeded_at) {
    await seedJournal(admin, user.id, member.is_owner);
    await admin
      .from("journal_members")
      .update({ seeded_at: new Date().toISOString() })
      .eq("email", email);
  }

  return { allowed: true, isOwner: member.is_owner };
}

/** Seed a new member's per-user journal rows from the resolved template. */
async function seedJournal(
  admin: AdminClient,
  userId: string,
  isOwner: boolean
): Promise<void> {
  const template = await resolveTemplate(admin, userId, isOwner);

  // Interviewer voice (copied/tuned) + an empty User profile to fill in.
  await admin.from("journal_agent_files").insert([
    {
      user_id: userId,
      name: "Interviewer",
      content: template.interviewer,
      agent_writable: true,
    },
    { user_id: userId, name: "User", content: "", agent_writable: false },
  ]);

  await admin.from("journal_question_types").insert(
    template.questionTypes.map((qt) => ({ ...qt, user_id: userId }))
  );

  await admin
    .from("journal_settings")
    .insert({ user_id: userId, questions_per_day: template.questionsPerDay });

  // Calendar sources are intentionally NOT seeded — a member's feeds are private
  // and must never be copied from anyone else. They start with none.
}

/**
 * Where a new member's seed comes from: copy the owner's *tuned* Interviewer +
 * question types + settings when an owner is already set up; otherwise fall back
 * to code defaults (the very first owner on a fresh database).
 */
async function resolveTemplate(
  admin: AdminClient,
  userId: string,
  isOwner: boolean
): Promise<SeedTemplate> {
  if (!isOwner) {
    const { data: owner } = await admin
      .from("journal_members")
      .select("user_id, seeded_at")
      .eq("is_owner", true)
      .maybeSingle();
    if (owner?.user_id && owner.seeded_at && owner.user_id !== userId) {
      return loadTemplateFromUser(admin, owner.user_id);
    }
  }
  return defaultTemplate();
}

async function loadTemplateFromUser(
  admin: AdminClient,
  sourceUserId: string
): Promise<SeedTemplate> {
  const [{ data: interviewerFile }, { data: qts }, { data: settings }] =
    await Promise.all([
      admin
        .from("journal_agent_files")
        .select("content")
        .eq("user_id", sourceUserId)
        .eq("name", "Interviewer")
        .maybeSingle(),
      admin
        .from("journal_question_types")
        .select(
          "name, base_description, style_note, weight, enabled, is_builtin, sort_order"
        )
        .eq("user_id", sourceUserId)
        .order("sort_order", { ascending: true }),
      admin
        .from("journal_settings")
        .select("questions_per_day")
        .eq("user_id", sourceUserId)
        .maybeSingle(),
    ]);

  // If the owner somehow has no tuned rows, fall back to code defaults so the
  // new member still gets a working journal.
  const fallback = defaultTemplate();
  return {
    interviewer: interviewerFile?.content ?? fallback.interviewer,
    questionTypes:
      qts && qts.length > 0
        ? (qts as TemplateQuestionType[])
        : fallback.questionTypes,
    questionsPerDay: settings?.questions_per_day ?? fallback.questionsPerDay,
  };
}

function defaultTemplate(): SeedTemplate {
  return {
    interviewer: DEFAULT_INTERVIEWER,
    questionTypes: BUILTIN_QUESTION_TYPES.map((qt) => ({
      name: qt.name,
      base_description: qt.base_description,
      style_note: "",
      weight: qt.weight,
      enabled: true,
      is_builtin: true,
      sort_order: qt.sort_order,
    })),
    questionsPerDay: DEFAULT_QUESTIONS_PER_DAY,
  };
}
