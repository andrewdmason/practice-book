"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addFamilyMember,
  removeFamilyMember,
} from "@/app/(journal)/settings/family/actions";
import type { JournalMember } from "@/lib/types";

export function FamilyManager({ members }: { members: JournalMember[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add member.");
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
        {members.map((m) => (
          <div key={m.email} className="flex items-center gap-3 px-4 py-3">
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
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mt-6">
        <h3 className="font-serif text-xs uppercase tracking-wide text-muted-foreground">
          Add a family member
        </h3>
        <p className="mt-1 font-serif text-xs italic text-muted-foreground">
          They&apos;ll sign in with their own email magic link and get their
          own private journal and interviewer.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
