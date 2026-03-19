"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2Icon } from "lucide-react";
import { formatMinutes } from "@/lib/timer-utils";
import { getPieceBreakdownData } from "@/app/(app)/reports/actions";
import type { PieceBreakdownData } from "@/lib/types";

const CHART_VAR_NAMES = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

type Range = "7d" | "30d" | "90d" | "all";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as PieceBreakdownData;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{item.label}</p>
      <p className="text-muted-foreground">{formatMinutes(item.totalSeconds)}</p>
    </div>
  );
}

type PieceBreakdownProps = {
  initialData: PieceBreakdownData[];
};

export function PieceBreakdown({ initialData }: PieceBreakdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState(initialData);
  const [range, setRange] = useState<Range>("30d");
  const [isPending, startTransition] = useTransition();
  const [chartColors, setChartColors] = useState<string[]>([]);

  useEffect(() => {
    if (ref.current) {
      const style = getComputedStyle(ref.current);
      setChartColors(
        CHART_VAR_NAMES.map(
          (name) => style.getPropertyValue(name).trim() || "oklch(0.45 0.08 35)"
        )
      );
    }
  }, []);

  const handleRangeChange = (newRange: string | null) => {
    if (!newRange) return;
    const r = newRange as Range;
    setRange(r);
    startTransition(async () => {
      const result = await getPieceBreakdownData(r);
      setData(result);
    });
  };

  const hasData = data.length > 0;
  const chartHeight = Math.max(200, data.length * 40 + 40);

  return (
    <Card ref={ref}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Time by Piece</CardTitle>
          <div className="flex items-center gap-2">
            {isPending && (
              <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
            )}
            <Select value={range} onValueChange={handleRangeChange}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatMinutes(v)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={140}
              />
              <Tooltip content={CustomTooltip} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Bar dataKey="totalSeconds" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={chartColors[i % chartColors.length] || "oklch(0.45 0.08 35)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No practice data for this time range.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
