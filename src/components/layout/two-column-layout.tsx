import type { ReactNode } from "react";

export function TwoColumnLayout({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
      <main className="flex-1 min-w-0">{left}</main>
      <aside className="hidden lg:block w-80 xl:w-96 shrink-0">
        <div className="sticky top-20">{right}</div>
      </aside>
    </div>
  );
}
