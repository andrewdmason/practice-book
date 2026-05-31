"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberAvatar } from "@/components/journal/member-avatar";
import { MemberPhotoDialog } from "@/components/journal/member-photo-dialog";
import {
  addFamilyMember,
  removeFamilyMember,
  updateFamilyMember,
} from "@/app/(journal)/settings/family/actions";
import type { JournalMember, MemberJournalStats, MemberPhoto } from "@/lib/types";

export function FamilyManager({
  members,
  photosByEmail,
  journalStatsByUserId,
}: {
  members: JournalMember[];
  photosByEmail: Record<string, MemberPhoto[]>;
  journalStatsByUserId: Record<string, MemberJournalStats>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addFamilyMember(email, name);
        setName("");
        setEmail("");
        setAdding(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add member.");
      }
    });
  }

  function startEdit(member: JournalMember) {
    setError(null);
    setEditingEmail(member.email);
    setEditName(member.name ?? "");
    setEditEmail(member.email);
  }

  function cancelEdit() {
    setEditingEmail(null);
    setError(null);
  }

  function handleEdit(e: React.FormEvent, original: JournalMember) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateFamilyMember(original.email, editName, editEmail);
        setEditingEmail(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save changes.");
      }
    });
  }

  function handleRemove(member: JournalMember) {
    const label = member.name || member.email;
    if (
      !window.confirm(
        `Remove ${label}? This permanently deletes their account and all of their journal entries.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await removeFamilyMember(member.email);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove member.");
      }
    });
  }

  return (
    <div className="mt-6">
      <div className="divide-y divide-border rounded-lg border border-border">
        {members.map((m) => {
          const photos = photosByEmail[m.email] ?? [];
          const primary = photos.find((p) => p.is_primary) ?? photos[0];
          const stats = m.user_id ? journalStatsByUserId[m.user_id] : null;
          const isEditing = editingEmail === m.email;
          return (
            <div
              key={m.email}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
            >
              <MemberPhotoDialog
                member={m}
                photos={photos}
                trigger={
                  <button
                    type="button"
                    aria-label={`Manage photos for ${m.name || m.email}`}
                    className="rounded-full ring-offset-2 ring-offset-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                  >
                    <MemberAvatar name={m.name} url={primary?.url} size="md" />
                  </button>
                }
              />
              {isEditing ? (
                <form
                  onSubmit={(e) => handleEdit(e, m)}
                  className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <Input
                    placeholder="Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="sm:max-w-[160px]"
                  />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    disabled={m.is_owner}
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={pending}>
                      {pending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={cancelEdit}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-sm text-foreground">
                        {m.name || "—"}
                      </span>
                      {m.is_owner && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Owner
                        </span>
                      )}
                      {!m.is_owner && !m.seeded_at && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Invited
                        </span>
                      )}
                    </div>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.email}
                    </span>
                  </div>
                  <MemberPostingStats stats={stats} />
                  {!m.is_owner &&
                    (m.seeded_at ? (
                      <Link
                        href={`/settings/user?member=${encodeURIComponent(m.email)}`}
                        aria-label={`Edit ${m.name || m.email}'s settings`}
                        title="Edit settings"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Settings className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span
                        aria-label="Pending first sign-in"
                        title="Settings open once they've signed in"
                        className="text-muted-foreground opacity-40"
                      >
                        <Settings className="h-4 w-4" />
                      </span>
                    ))}
                  <button
                    type="button"
                    onClick={() => startEdit(m)}
                    disabled={pending}
                    aria-label={`Edit ${m.name || m.email}`}
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!m.is_owner && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m)}
                      disabled={pending}
                      aria-label={`Remove ${m.name || m.email}`}
                      className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <form onSubmit={handleAdd} className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:max-w-[200px]"
            />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add member"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 font-serif text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          + Add a family member
        </button>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function MemberPostingStats({
  stats,
}: {
  stats: MemberJournalStats | null | undefined;
}) {
  const currentStreak = stats?.currentStreak ?? 0;
  const daysLast7 = stats?.daysLast7 ?? 0;
  const daysLast30 = stats?.daysLast30 ?? 0;

  return (
    <div className="ml-[3.25rem] grid w-full grid-cols-3 gap-3 text-right sm:ml-0 sm:w-auto sm:min-w-[13rem]">
      <MemberPostingStat value={currentStreak} label="streak" />
      <MemberPostingStat value={`${daysLast7}/7`} label="last 7" />
      <MemberPostingStat value={`${daysLast30}/30`} label="last 30" />
    </div>
  );
}

function MemberPostingStat({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
