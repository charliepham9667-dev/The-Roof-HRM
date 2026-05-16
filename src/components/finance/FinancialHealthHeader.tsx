import { formatCompactVnd, MiniSparkline } from "@/components/finance/finance-ui"
import { FinanceKpiCard, FinancePill } from "@/components/finance/finance-ui"
import { FINANCE_FLOW_COLORS } from "@/lib/chart-colors"
import { useFinancialHeadroom } from "@/hooks/useFinancialHeadroom"
import { RUNWAY_FLOOR_DAYS } from "@/lib/finance-headroom"

function formatBillions(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  return formatCompactVnd(n).replace(" đ", "")
}

export function FinancialHealthHeader() {
  const {
    liquidity,
    debt,
    freeCashFlow,
    runwayDays,
    fcfWowPct,
    liquidityDelta,
    debtDelta,
    asOfLabel,
    vendorCount,
    cashFlow,
    isLoading,
  } = useFinancialHeadroom()

  const liquiditySpark = cashFlow.weekSummary.last7.map((d) => d.liquidity)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-card bg-muted" />
        ))}
      </div>
    )
  }

  const liquidityFooter =
    liquidityDelta !== 0 ? (
      <span className={liquidityDelta < 0 ? "text-destructive" : "text-success"}>
        {liquidityDelta > 0 ? "↑" : "↓"} {formatCompactVnd(Math.abs(liquidityDelta))} vs last Fri
      </span>
    ) : (
      "No prior snapshot"
    )

  const debtFooter =
    debtDelta !== 0 ? (
      <span className={debtDelta < 0 ? "text-success" : "text-destructive"}>
        {debtDelta > 0 ? "↑" : "↓"} {formatCompactVnd(Math.abs(debtDelta))} vs last Fri
      </span>
    ) : (
      "Weekly snapshot"
    )

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr] gap-3 mb-4">
      <FinanceKpiCard
        label="Total liquidity"
        sublabel="Bank + cash on hand · same as chart green bars"
        value={`${formatBillions(liquidity)} đ`}
        pill={<FinancePill tone="info">{asOfLabel}</FinancePill>}
        footer={
          <div className="space-y-1.5">
            {liquidityFooter}
            {liquiditySpark.some((v) => v > 0) && (
              <MiniSparkline data={liquiditySpark} color={FINANCE_FLOW_COLORS.cashOnHand} />
            )}
          </div>
        }
      />
      <FinanceKpiCard
        label="Supplier Liabilities"
        sublabel="Total outstanding debt"
        value={`${formatCompactVnd(debt)}`}
        pill={
          vendorCount > 0 ? (
            <FinancePill tone="warn">{vendorCount} vendors</FinancePill>
          ) : (
            <FinancePill tone="neutral">No line items</FinancePill>
          )
        }
        footer={debtFooter}
      />
      <FinanceKpiCard
        label="Free Cash Flow"
        sublabel="Liquidity − Debt · your real headroom"
        value={`${formatBillions(freeCashFlow)} đ`}
        variant="hero"
        pill={
          fcfWowPct != null ? (
            <FinancePill tone="success">
              {fcfWowPct >= 0 ? "+" : ""}
              {fcfWowPct.toFixed(1)}% wow
            </FinancePill>
          ) : undefined
        }
        footer={
          runwayDays != null ? (
            <span className="text-[#3B5C2E]">
              <strong>~{runwayDays} days runway</strong> at current burn · floor {RUNWAY_FLOOR_DAYS}d{" "}
              <FinancePill tone={runwayDays >= RUNWAY_FLOOR_DAYS ? "success" : "warn"} className="ml-1">
                {runwayDays >= RUNWAY_FLOOR_DAYS ? "safe" : "tight"}
              </FinancePill>
            </span>
          ) : (
            "Log snapshots to calculate runway"
          )
        }
      />
    </div>
  )
}
