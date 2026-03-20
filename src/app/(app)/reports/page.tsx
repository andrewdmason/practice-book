import { WeeklyChart } from "@/components/reports/weekly-chart";
import { PieceBreakdown } from "@/components/reports/piece-breakdown";
import { PieceProgress } from "@/components/reports/piece-progress";
import { StreakCard } from "@/components/reports/streak-card";
import {
  getWeeklyPracticeData,
  getPieceBreakdownData,
  getStreakData,
  getPiecesWithTimerData,
  getPieceCumulativeData,
} from "./actions";

type Props = {
  searchParams: Promise<{ piece?: string }>;
};

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [weeklyData, breakdownData, streakData, pieces] = await Promise.all([
    getWeeklyPracticeData(),
    getPieceBreakdownData("30d"),
    getStreakData(),
    getPiecesWithTimerData(),
  ]);

  // If a piece is specified in the URL, pre-fetch its data
  const selectedPieceId =
    params.piece && pieces.some((p) => p.id === params.piece)
      ? params.piece
      : null;

  const pieceProgressData = selectedPieceId
    ? await getPieceCumulativeData(selectedPieceId)
    : [];

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <h2 className="text-xl font-semibold tracking-tight mb-4">Reports</h2>
      <div className="space-y-6">
        <StreakCard data={streakData} />
        <WeeklyChart data={weeklyData} />
        <PieceBreakdown initialData={breakdownData} />
        <PieceProgress
          pieces={pieces}
          initialPieceId={selectedPieceId}
          initialData={pieceProgressData}
        />
      </div>
    </div>
  );
}
