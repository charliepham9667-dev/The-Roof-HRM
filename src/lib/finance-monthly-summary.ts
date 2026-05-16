/** Aggregations for Monthly Performance footer (any window — rows is whatever period is selected). */

export type MonthlyRow = {
  month: string
  monthKey: string
  actualRevenue: number
  lastYearRevenue: number
  targetRevenue: number
  isPartialMonth?: boolean
}

export type MonthlyPerformanceSummary = {
  /** Total revenue for all rows (label adapts to the selected period in the UI). */
  sixMoRevenue: number
  sixMoVsPriorPct: number | null
  avgPerMonth: number
  avgTarget: number
  bestMonth: { month: string; revenue: number }
  targetsHit: number
  targetsTotal: number
  closestMiss: { month: string; gapPct: number } | null
}

export function summarizeMonthlyPerformance(rows: MonthlyRow[]): MonthlyPerformanceSummary {
  if (rows.length === 0) {
    return {
      sixMoRevenue: 0,
      sixMoVsPriorPct: null,
      avgPerMonth: 0,
      avgTarget: 0,
      bestMonth: { month: "—", revenue: 0 },
      targetsHit: 0,
      targetsTotal: 0,
      closestMiss: null,
    }
  }

  const sixMoRevenue = rows.reduce((s, r) => s + r.actualRevenue, 0)
  const priorSixMo = rows.reduce((s, r) => s + r.lastYearRevenue, 0)
  const sixMoVsPriorPct =
    priorSixMo > 0 ? Math.round(((sixMoRevenue - priorSixMo) / priorSixMo) * 100) : null

  const n = rows.length
  const avgPerMonth = sixMoRevenue / n
  const avgTarget = rows.reduce((s, r) => s + r.targetRevenue, 0) / n

  const best = rows.reduce((a, b) => (b.actualRevenue > a.actualRevenue ? b : a), rows[0])

  const completed = rows.filter((r) => !r.isPartialMonth)
  const targetsTotal = completed.length || n
  const targetsHit = completed.filter((r) => r.targetRevenue > 0 && r.actualRevenue >= r.targetRevenue).length

  let closestMiss: MonthlyPerformanceSummary["closestMiss"] = null
  for (const r of completed) {
    if (r.targetRevenue <= 0 || r.actualRevenue >= r.targetRevenue) continue
    const gapPct = Math.round(((r.actualRevenue - r.targetRevenue) / r.targetRevenue) * 100)
    if (!closestMiss || gapPct > closestMiss.gapPct) {
      closestMiss = { month: r.month, gapPct }
    }
  }

  return {
    sixMoRevenue,
    sixMoVsPriorPct,
    avgPerMonth,
    avgTarget,
    bestMonth: { month: best.month, revenue: best.actualRevenue },
    targetsHit,
    targetsTotal,
    closestMiss,
  }
}

export function formatSummaryVnd(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B đ`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M đ`
  return `${Math.round(value).toLocaleString()} đ`
}

export function formatSummaryM(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  return `${(value / 1_000_000).toFixed(2)}M`
}
