/** Month pace vs daily target — used on Finance Summary KPIs and narrative. */

export type MonthPaceInput = {
  mtdRevenue: number
  monthlyTarget: number
  dayOfMonth: number
  daysInMonth: number
  avgDailyRevenue: number
}

export type MonthPaceResult = {
  /** Revenue expected by end of `dayOfMonth` at even daily pace */
  expectedByNow: number
  /** % ahead/behind pace (e.g. 70 = 70% ahead) */
  paceAheadPercent: number
  /** % of full-month target earned (MTD ÷ target) */
  progressActualPercent: number
  /** % of target the pace line represents (expected ÷ target) */
  progressOnPacePercent: number
  isAheadOfPace: boolean
  dailyTargetPace: number
}

export function computeMonthPace({
  mtdRevenue,
  monthlyTarget,
  dayOfMonth,
  daysInMonth,
}: MonthPaceInput): MonthPaceResult {
  const safeDays = Math.max(daysInMonth, 1)
  const safeDay = Math.max(dayOfMonth, 1)
  const dailyTargetPace = monthlyTarget / safeDays
  const expectedByNow = dailyTargetPace * safeDay
  const paceAheadPercent =
    expectedByNow > 0 ? Math.round((mtdRevenue / expectedByNow - 1) * 100) : 0
  const progressActualPercent =
    monthlyTarget > 0 ? Math.min(100, Math.round((mtdRevenue / monthlyTarget) * 100)) : 0
  const progressOnPacePercent =
    monthlyTarget > 0 ? Math.min(100, Math.round((expectedByNow / monthlyTarget) * 100)) : 0

  return {
    expectedByNow,
    paceAheadPercent,
    progressActualPercent,
    progressOnPacePercent,
    isAheadOfPace: mtdRevenue >= expectedByNow,
    dailyTargetPace,
  }
}

export function formatPaceBadge(paceAheadPercent: number): string {
  if (paceAheadPercent > 0) return `+${paceAheadPercent}% ahead`
  if (paceAheadPercent < 0) return `${paceAheadPercent}% behind`
  return "On pace"
}
