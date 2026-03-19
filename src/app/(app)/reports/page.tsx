import { WeeklyChart } from "@/components/reports/weekly-chart";
import { PieceBreakdown } from "@/components/reports/piece-breakdown";
import { StreakCard } from "@/components/reports/streak-card";
import {
  getWeeklyPracticeData,
  getPieceBreakdownData,
  getStreakData,
} from "./actions";

export default async function ReportsPage() {
  const [weeklyData, breakdownData, streakData] = await Promise.all([
    getWeeklyPracticeData(),
    getPieceBreakdownData("30d"),
    getStreakData(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <h2 className="text-xl font-semibold tracking-tight mb-4">Reports</h2>
      <div className="space-y-6">
        <StreakCard data={streakData} />
        <WeeklyChart data={weeklyData} />
        <PieceBreakdown initialData={breakdownData} />
      </div>
    </div>
  );
}
