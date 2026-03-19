"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/lib/timer-utils";
import type { WeeklyPracticeData } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const seconds = payload[0].value ?? 0;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{formatMinutes(seconds)}</p>
    </div>
  );
}

type WeeklyChartProps = {
  data: WeeklyPracticeData[];
};

export function WeeklyChart({ data }: WeeklyChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [chartColor, setChartColor] = useState("oklch(0.45 0.08 35)");

  useEffect(() => {
    if (ref.current) {
      const style = getComputedStyle(ref.current);
      const color = style.getPropertyValue("--chart-1").trim();
      if (color) setChartColor(color);
    }
  }, []);

  const hasData = data.some((d) => d.totalSeconds > 0);

  // Convert to hours for Y-axis
  const chartData = data.map((d) => ({
    ...d,
    hours: Math.round((d.totalSeconds / 3600) * 10) / 10,
  }));

  return (
    <Card ref={ref}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Weekly Practice</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}h`}
                width={40}
              />
              <Tooltip
                content={CustomTooltip}
                cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
              />
              <Bar
                dataKey="totalSeconds"
                fill={chartColor}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No practice data yet. Start the timer to see your weekly trends!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
