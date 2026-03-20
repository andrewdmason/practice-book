"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2Icon } from "lucide-react";
import { formatMinutes } from "@/lib/timer-utils";
import { getPieceCumulativeData } from "@/app/(app)/reports/actions";
import type { PieceWeeklyCumulativeData, PieceOption } from "@/lib/types";

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

type PieceProgressProps = {
  pieces: PieceOption[];
  initialPieceId: string | null;
  initialData: PieceWeeklyCumulativeData[];
};

export function PieceProgress({
  pieces,
  initialPieceId,
  initialData,
}: PieceProgressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(
    initialPieceId
  );
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [chartColor, setChartColor] = useState("oklch(0.45 0.08 35)");

  useEffect(() => {
    if (ref.current) {
      const style = getComputedStyle(ref.current);
      const color = style.getPropertyValue("--chart-2").trim();
      if (color) setChartColor(color);
    }
  }, []);

  // Sync from URL changes (e.g. browser back/forward)
  useEffect(() => {
    const urlPiece = searchParams.get("piece");
    if (urlPiece && urlPiece !== selectedPieceId && pieces.some((p) => p.id === urlPiece)) {
      setSelectedPieceId(urlPiece);
      startTransition(async () => {
        const result = await getPieceCumulativeData(urlPiece);
        setData(result);
      });
    }
  }, [searchParams, pieces]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePieceChange = useCallback(
    (pieceId: string | null) => {
      if (!pieceId) return;
      setSelectedPieceId(pieceId);

      // Update URL
      const params = new URLSearchParams(searchParams.toString());
      params.set("piece", pieceId);
      router.replace(`/reports?${params.toString()}`, { scroll: false });

      startTransition(async () => {
        const result = await getPieceCumulativeData(pieceId);
        setData(result);
      });
    },
    [router, searchParams]
  );

  const hasData = data.length > 0;

  // Convert to hours for display
  const chartData = data.map((d) => ({
    ...d,
    cumulativeHours:
      Math.round((d.cumulativeSeconds / 3600) * 10) / 10,
  }));

  return (
    <Card ref={ref}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Piece Progress</CardTitle>
          <div className="flex items-center gap-2">
            {isPending && (
              <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
            )}
            <Select
              value={selectedPieceId ?? ""}
              onValueChange={handlePieceChange}
            >
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="Select a piece…">
                  {selectedPieceId
                    ? pieces.find((p) => p.id === selectedPieceId)?.name ??
                      "Select a piece…"
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {pieces.map((piece) => (
                  <SelectItem key={piece.id} value={piece.id}>
                    {piece.name}
                    {piece.composer ? ` — ${piece.composer}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedPieceId ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Select a piece to see cumulative practice time.
          </p>
        ) : hasData ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="pieceProgressFill" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#pieceProgressFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No practice data for this piece yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
