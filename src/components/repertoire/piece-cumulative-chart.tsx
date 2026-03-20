"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  const item = payload[0].payload as PieceWeeklyCumulativeData;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">Week of {label}</p>
      <p className="text-muted-foreground">
        This week: {formatMinutes(item.weekSeconds)}
      </p>
      <p className="text-muted-foreground">
        Total: {formatMinutes(item.cumulativeSeconds)}
      </p>
    </div>
  );
}

type PieceCumulativeChartProps = {
  data: PieceWeeklyCumulativeData[];
};

export function PieceCumulativeChart({ data }: PieceCumulativeChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [chartColor, setChartColor] = useState("oklch(0.45 0.08 35)");

  useEffect(() => {
    if (ref.current) {
      const style = getComputedStyle(ref.current);
      const color = style.getPropertyValue("--chart-2").trim();
      if (color) setChartColor(color);
    }
  }, []);

  if (data.length === 0) return null;

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
          <AreaChart data={chartData}>
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
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}h`}
              width={40}
            />
            <Tooltip
              content={CustomTooltip}
              cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="cumulativeHours"
              stroke={chartColor}
              strokeWidth={2}
              fill="url(#pieceCumulativeFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
