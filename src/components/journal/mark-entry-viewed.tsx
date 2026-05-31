"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markEntryViewed } from "@/app/(journal)/journal/actions";

/**
 * Records the current user's view of a family post once on mount, dismissing
 * its header notification. Renders nothing. Only mounted for family+closed
 * entries (the only posts that can carry a notification).
 *
 * The header (in the layout) has already rendered by the time this effect
 * runs, so after recording the view we refresh the router to re-fetch the
 * route — recomputing the badge so it drops immediately, rather than only on
 * the next navigation.
 */
export function MarkEntryViewed({ entryId }: { entryId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void markEntryViewed(entryId).then(() => {
      if (!cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [entryId, router]);

  return null;
}
