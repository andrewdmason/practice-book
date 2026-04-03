"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/lib/timer-utils";
import type { PieceWeeklyCumulativeData } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as PieceWeeklyCumulativeData & { cumulativeHours: number; completionPct?: number };
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">Week of {label}</p>
      <p className="text-muted-foreground">
        This week: {formatMinutes(item.weekSeconds)}
      </p>
      <p className="text-muted-foreground">
        Total: {formatMinutes(item.cumulativeSeconds)}
      </p>
      {item.completionPct != null && (
        <p className="text-muted-foreground">
          Completion: {item.completionPct}%
        </p>
      )}
    </div>
  );
}

type PieceCumulativeChartProps = {
  data: PieceWeeklyCumulativeData[];
};

export function PieceCumulativeChart({ data }: PieceCumulativeChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [chartColor, setChartColor] = useState("oklch(0.45 0.08 35)");
  const [completionColor, setCompletionColor] = useState("oklch(0.55 0.15 145)");

  useEffect(() => {
    if (ref.current) {
      const style = getComputedStyle(ref.current);
      const color = style.getPropertyValue("--chart-2").trim();
      if (color) setChartColor(color);
      const color4 = style.getPropertyValue("--chart-4").trim();
      if (color4) setCompletionColor(color4);
    }
  }, []);

  if (data.length === 0) return null;

  const hasCompletion = data.some((d) => d.completionPct != null && d.completionPct > 0);

  const chartData = data.map((d) => ({
    ...d,
    cumulativeHours: Math.round((d.cumulativeSeconds / 3600) * 10) / 10,
  }));

  return (
    <Card ref={ref}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Practice Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="pieceCumulativeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              opacity={0.5}
            />
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="hours"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}h`}
              width={40}
            />
            {hasCompletion && (
              <YAxis
                yAxisId="pct"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                width={45}
              />
            )}
            <Tooltip
              content={CustomTooltip}
              cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
            />
            <Area
              yAxisId="hours"
              type="monotone"
              dataKey="cumulativeHours"
              stroke={chartColor}
              strokeWidth={2}
              fill="url(#pieceCumulativeFill)"
            />
            {hasCompletion && (
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="completionPct"
                stroke={completionColor}
                strokeWidth={2}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
