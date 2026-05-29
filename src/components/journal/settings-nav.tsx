"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    label: "Questions",
    href: "/settings/questions",
    description:
      "The kinds of questions you get each morning, how often each shows up, and how many you're offered.",
  },
  {
    label: "Interviewer",
    href: "/settings/interviewer",
    description:
      "The interviewer's voice and how it asks — its personality, not which topics it picks. Edit it here directly.",
  },
  {
    label: "User",
    href: "/settings/user",
    description:
      "Your life context: who you are, who's around you, what you're working on.",
  },
  {
    label: "Family",
    href: "/settings/family",
    description:
      "Add or remove family members. Each one signs in with their own email and gets their own private journal.",
    ownerOnly: true,
  },
] as const;

export function SettingsNav({ isOwner = false }: { isOwner?: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => !("ownerOnly" in t && t.ownerOnly) || isOwner);
  const active = tabs.find((t) => pathname.startsWith(t.href)) ?? tabs[0];

  return (
    <>
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "relative px-3 py-2 font-serif text-sm transition-colors " +
              (tab.href === active.href
                ? "text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:bg-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 font-serif text-xs italic text-muted-foreground">
        {active.description}
      </p>
    </>
  );
}
