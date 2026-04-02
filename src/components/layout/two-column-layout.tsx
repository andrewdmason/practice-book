"use client";

import { type ReactNode, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

export function TwoColumnLayout({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row gap-6 px-4 py-6 sm:px-6">
      <main className="flex-1 min-w-0">{left}</main>

      {/* Mobile: toggle button (hidden on lg+) */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium text-card-foreground hover:bg-muted/50 transition-colors"
        >
          Repertoire
          <ChevronDownIcon
            className={`size-4 text-muted-foreground transition-transform ${mobileOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Shared content: visible on lg+ always, on mobile only when open */}
      <div
        className={`lg:block lg:w-80 xl:w-96 lg:shrink-0 ${mobileOpen ? "block" : "hidden lg:block"}`}
      >
        <div className="lg:sticky lg:top-[6.5rem] lg:max-h-[calc(100vh-6.5rem-1.5rem)] lg:overflow-y-auto">{right}</div>
      </div>
    </div>
  );
}
