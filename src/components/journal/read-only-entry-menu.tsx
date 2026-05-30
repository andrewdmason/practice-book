"use client";

import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The "…" options menu on a read-only entry. A non-owner family member passes
 * no actions and gets nothing; the account owner viewing someone else's post
 * passes their photo actions (attach / generate) and gets just those — never
 * the author-only edit / regenerate / delete items that live on the editable
 * view. Expects an ancestor with the `group/title` class so the trigger fades
 * in on hover, matching the editable title's menu.
 */
export function ReadOnlyEntryMenu({ actions }: { actions: React.ReactNode }) {
  if (!actions) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Post options"
        className="mt-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/title:opacity-100 data-[popup-open]:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {actions}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
