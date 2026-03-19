import { ClockIcon } from "lucide-react";

export function GettingStaleSection() {
  return (
    <div className="rounded-lg border-l-4 border-amber-300 bg-amber-50/50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <ClockIcon className="size-4" />
        <span className="font-medium">Getting Stale</span>
      </div>
      <p className="mt-1 text-xs text-amber-700/70">
        Practice time tracking will highlight pieces you haven&apos;t played
        recently. Coming soon.
      </p>
    </div>
  );
}
