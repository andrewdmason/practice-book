"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMinutes } from "@/lib/timer-utils";
import { getWeeklyPracticeData } from "@/app/practice/reports/actions";
import type { WeeklyPracticeData } from "@/lib/types";

const STORAGE_KEY = "weeklyChart:weekStartDay";

const DAY_OPTIONS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
] as const;

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

export function WeeklyChart({ data: initialData }: WeeklyChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [chartColor, setChartColor] = useState("oklch(0.45 0.08 35)");
  const [weekStartDay, setWeekStartDay] = useState("1");
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (ref.current) {
      const style = getComputedStyle(ref.current);
      const color = style.getPropertyValue("--chart-1").trim();
      if (color) setChartColor(color);
    }
  }, []);

  // Load saved preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null && DAY_OPTIONS.some((d) => d.value === saved)) {
      setWeekStartDay(saved);
      if (saved !== "1") {
        startTransition(async () => {
          const newData = await getWeeklyPracticeData(Number(saved));
          setData(newData);
        });
      }
    }
  }, []);

  function handleDayChange(value: string | null) {
    if (!value) return;
    setWeekStartDay(value);
    localStorage.setItem(STORAGE_KEY, value);
    startTransition(async () => {
      const newData = await getWeeklyPracticeData(Number(value));
      setData(newData);
    });
  }

  const hasData = data.some((d) => d.totalSeconds > 0);

  // Convert to hours for Y-axis
  const chartData = data.map((d) => ({
    ...d,
    hours: Math.round((d.totalSeconds / 3600) * 10) / 10,
  }));

  return (
    <Card ref={ref}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Weekly Practice</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Weeks start</span>
            <Select value={weekStartDay} onValueChange={handleDayChange}>
              <SelectTrigger className="h-7 w-[70px] text-xs">
                <SelectValue>
                  {DAY_OPTIONS.find((d) => d.value === weekStartDay)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value} className="text-xs">
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className={isPending ? "opacity-50 transition-opacity" : ""}>
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
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No practice data yet. Start the timer to see your weekly trends!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
