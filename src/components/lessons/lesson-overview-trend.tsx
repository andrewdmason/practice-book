"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { formatMinutes } from "@/lib/timer-utils";
import type { OverviewTrendPoint } from "@/app/(app)/lessons/stats-actions";

function formatLabel(label: string): string {
  if (label === "Upcoming") return "Upcoming";
  const d = new Date(label + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as OverviewTrendPoint;
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-sm">
      <div className="font-medium">{formatLabel(point.label)}</div>
      <div className="text-muted-foreground tabular-nums">
        {formatMinutes(point.avgPerDaySeconds)}/day
      </div>
      <div className="text-muted-foreground tabular-nums">
        {point.dayCount} day{point.dayCount === 1 ? "" : "s"} · {formatMinutes(point.totalSeconds)}
      </div>
    </div>
  );
}

export function LessonOverviewTrend({ points }: { points: OverviewTrendPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [chartColor, setChartColor] = useState("oklch(0.45 0.08 35)");

  useEffect(() => {
    if (ref.current) {
      const style = getComputedStyle(ref.current);
      const color = style.getPropertyValue("--primary").trim();
      if (color) setChartColor(color);
    }
  }, []);

  if (points.length === 0) return null;

  const data = points.map((p) => ({
    ...p,
    avgMinutes: Math.round((p.avgPerDaySeconds / 60) * 10) / 10,
    shortLabel: formatLabel(p.label),
  }));

  return (
    <div ref={ref}>
      <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        Avg / active day · last {points.length} lesson{points.length === 1 ? "" : "s"}
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis hide domain={[0, "dataMax + 5"]} />
          <Tooltip
            content={CustomTooltip}
            cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="avgMinutes"
            stroke={chartColor}
            strokeWidth={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              const { cx, cy, payload, index } = props;
              const isCurrent = payload?.isCurrent;
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isCurrent ? 4 : 3}
                  fill={chartColor}
                  stroke="var(--color-background)"
                  strokeWidth={isCurrent ? 2 : 1}
                />
              );
            }}
            activeDot={{ r: 5, fill: chartColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
