"use client";

import { useState, useTransition, type ComponentType } from "react";
import {
  ChevronRight,
  Plus,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  addCustomQuestionType,
  deleteCustomQuestionType,
  saveQuestionConfig,
} from "@/app/(journal)/journal/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { JournalQuestionType, JournalSettings } from "@/lib/types";

const MIN_PER_DAY = 1;
const MAX_PER_DAY = 5;

/**
 * Cadence tiers, most → least frequent, then Off. The `weight` values are the
 * relative weights written to the row (the sampler normalizes them); the UI
 * never exposes the numbers. Icons form an issue-tracker-style priority ramp.
 */
type CadenceKey = "daily" | "several" | "weekly" | "rare" | "off";

const CADENCE: {
  key: CadenceKey;
  label: string;
  weight: number;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { key: "daily", label: "Daily", weight: 12, Icon: Signal },
  { key: "several", label: "Several times a week", weight: 6, Icon: SignalHigh },
  { key: "weekly", label: "Once a week", weight: 3, Icon: SignalMedium },
  { key: "rare", label: "Less than once a week", weight: 1, Icon: SignalLow },
  { key: "off", label: "Off", weight: 0, Icon: SignalZero },
];

const ACTIVE_TIERS = CADENCE.filter((t) => t.key !== "off");

function cadenceFor(row: { enabled: boolean; weight: number }): CadenceKey {
  if (!row.enabled) return "off";
  // Snap to the active tier whose weight is closest to the stored weight.
  let best = ACTIVE_TIERS[0];
  let bestDiff = Infinity;
  for (const t of ACTIVE_TIERS) {
    const d = Math.abs((row.weight || 0) - t.weight);
    if (d < bestDiff) {
      bestDiff = d;
      best = t;
    }
  }
  return best.key;
}

type Row = {
  id: string;
  name: string;
  base_description: string;
  style_note: string;
  weight: number;
  enabled: boolean;
  is_builtin: boolean;
  sort_order: number;
};

