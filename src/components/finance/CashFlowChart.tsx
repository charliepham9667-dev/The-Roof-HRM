import { Link } from "react-router-dom"
import { Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts"
import { Loader2 } from "lucide-react"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { FINANCE_FLOW_COLORS } from "@/lib/chart-colors"
import type { CashFlowDay, CashFlowEvent } from "@/hooks/useCashFlowSeries"
import { formatCompactVnd } from "@/components/finance/finance-ui"
import { formatIsoDateLabel, isValidIsoDate } from "@/lib/finance-headroom"

const chartConfig = {
  cashOnHandB: { label: "Total liquidity", color: FINANCE_FLOW_COLORS.cashOnHand },
  outflowB: { label: "Cash out", color: FINANCE_FLOW_COLORS.cashOut },
} satisfies ChartConfig

type Props = {
  series: CashFlowDay[]
  events: CashFlowEvent[]
  rangeLabel: string
  isLoading?: boolean
  hasLiquidityData?: boolean
  hasPaidDebtData?: boolean
}

export function CashFlowChart({
  series,
  events,
  rangeLabel,
  isLoading,
  hasLiquidityData,
  hasPaidDebtData,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading cash position…
      </div>
    )
  }

  const hasOutflow = series.some((d) => d.outflow > 0)
  const hasCashOnHand = series.some((d) => d.liquidity > 0)
  if (!hasLiquidityData && !hasCashOnHand && !hasOutflow) {
    return (
      <div className="rounded-sm border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        <p>No cash-on-hand data for this period.</p>
        <p className="mt-1 text-xs">
          Import your THE ROOF daily cash spreadsheet or log a Friday snapshot.
        </p>
        <p className="mt-1 text-xs">
          Red bars appear on dates you mark suppliers paid in the Debt Tracker.
          {!hasPaidDebtData && (
            <>
              {" "}
              <Link to="/finance/summary?tab=debt" className="text-primary underline">
                Open Debt Tracker
              </Link>
            </>
          )}
        </p>
      </div>
    )
  }

  const chartData = series.map((d) => ({
    ...d,
    cashOnHandB: d.liquidity > 0 ? d.liquidity / 1_000_000_000 : null,
    outflowB: d.outflow > 0 ? d.outflow / 1_000_000_000 : null,
  }))

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Total liquidity · {rangeLabel}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Green = total liquidity (bank + cash) · Red = cash out from Debt Tracker
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: FINANCE_FLOW_COLORS.cashOnHand }}
            />
            Total liquidity
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: FINANCE_FLOW_COLORS.cashOut }}
            />
            Cash out
          </span>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[260px] w-full">
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="18%"
          barGap={4}
        >
          <CartesianGrid strokeDasharray="2 3" vertical={false} stroke={FINANCE_FLOW_COLORS.outflow + "20"} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${v}B`}
            width={40}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  const vnd = Number(value) * 1_000_000_000
                  if (name === "cashOnHandB") {
                    return [formatCompactVnd(vnd), "Total liquidity"]
                  }
                  return [formatCompactVnd(vnd), "Cash out"]
                }}
              />
            }
          />
          <Bar
            dataKey="cashOnHandB"
            fill={FINANCE_FLOW_COLORS.cashOnHand}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
            name="cashOnHandB"
          />
          <Bar
            dataKey="outflowB"
            fill={FINANCE_FLOW_COLORS.cashOut}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
            name="outflowB"
          />
        </ComposedChart>
      </ChartContainer>

      {events.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">
          {events.map((e) => (
            <span key={e.date + e.label}>
              <span style={{ color: FINANCE_FLOW_COLORS.cashOut }}>●</span> {e.label} ·{" "}
              {isValidIsoDate(e.date) ? formatIsoDateLabel(e.date, "MMM d") : e.date} · −
              {formatCompactVnd(e.amount)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
