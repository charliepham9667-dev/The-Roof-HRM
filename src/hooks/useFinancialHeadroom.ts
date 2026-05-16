import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import {
  computeFreeCashFlow,
  computeRunwayDays,
  formatCompactVnd,
  mostRecentFridayIso,
} from "@/lib/finance-headroom"
import { useLatestCashPosition, useCashPositionHistory } from "@/hooks/useFinanceCashPosition"
import { useLatestSupplierDebt, useSupplierDebtHistory } from "@/hooks/useFinanceSupplierDebt"
import { useSupplierDebtItems } from "@/hooks/useFinanceSupplierDebtItems"
import { useCashFlowSeries } from "@/hooks/useCashFlowSeries"

export function useFinancialHeadroom() {
  const { data: latestCash, isLoading: cashLoading } = useLatestCashPosition()
  const { data: cashHistory = [] } = useCashPositionHistory(12)
  const { data: debtItems = [], isLoading: itemsLoading } = useSupplierDebtItems()
  const { data: latestWeeklyDebt } = useLatestSupplierDebt()
  const { data: debtHistory = [] } = useSupplierDebtHistory(4)
  const cashFlow = useCashFlowSeries()

  const liquidity = Number(latestCash?.total_vnd ?? 0)
  const lineItemDebt = debtItems.reduce((s, i) => s + Number(i.amount_vnd), 0)
  const debt =
    lineItemDebt > 0 ? lineItemDebt : Number(latestWeeklyDebt?.total_debt_vnd ?? 0)

  const freeCashFlow = computeFreeCashFlow(liquidity, debt)
  const avgDailyBurn =
    cashFlow.weekSummary.outTotal > 0
      ? cashFlow.weekSummary.outTotal / 7
      : 47_000_000
  const runwayDays = computeRunwayDays(freeCashFlow, avgDailyBurn)

  const priorFridayCash = cashHistory[1]
  const priorFridayDebt = debtHistory[1]
  const prevLiquidity = Number(priorFridayCash?.total_vnd ?? liquidity)
  const prevDebt = Number(priorFridayDebt?.total_debt_vnd ?? debt)
  const prevFcf = computeFreeCashFlow(prevLiquidity, prevDebt)
  const fcfDelta = freeCashFlow - prevFcf
  const fcfWowPct = prevFcf !== 0 ? (fcfDelta / Math.abs(prevFcf)) * 100 : null

  const liquidityDelta = liquidity - prevLiquidity
  const debtDelta = debt - prevDebt

  const narrative = useMemo(() => {
    const parts: string[] = []
    if (liquidityDelta !== 0) {
      parts.push(
        `Liquidity ${liquidityDelta < 0 ? "dropped" : "rose"} ${formatCompactVnd(Math.abs(liquidityDelta))} since last Friday.`,
      )
    }
    if (debtDelta !== 0) {
      parts.push(
        `Supplier debt ${debtDelta < 0 ? "fell" : "rose"} ${formatCompactVnd(Math.abs(debtDelta))} over the same period.`,
      )
    }
    parts.push(
      `Free cash flow is ${formatCompactVnd(freeCashFlow)}${runwayDays != null ? ` — about ${runwayDays} days of runway` : ""} at current burn.`,
    )
    return parts.join(" ")
  }, [liquidityDelta, debtDelta, freeCashFlow, runwayDays])

  const topDue = useMemo(() => {
    return [...debtItems]
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5)
  }, [debtItems])

  const asOfLabel = latestCash?.report_date
    ? `As of ${format(parseISO(latestCash.report_date), "MMM d")}`
    : "No snapshot yet"

  const fridayIso = mostRecentFridayIso()

  return {
    liquidity,
    debt,
    freeCashFlow,
    runwayDays,
    avgDailyBurn,
    fcfDelta,
    fcfWowPct,
    liquidityDelta,
    debtDelta,
    narrative,
    topDue,
    debtItems,
    latestCash,
    asOfLabel,
    fridayIso,
    vendorCount: debtItems.length,
    cashFlow,
    isLoading: cashLoading || itemsLoading,
    isSafeRunway: runwayDays != null && runwayDays >= 30,
  }
}

export function projectAffordability(input: {
  liquidity: number
  debtDueToday: number
  purchaseAmount: number
  projectedNetRemaining: number
}) {
  const endOfMonthFcf =
    input.liquidity - input.debtDueToday - input.purchaseAmount + input.projectedNetRemaining
  return { endOfMonthFcf }
}