function labelFor(name: string): string {
  const s = name.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Sort by effective priority (enabled weight, desc), Off last, stable on the
// seeded order for ties.
function byPriority(a: Row, b: Row): number {
  const aw = a.enabled ? a.weight : -1;
  const bw = b.enabled ? b.weight : -1;
  if (bw !== aw) return bw - aw;
  return a.sort_order - b.sort_order;
}

function toRow(t: JournalQuestionType): Row {
  return {
    id: t.id,
    name: t.name,
    base_description: t.base_description,
    style_note: t.style_note,
    weight: Math.round(Number(t.weight) || 0),
    enabled: t.enabled,
    is_builtin: t.is_builtin,
    sort_order: t.sort_order,
  };
}

export function QuestionsEditor({
  questionTypes,
  settings,
}: {
  questionTypes: JournalQuestionType[];
  settings: JournalSettings;
}) {
  const [rows, setRows] = useState<Row[]>(() => questionTypes.map(toRow));
  const [perDay, setPerDay] = useState(settings.questions_per_day);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const builtins = rows.filter((r) => r.is_builtin).sort(byPriority);
  const customs = rows.filter((r) => !r.is_builtin).sort(byPriority);

  function touch() {
    setDirty(true);
    setJustSaved(false);
  }

  function patch(id: string, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
    touch();
  }

  function setCadence(id: string, key: CadenceKey) {
    const tier = CADENCE.find((t) => t.key === key)!;
    if (key === "off") {
      patch(id, { enabled: false });
    } else {
      patch(id, { enabled: true, weight: tier.weight });
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveQuestionConfig(
          rows.map((r) => ({
            id: r.id,
            weight: r.weight,
            style_note: r.style_note,
            base_description: r.base_description,
            enabled: r.enabled,
          })),
          perDay
        );
        setDirty(false);
        setJustSaved(true);
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleAdd() {
    startTransition(async () => {
      try {
        const created = await addCustomQuestionType(newName, newDesc);
        setRows((rs) => [...rs, toRow(created)]);
        setNewName("");
        setNewDesc("");
        setAdding(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteCustomQuestionType(id);
        setRows((rs) => rs.filter((r) => r.id !== id));
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="mt-4">
      {/* Questions per day */}
      <div className="mb-6 flex items-center gap-3">
        <span className="font-serif text-sm text-foreground">Questions per day</span>
        <div className="flex items-center gap-1">
          {Array.from(
            { length: MAX_PER_DAY - MIN_PER_DAY + 1 },
            (_, i) => i + MIN_PER_DAY
          ).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPerDay(n);
                touch();
              }}
              className={cn(
                "h-7 w-7 rounded-md border font-serif text-sm transition-colors",
                perDay === n
                  ? "border-foreground bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {builtins.map((r) => (
          <QuestionRow key={r.id} row={r} onPatch={patch} onCadence={setCadence} />
        ))}
      </div>

      {/* Custom types */}
      <div className="mt-8">
        <h3 className="font-serif text-sm uppercase tracking-wide text-muted-foreground">
          Your own types
        </h3>
        <div className="mt-3">
          {customs.length === 0 && !adding && (
            <p className="font-serif text-sm italic text-muted-foreground">
              None yet — add a question type that&apos;s specific to your life.
            </p>
          )}
          {customs.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {customs.map((r) => (
                <QuestionRow
                  key={r.id}
                  row={r}
                  onPatch={patch}
                  onCadence={setCadence}
                  onDelete={() => handleDelete(r.id)}
                />
              ))}
            </div>
          )}

          {adding ? (
            <div className="mt-3 rounded-lg border border-border p-3">
              <Input
                autoFocus
                placeholder="name (e.g. marathon-training)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Textarea
                className="mt-2"
                placeholder="What is a question of this type about?"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" onClick={handleAdd} disabled={pending}>
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setNewName("");
                    setNewDesc("");
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
              <p className="mt-2 font-serif text-xs italic text-muted-foreground">
                New types start Off — set a cadence to add them to the rotation.
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add custom type
            </Button>
          )}
        </div>
      </div>

      {/* Save bar */}
      <div className="mt-8 flex items-center justify-end gap-3 border-t border-border pt-4 text-xs">
        <span className="text-muted-foreground">
          {justSaved ? "saved" : dirty ? "unsaved changes" : ""}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || pending}
          className="font-serif text-sm text-foreground underline-offset-4 hover:underline disabled:opacity-40 disabled:hover:no-underline"
        >
          {pending ? "saving…" : "save"}
        </button>
      </div>
    </div>
  );
}

function QuestionRow({
  row,
  onPatch,
  onCadence,
  onDelete,
}: {
  row: Row;
  onPatch: (id: string, p: Partial<Row>) => void;
  onCadence: (id: string, key: CadenceKey) => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasNotes = row.style_note.trim().length > 0;
  const off = !row.enabled;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div>
      {/* Collapsed header — click anywhere (except the controls) to expand. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((x) => !x)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((x) => !x);
          }
        }}
        className="flex cursor-pointer select-none items-center gap-2 px-2 py-1.5"
      >
        <span onClick={stop} className="inline-flex">
          <PriorityPicker
            value={cadenceFor(row)}
            onChange={(key) => onCadence(row.id, key)}
          />
        </span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
        <span
          className={cn(
            "font-serif text-sm",
            off ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {labelFor(row.name)}
        </span>

        <div className="flex-1" />

        {hasNotes && (
          <StickyNote
            className="h-3.5 w-3.5 text-primary"
            aria-label="Has custom instructions"
          />
        )}
        {onDelete && (
          <span onClick={stop} className="inline-flex">
            <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </span>
        )}
      </div>

      {/* Expanded detail — how the question is determined + custom instructions. */}
      {expanded && (
        <div className="pb-3 pl-9 pr-2">
          {row.is_builtin ? (
            <p className="font-serif text-sm text-muted-foreground">{row.base_description}</p>
          ) : (
            <div>
              <label className="font-serif text-xs uppercase tracking-wide text-muted-foreground">
                What this asks about
              </label>
              <Textarea
                className="mt-1"
                value={row.base_description}
                onChange={(e) => onPatch(row.id, { base_description: e.target.value })}
                placeholder="What is a question of this type about, and what should it draw on?"
              />
            </div>
          )}

          <div className="mt-3">
            <label className="font-serif text-xs uppercase tracking-wide text-muted-foreground">
              Custom instructions
            </label>
            <Textarea
              className="mt-1"
              value={row.style_note}
              onChange={(e) => onPatch(row.id, { style_note: e.target.value })}
              placeholder="Optional — e.g. only ask about events from the last two days"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PriorityPicker({
  value,
  onChange,
}: {
  value: CadenceKey;
  onChange: (key: CadenceKey) => void;
}) {
  const current = CADENCE.find((t) => t.key === value)!;
  const CurrentIcon = current.Icon;
  const off = value === "off";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Cadence: ${current.label}`} />
        }
      >
        <CurrentIcon
          className={cn("h-4 w-4", off ? "text-muted-foreground/60" : "text-foreground")}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as CadenceKey)}
        >
          {CADENCE.map((t) => {
            const Icon = t.Icon;
            return (
              <DropdownMenuRadioItem key={t.key} value={t.key}>
                <Icon
                  className={cn(
                    "h-4 w-4",
                    t.key === "off" ? "text-muted-foreground/60" : "text-foreground"
                  )}
                />
                <span className="font-serif">{t.label}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
