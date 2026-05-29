"use client";

import { useState } from "react";
import { SingleFileEditor } from "@/components/journal/agent-file-editor";
import { QuestionsEditor } from "@/components/journal/questions-editor";
import type {
  JournalAgentFile,
  JournalAgentFileName,
  JournalQuestionType,
  JournalSettings,
} from "@/lib/types";

type Tab = JournalAgentFileName | "Questions";

const TAB_ORDER: Tab[] = ["Interviewer", "User", "Questions"];

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  Interviewer:
    "The interviewer's voice and how it asks — its personality, not which topics it picks. Edit it here directly.",
  User: "Your life context: who you are, who's around you, what you're working on.",
  Questions:
    "The kinds of questions you get each morning, how often each shows up, and how many you're offered.",
};

export function AgentSettingsTabs({
  files,
  questionTypes,
  settings,
  initialTab = "Questions",
}: {
  files: JournalAgentFile[];
  questionTypes: JournalQuestionType[];
  settings: JournalSettings;
  initialTab?: Tab;
}) {
  const [active, setActive] = useState<Tab>(initialTab);
  const fileMap = Object.fromEntries(files.map((f) => [f.name, f.content])) as Record<
    JournalAgentFileName,
    string
  >;
  const recentEdits = [...files]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 3);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_240px]">
      <div>
        <div className="flex items-center gap-1 border-b border-border">
          {TAB_ORDER.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActive(name)}
              className={
                "relative px-3 py-2 font-serif text-sm transition-colors " +
                (active === name
                  ? "text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {name}
            </button>
          ))}
        </div>

        <p className="mt-3 font-serif text-xs italic text-muted-foreground">
          {TAB_DESCRIPTIONS[active]}
        </p>

        {active === "Questions" ? (
          <QuestionsEditor questionTypes={questionTypes} settings={settings} />
        ) : (
          /* Re-mount the editor when the active tab changes so initial content
             loads correctly per file. */
          <SingleFileEditor
            key={active}
            name={active}
            initialMarkdown={fileMap[active] ?? ""}
          />
        )}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="font-serif text-sm uppercase tracking-wide text-muted-foreground">
          Recent file edits
        </h2>
        <ul className="mt-3 space-y-3">
          {recentEdits.map((f) => (
            <li key={f.id} className="font-serif text-sm">
              <span className="block text-xs text-muted-foreground tabular-nums">
                {f.updated_at.slice(0, 10)}
              </span>
              <span className="text-foreground">{f.name}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 font-serif text-xs italic text-muted-foreground">
          Edits you make here, or accept from a suggestion, update these timestamps.
        </p>
      </aside>
    </div>
  );
}
