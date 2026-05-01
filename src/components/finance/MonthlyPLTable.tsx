import { useMemo, useState } from "react"
import type { PnlMonthly } from "@/types"
import { usePLData, usePLYears, useDailyRevenueByMonth } from "@/hooks/usePLData"
import { useMonthlyTargetsForYear } from "@/hooks/useExecutiveDashboardInputs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const

function formatVND(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—"
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`
  return `${sign}${abs.toLocaleString()}`
}

function formatPct(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—"
  return `${value.toFixed(1)}%`
}

type RowKind = "currency" | "percent"

interface RowDef {
  label: string
  kind: RowKind
  emphasis?: "section" | "total"
  /** Pull a numeric value out of a single PnlMonthly row. Undefined → empty cell. */
  getValue: (m: PnlMonthly | undefined) => number | undefined
  /** Aggregate across the year for the YTD column. */
  getYtd: (months: PnlMonthly[]) => number | undefined
}

// "Gross Sales" is rendered as a special row in the JSX below so it can
// source from `daily_metrics` (the Sales26 daily POS tracker) — the same
// figure the Total Revenue KPI shows. The hand-maintained
// `pnl_monthly.gross_sales` column lags and would otherwise mislead.
const ROWS: RowDef[] = [
  {
    label: "Net Sales",
    kind: "currency",
    emphasis: "section",
    getValue: (m) => m?.netSales,
    getYtd: (ms) => ms.reduce((sum, m) => sum + (m.netSales ?? 0), 0),
  },
  {
    label: "COGS",
    kind: "currency",
    getValue: (m) => m?.cogs,
    getYtd: (ms) => ms.reduce((sum, m) => sum + (m.cogs ?? 0), 0),
  },
  {
    label: "Gross Profit",
    kind: "currency",
    emphasis: "total",
    getValue: (m) => m?.grossProfit,
    getYtd: (ms) => ms.reduce((sum, m) => sum + (m.grossProfit ?? 0), 0),
  },
  {
    label: "Gross Margin %",
    kind: "percent",
    getValue: (m) => m?.grossMargin,
    getYtd: (ms) => {
      const sales = ms.reduce((s, m) => s + (m.grossSales ?? 0), 0)
      const gp = ms.reduce((s, m) => s + (m.grossProfit ?? 0), 0)
      return sales > 0 ? (gp / sales) * 100 : undefined
    },
  },
  {
    label: "Labor",
    kind: "currency",
    getValue: (m) => m?.laborCost,
    getYtd: (ms) => ms.reduce((sum, m) => sum + (m.laborCost ?? 0), 0),
  },
  {
    label: "Labor %",
    kind: "percent",
    getValue: (m) => m?.laborPercentage,
    getYtd: (ms) => {
      const sales = ms.reduce((s, m) => s + (m.grossSales ?? 0), 0)
      const labor = ms.reduce((s, m) => s + (m.laborCost ?? 0), 0)
      return sales > 0 ? (labor / sales) * 100 : undefined
    },
  },
  {
    label: "Fixed Costs",
    kind: "currency",
    getValue: (m) => m?.fixedCosts,
    getYtd: (ms) => ms.reduce((sum, m) => sum + (m.fixedCosts ?? 0), 0),
  },
  {
    label: "OpEx",
    kind: "currency",
    getValue: (m) => m?.opex,
    getYtd: (ms) => ms.reduce((sum, m) => sum + (m.opex ?? 0), 0),
  },
  {
    label: "EBIT",
    kind: "currency",
    emphasis: "total",
    getValue: (m) => m?.ebit,
    getYtd: (ms) => ms.reduce((sum, m) => sum + (m.ebit ?? 0), 0),
  },
  {
    label: "EBIT %",
    kind: "percent",
    getValue: (m) => m?.ebitMargin,
    getYtd: (ms) => {
      const sales = ms.reduce((s, m) => s + (m.grossSales ?? 0), 0)
      const ebit = ms.reduce((s, m) => s + (m.ebit ?? 0), 0)
      return sales > 0 ? (ebit / sales) * 100 : undefined
    },
  },
]

function formatCell(value: number | undefined, kind: RowKind): string {
  if (value === undefined) return "—"
  return kind === "percent" ? formatPct(value) : formatVND(value)
}

/**
 * 12-month-by-line P&L grid for the selected year. Reads from `pnl_monthly`
 * via `usePLData`. Empty months render as "—" rather than 0 so missing data
 * is visible. Horizontal scroll on small screens (don't try to stack a
 * 14-column finance table — it loses meaning).
 */
export function MonthlyPLTable({ className }: { className?: string }) {
  const { data: years } = usePLYears()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const { data, isLoading, isError, error } = usePLData(selectedYear)
  const { data: targetsByMonth } = useMonthlyTargetsForYear("revenue", selectedYear)
  // Source-of-truth gross revenue from daily POS sync (matches the Total
  // Revenue KPI on Finance Snapshot). Falls back to pnl_monthly.gross_sales
  // when daily data is missing for a month.
  const { data: dailyRevenueByMonth } = useDailyRevenueByMonth(selectedYear)

  const yearsList = useMemo(() => {
    const arr = (years ?? []).filter((y): y is number => typeof y === "number")
    if (!arr.includes(currentYear)) arr.push(currentYear)
    return Array.from(new Set(arr)).sort((a, b) => b - a)
  }, [years, currentYear])

  const monthsByIndex = useMemo(() => {
    const arr: (PnlMonthly | undefined)[] = new Array(12).fill(undefined)
    for (const m of data?.months ?? []) {
      const idx = (m.month ?? 0) - 1
      if (idx >= 0 && idx < 12) arr[idx] = m
    }
    return arr
  }, [data])

  const allMonthsForYtd = useMemo(() => data?.months ?? [], [data])

  return (
    <div className={`rounded-card border border-border bg-card shadow-card ${className ?? ""}`}>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Monthly P&amp;L · {selectedYear}</h3>
          <p className="text-xs text-muted-foreground">
            Full-year view · Gross Sales from daily POS (<code className="rounded bg-muted px-1">daily_metrics</code>); other lines from <code className="rounded bg-muted px-1">pnl_monthly</code>. Empty months show "—".
          </p>
        </div>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearsList.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6 text-sm text-destructive">
          Failed to load P&amp;L data: {(error as Error)?.message ?? "unknown error"}
        </div>
      ) : (data?.months ?? []).length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          No P&amp;L data found for {selectedYear}. Populate the{" "}
          <code className="rounded bg-muted px-1">pnl_monthly</code> table or run the sheet sync.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="sticky left-0 z-10 min-w-[140px] bg-muted/40 px-3 py-2 text-left font-medium">
                  Line
                </th>
                {MONTH_LABELS.map((label) => (
                  <th key={label} className="px-2 py-2 text-right font-medium">
                    {label}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-semibold text-foreground">YTD</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-muted/10 text-muted-foreground">
                <td className="sticky left-0 z-10 bg-muted/10 px-3 py-1.5 text-left font-medium">
                  Target (Revenue)
                </td>
                {Array.from({ length: 12 }).map((_, idx) => {
                  const t = targetsByMonth?.[idx + 1] ?? null
                  return (
                    <td key={idx} className="px-2 py-1.5 text-right tabular-nums">
                      {t == null ? "—" : formatVND(t)}
                    </td>
                  )
                })}
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                  {(() => {
                    if (!targetsByMonth) return "—"
                    const total = Object.values(targetsByMonth).reduce<number>(
                      (s, v) => s + (typeof v === "number" ? v : 0),
                      0,
                    )
                    return total > 0 ? formatVND(total) : "—"
                  })()}
                </td>
              </tr>
              <tr className="border-b border-border text-foreground">
                <td className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left">
                  vs Target %
                </td>
                {monthsByIndex.map((m, idx) => {
                  const month = idx + 1
                  const t = targetsByMonth?.[month]
                  const fromDaily = dailyRevenueByMonth?.[month] ?? null
                  const fromPnl = m?.grossSales
                  const actual =
                    fromDaily != null && fromDaily > 0 ? fromDaily : fromPnl
                  if (!t || !actual) {
                    return (
                      <td key={idx} className="px-2 py-1.5 text-right tabular-nums">
                        —
                      </td>
                    )
                  }
                  const pct = (actual / t) * 100
                  const tone =
                    pct >= 100
                      ? "text-emerald-600"
                      : pct >= 70
                        ? "text-amber-600"
                        : "text-red-600"
                  return (
                    <td key={idx} className={`px-2 py-1.5 text-right tabular-nums font-medium ${tone}`}>
                      {pct.toFixed(0)}%
                    </td>
                  )
                })}
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                  {(() => {
                    let ytdActual = 0
                    let ytdTarget = 0
                    for (let mo = 1; mo <= 12; mo += 1) {
                      const fromDaily = dailyRevenueByMonth?.[mo] ?? null
                      const pnlRow = allMonthsForYtd.find((mm) => mm.month === mo)
                      const fromPnl = pnlRow?.grossSales
                      const actual =
                        fromDaily != null && fromDaily > 0 ? fromDaily : fromPnl
                      const target = targetsByMonth?.[mo]
                      if (typeof actual === "number" && actual > 0 && typeof target === "number" && target > 0) {
                        ytdActual += actual
                        ytdTarget += target
                      }
                    }
                    if (!ytdTarget || !ytdActual) return "—"
                    const pct = (ytdActual / ytdTarget) * 100
                    const tone =
                      pct >= 100
                        ? "text-emerald-600"
                        : pct >= 70
                          ? "text-amber-600"
                          : "text-red-600"
                    return <span className={tone}>{pct.toFixed(0)}%</span>
                  })()}
                </td>
              </tr>
              {ROWS.slice(0, 1).map((row) => {
                const emphasisClass =
                  row.emphasis === "section"
                    ? "bg-muted/20 font-semibold text-foreground"
                    : row.emphasis === "total"
                      ? "border-t border-border font-semibold text-foreground"
                      : "text-foreground"
                return (
                  <tr key={row.label} className={emphasisClass}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left">
                      {row.label}
                    </td>
                    {monthsByIndex.map((m, idx) => (
                      <td key={idx} className="px-2 py-1.5 text-right tabular-nums">
                        {formatCell(row.getValue(m), row.kind)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                      {formatCell(row.getYtd(allMonthsForYtd), row.kind)}
                    </td>
                  </tr>
                )
              })}
              {/* Gross Sales sourced from daily_metrics (Sales26 daily POS),
                  with pnl_monthly.gross_sales as fallback. Keeps this row
                  consistent with the Total Revenue KPI on the same page. */}
              <tr className="text-foreground">
                <td className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left">
                  Gross Sales
                </td>
                {monthsByIndex.map((m, idx) => {
                  const month = idx + 1
                  const fromDaily = dailyRevenueByMonth?.[month] ?? null
                  const fromPnl = m?.grossSales
                  const value =
                    fromDaily != null && fromDaily > 0
                      ? fromDaily
                      : (fromPnl ?? undefined)
                  return (
                    <td key={idx} className="px-2 py-1.5 text-right tabular-nums">
                      {formatCell(value, "currency")}
                    </td>
                  )
                })}
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                  {(() => {
                    let total = 0
                    let any = false
                    for (let mo = 1; mo <= 12; mo += 1) {
                      const fromDaily = dailyRevenueByMonth?.[mo] ?? null
                      const pnlRow = allMonthsForYtd.find((mm) => mm.month === mo)
                      const fromPnl = pnlRow?.grossSales
                      const v =
                        fromDaily != null && fromDaily > 0
                          ? fromDaily
                          : fromPnl
                      if (typeof v === "number" && v > 0) {
                        total += v
                        any = true
                      }
                    }
                    return any ? formatVND(total) : "—"
                  })()}
                </td>
              </tr>
              {ROWS.slice(1).map((row) => {
                const emphasisClass =
                  row.emphasis === "section"
                    ? "bg-muted/20 font-semibold text-foreground"
                    : row.emphasis === "total"
                      ? "border-t border-border font-semibold text-foreground"
                      : "text-foreground"
                return (
                  <tr key={row.label} className={emphasisClass}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left">
                      {row.label}
                    </td>
                    {monthsByIndex.map((m, idx) => (
                      <td key={idx} className="px-2 py-1.5 text-right tabular-nums">
                        {formatCell(row.getValue(m), row.kind)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                      {formatCell(row.getYtd(allMonthsForYtd), row.kind)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
