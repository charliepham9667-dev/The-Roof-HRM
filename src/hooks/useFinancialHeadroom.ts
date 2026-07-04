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
import { useLoansReceivableSummary } from "@/hooks/useFinanceLoansReceivable"

export function useFinancialHeadroom() {
  const { data: latestCash, isLoading: cashLoading } = useLatestCashPosition()
  const { data: cashHistory = [] } = useCashPositionHistory(12)
  const { data: debtItems = [], isLoading: itemsLoading } = useSupplierDebtItems()
  const { data: latestWeeklyDebt } = useLatestSupplierDebt()
  const { data: debtHistory = [] } = useSupplierDebtHistory(4)
  const cashFlow = useCashFlowSeries()
  const loans = useLoansReceivableSummary()

  const liquidity = Number(latestCash?.total_vnd ?? 0)
  const lineItemDebt = debtItems.reduce((s, i) => s + Number(i.amount_vnd), 0)
  // Only fall back to the weekly snapshot when it was manually entered as a debt total
  // (payment_channel === 'manual'). Payment-list imports represent payments made, not
  // current outstanding debt, so they should never be used as a debt figure.
  const manualWeeklyDebt =
    latestWeeklyDebt?.payment_channel === "manual"
      ? Number(latestWeeklyDebt.total_debt_vnd)
      : 0
  const debt = lineItemDebt > 0 ? lineItemDebt : manualWeeklyDebt

  const freeCashFlow = computeFreeCashFlow(liquidity, debt)
  const avgDailyBurn =
    cashFlow.weekSummary.outTotal > 0
      ? cashFlow.weekSummary.outTotal / 7
      : 47_000_000
  const runwayDays = computeRunwayDays(freeCashFlow, avgDailyBurn)

  const priorFridayCash = cashHistory[1]
  const priorFridayDebt = debtHistory.find((d) => d.payment_channel === "manual")
  const prevLiquidity = Number(priorFridayCash?.total_vnd ?? liquidity)
  const prevDebt = priorFridayDebt != null ? Number(priorFridayDebt.total_debt_vnd) : debt
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
    if (loans.principalOut > 0) {
      parts.push(
        `${formatCompactVnd(loans.principalOut)} is lent out (loans receivable) — ${formatCompactVnd(loans.expectedBack)} expected back${
          loans.nextDue ? ` by ${format(parseISO(loans.nextDue.maturity_date), "MMM d")}` : ""
        }.`,
      )
    }
    return parts.join(" ")
  }, [liquidityDelta, debtDelta, freeCashFlow, runwayDays, loans.principalOut, loans.expectedBack, loans.nextDue])

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
    loansOutPrincipal: loans.principalOut,
    loansExpectedBack: loans.expectedBack,
    nextLoanDueIso: loans.nextDue?.maturity_date ?? null,
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
