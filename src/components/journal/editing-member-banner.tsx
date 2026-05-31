import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Shown atop the settings screens when the owner is editing a family member's
 * settings on their behalf. Names whose settings are being edited and links
 * back to the family roster.
 */
export function EditingMemberBanner({ memberName }: { memberName: string }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-4 py-3">
      <p className="font-serif text-sm text-foreground">
        Editing{" "}
        <span className="font-semibold">{memberName}</span>
        &apos;s settings
      </p>
      <Link
        href="/settings/family"
        className="inline-flex items-center gap-1 font-serif text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Done
      </Link>
    </div>
  );
}
