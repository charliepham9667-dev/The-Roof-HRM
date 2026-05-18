import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns"
import { supabase } from "@/lib/supabase"
import { buildOutflowEventLabel, buildPaidDebtOutflowsByDate } from "@/lib/cash-flow-outflows"
import { formatIsoDateLabel, forwardFillLiquidity, isValidIsoDate, LARGE_OUTFLOW_VND } from "@/lib/finance-headroom"
import { useCashPositionHistory } from "@/hooks/useFinanceCashPosition"
import { useManualCashflowRange } from "@/hooks/useFinanceManualCashflow"

export type CashFlowDay = {
  date: string
  label: string
  inflow: number
  outflow: number
  net: number
  liquidity: number
}

export type CashFlowEvent = {
  date: string
  label: string
  amount: number
}

const RANGE_DAYS = 60

function buildDateRange(endIso: string, days: number): string[] {
  if (!isValidIsoDate(endIso)) {
    endIso = new Date().toISOString().slice(0, 10)
  }
  const end = parseISO(endIso)
  const start = subDays(end, days - 1)
  return eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"))
}

/** Cash in/out through today; liquidity line still uses cash snapshot history. */
export function useCashFlowSeries() {
  const todayIso = new Date().toISOString().slice(0, 10)
  const dates = useMemo(() => buildDateRange(todayIso, RANGE_DAYS), [todayIso])
  const rangeStart = dates[0]
  const rangeEnd = dates[dates.length - 1]

  const { data: cashHistory = [] } = useCashPositionHistory(120)

  const revenueQuery = useQuery({
    queryKey: ["cash-flow-revenue", dates[0], dates[dates.length - 1]],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_metrics")
        .select("date, revenue")
        .gte("date", dates[0])
        .lte("date", dates[dates.length - 1])
        .order("date", { ascending: true })
      if (error) throw error
      return (data ?? []) as { date: string; revenue: number }[]
    },
  })

  const paidDebtQuery = useQuery({
    queryKey: ["cash-flow-paid-debt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_supplier_debt_items")
        .select("amount_vnd,paid_at,due_date,updated_at,category,vendor")
        .eq("status", "paid")
      if (error) throw error
      return (data ?? []) as {
        amount_vnd: number
        paid_at: string | null
        due_date: string
        updated_at: string
        category: string | null
        vendor: string | null
      }[]
    },
  })

  const { data: manualEntries = [] } = useManualCashflowRange(rangeStart, rangeEnd)

  const series = useMemo((): CashFlowDay[] => {
    const revenueByDate = new Map(
      (revenueQuery.data ?? []).map((r) => [r.date, Number(r.revenue) || 0]),
    )

    // Debt-tracker paid items → outflows
    const outflowByDate = buildPaidDebtOutflowsByDate(paidDebtQuery.data ?? [])

    // Manual log entries → add to inflow or outflow
    for (const entry of manualEntries) {
      const date = entry.flow_date.slice(0, 10)
      const amt = Number(entry.amount_vnd) || 0
      if (!date || amt <= 0) continue
      if (entry.direction === "out") {
        outflowByDate.set(date, (outflowByDate.get(date) ?? 0) + amt)
      } else {
        revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + amt)
      }
    }

    const snapshots = cashHistory.map((c) => ({
      report_date: c.report_date,
      total_vnd: Number(c.total_vnd),
    }))
    const liquiditySeries = forwardFillLiquidity(dates, snapshots)

    return dates.map((date, i) => {
      const inflow = revenueByDate.get(date) ?? 0
      const outflow = outflowByDate.get(date) ?? 0
      return {
        date,
        label: formatIsoDateLabel(date, "MMM d", date.slice(5)),
        inflow,
        outflow,
        net: inflow - outflow,
        liquidity: liquiditySeries[i],
      }
    })
  }, [cashHistory, dates, paidDebtQuery.data, revenueQuery.data, manualEntries])

  const weekSummary = useMemo(() => {
    const last7 = series.slice(-7)
    const inTotal = last7.reduce((s, d) => s + d.inflow, 0)
    const outTotal = last7.reduce((s, d) => s + d.outflow, 0)
    const prev7 = series.slice(-14, -7)
    const prevNet = prev7.reduce((s, d) => s + d.net, 0)
    const netTotal = inTotal - outTotal
    const wowPct = prevNet !== 0 ? ((netTotal - prevNet) / Math.abs(prevNet)) * 100 : null
    return { inTotal, outTotal, netTotal, wowPct, last7 }
  }, [series])

  const events = useMemo((): CashFlowEvent[] => {
    const paidRows = paidDebtQuery.data ?? []
    const found: CashFlowEvent[] = []
    for (const day of series) {
      if (day.outflow >= LARGE_OUTFLOW_VND) {
        // Build label: prefer debt-item categories; fall back to manual entry descriptions
        let label = buildOutflowEventLabel(paidRows, day.date)
        if (label === "Cash out") {
          // No debt items on this day — check manual entries
          const dayManual = manualEntries.filter(
            (e) => e.flow_date.slice(0, 10) === day.date && e.direction === "out",
          )
          if (dayManual.length > 0) {
            const desc = dayManual[0].description || dayManual[0].category
            label = dayManual.length === 1 ? desc : `${desc} +${dayManual.length - 1}`
          }
        }
        found.push({ date: day.date, label, amount: day.outflow })
      }
    }
    return found.slice(-4)
  }, [series, paidDebtQuery.data, manualEntries])

  const hasPaidDebtData = (paidDebtQuery.data?.length ?? 0) > 0
  const hasRevenueData = (revenueQuery.data?.length ?? 0) > 0
  const hasLiquidityData = cashHistory.some((c) => Number(c.total_vnd) > 0)

  const liquidityDeltaWeek = useMemo(() => {
    const last7 = series.slice(-7)
    if (last7.length < 2) return null
    const start = last7.find((d) => d.liquidity > 0)?.liquidity ?? last7[0].liquidity
    const end = last7[last7.length - 1].liquidity
    return end - start
  }, [series])

  return {
    series,
    events,
    weekSummary,
    liquidityDeltaWeek,
    rangeLabel:
      series.length > 0
        ? `${series[0].label} – ${series[series.length - 1].label}`
        : "",
    isLoading: paidDebtQuery.isLoading,
    hasPaidDebtData,
    hasRevenueData,
    hasLiquidityData,
  }
}
