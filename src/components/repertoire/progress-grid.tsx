"use client";

import { useMemo, useState } from "react";
import { GridIcon } from "lucide-react";
import type {
  PieceSectionWithChildren,
  SectionStatus,
  SectionStatusSnapshot,
} from "@/lib/types";
import {
  SECTION_STATUS_HEX_COLORS,
  SECTION_STATUS_LABELS,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "weekly" | "monthly";

type ProgressGridProps = {
  sections: PieceSectionWithChildren[];
  snapshots: SectionStatusSnapshot[];
};

/** Get the Monday of the week containing a date */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Get YYYY-MM for a date */
function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** Flatten sections into ordered rows with indent info */
function flattenForGrid(
  sections: PieceSectionWithChildren[]
): { id: string; label: string; isChild: boolean }[] {
  const rows: { id: string; label: string; isChild: boolean }[] = [];
  for (const parent of sections) {
    if (parent.children.length > 0) {
      for (const child of parent.children) {
        rows.push({ id: child.id, label: child.label, isChild: true });
      }
    } else {
      rows.push({ id: parent.id, label: parent.label, isChild: false });
    }
  }
  return rows;
}

export function ProgressGrid({ sections, snapshots }: ProgressGridProps) {
  const rows = useMemo(() => flattenForGrid(sections), [sections]);

  const { activeWeeks, activeMonths, statusByWeek, statusByMonth } =
    useMemo(() => {
      if (snapshots.length === 0) {
        return {
          activeWeeks: [] as string[],
          activeMonths: [] as string[],
          statusByWeek: {} as Record<string, Record<string, SectionStatus>>,
          statusByMonth: {} as Record<string, Record<string, SectionStatus>>,
        };
      }

      const weekSet = new Set<string>();
      const monthSet = new Set<string>();

      for (const snap of snapshots) {
        weekSet.add(weekStart(snap.snapshot_date));
        monthSet.add(monthKey(snap.snapshot_date));
      }

      const sortedWeeks = [...weekSet].sort();
      const sortedMonths = [...monthSet].sort();

      const statusByWeek: Record<string, Record<string, SectionStatus>> = {};
      const statusByMonth: Record<string, Record<string, SectionStatus>> = {};

      for (const row of rows) {
        const sectionSnaps = snapshots.filter(
          (s) => s.section_id === row.id
        );

        let snapIdx = 0;
        let currentStatus: SectionStatus = 0;

        if (sectionSnaps.length > 0) {
          currentStatus = sectionSnaps[0].old_status as SectionStatus;
        }

        for (const week of sortedWeeks) {
          const sundayDate = new Date(week + "T00:00:00");
          sundayDate.setDate(sundayDate.getDate() + 6);
          const sundayStr = sundayDate.toISOString().slice(0, 10);

          while (
            snapIdx < sectionSnaps.length &&
            sectionSnaps[snapIdx].snapshot_date <= sundayStr
          ) {
            currentStatus = sectionSnaps[snapIdx]
              .new_status as SectionStatus;
            snapIdx++;
          }

          if (!statusByWeek[row.id]) statusByWeek[row.id] = {};
          statusByWeek[row.id][week] = currentStatus;
        }

        snapIdx = 0;
        currentStatus =
          sectionSnaps.length > 0
            ? (sectionSnaps[0].old_status as SectionStatus)
            : 0;

        for (const ym of sortedMonths) {
          const [year, month] = ym.split("-").map(Number);
          const lastDay = new Date(year, month, 0);
          const lastDayStr = lastDay.toISOString().slice(0, 10);

          while (
            snapIdx < sectionSnaps.length &&
            sectionSnaps[snapIdx].snapshot_date <= lastDayStr
          ) {
            currentStatus = sectionSnaps[snapIdx]
              .new_status as SectionStatus;
            snapIdx++;
          }

          if (!statusByMonth[row.id]) statusByMonth[row.id] = {};
          statusByMonth[row.id][ym] = currentStatus;
        }
      }

      return {
        activeWeeks: sortedWeeks,
        activeMonths: sortedMonths,
        statusByWeek,
        statusByMonth,
      };
    }, [snapshots, rows]);

  const defaultMode: ViewMode =
    activeWeeks.length > 12 ? "monthly" : "weekly";
  const [mode, setMode] = useState<ViewMode>(defaultMode);

  if (snapshots.length === 0) {
    return (
      <div>
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          <GridIcon className="size-3.5" />
          Section Progress
        </h3>
        <p className="text-sm text-muted-foreground">
          No status changes recorded yet.
        </p>
      </div>
    );
  }

  const columns = mode === "weekly" ? activeWeeks : activeMonths;
  const statusMap = mode === "weekly" ? statusByWeek : statusByMonth;

  const firstLabel =
    mode === "weekly" ? formatDate(columns[0]) : formatMonth(columns[0]);
  const lastLabel =
    mode === "weekly"
      ? formatDate(columns[columns.length - 1])
      : formatMonth(columns[columns.length - 1]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <GridIcon className="size-3.5" />
          Section Progress
        </h3>
        <div className="flex items-center gap-0.5 rounded-md border p-0.5">
          <button
            onClick={() => setMode("weekly")}
            className={cn(
              "px-2 py-0.5 text-xs rounded-sm transition-colors",
              mode === "weekly"
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Weekly
          </button>
          <button
            onClick={() => setMode("monthly")}
            className={cn(
              "px-2 py-0.5 text-xs rounded-sm transition-colors",
              mode === "monthly"
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-0">
          {/* Section labels column */}
          <div className="flex flex-col shrink-0">
            {/* Spacer for date row */}
            <div className="h-4" />
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "h-[14px] flex items-center pr-2 text-xs leading-none font-medium whitespace-nowrap",
                  row.isChild && "pl-2"
                )}
              >
                {row.label}
              </div>
            ))}
          </div>

          {/* Grid of status cells */}
          <div className="flex flex-col">
            {/* Date range labels */}
            <div className="flex items-center h-4">
              <span className="text-[10px] text-muted-foreground">
                {firstLabel}
              </span>
              <span className="flex-1" />
              <span className="text-[10px] text-muted-foreground">
                {lastLabel}
              </span>
            </div>

            {/* Rows */}
            {rows.map((row) => (
              <div key={row.id} className="flex">
                {columns.map((col, colIdx) => {
                  const status =
                    statusMap[row.id]?.[col] ?? (0 as SectionStatus);
                  return (
                    <div
                      key={col}
                      className={cn(
                        "w-[14px] h-[14px] shrink-0",
                        colIdx === 0 && "rounded-l-[2px]",
                        colIdx === columns.length - 1 && "rounded-r-[2px]"
                      )}
                      style={{
                        backgroundColor: SECTION_STATUS_HEX_COLORS[status],
                      }}
                      title={`${row.label}: ${SECTION_STATUS_LABELS[status]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
