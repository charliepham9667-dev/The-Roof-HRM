import { useMemo, useState } from "react"
import { differenceInCalendarDays, endOfMonth } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  FinancePill,
  formatCompactVnd,
  formatVnd,
} from "@/components/finance/finance-ui"
import { startOfDay } from "date-fns"
import {
  categoryLabel,
  dueUrgency,
  formatDueRelative,
  RUNWAY_FLOOR_DAYS,
} from "@/lib/finance-headroom"
import { useFinancialHeadroom, projectAffordability } from "@/hooks/useFinancialHeadroom"
import {
  debtActionForStatus,
  nextStatusForAction,
  useUpdateDebtItemStatus,
} from "@/hooks/useFinanceSupplierDebtItems"
import type { FinanceSupplierDebtItem } from "@/hooks/useFinanceSupplierDebtItems"

const DEFAULT_PURCHASE = 85_000_000

export function UnifiedHeadroomPanel() {
  const headroom = useFinancialHeadroom()
  const updateStatus = useUpdateDebtItemStatus()
  const [purchaseInput, setPurchaseInput] = useState(String(DEFAULT_PURCHASE / 1_000_000))

  const purchaseAmount = useMemo(() => {
    const n = Number(purchaseInput.replace(/[^0-9.]/g, ""))
    return Number.isFinite(n) ? n * 1_000_000 : 0
  }, [purchaseInput])

  const today = startOfDay(new Date())
  const debtDueSoon = useMemo(() => {
    return headroom.debtItems
      .filter((i) => {
        const u = dueUrgency(i.due_date, today)
        return u === "today" || u === "overdue" || u === "soon"
      })
      .reduce((s, i) => s + Number(i.amount_vnd), 0)
  }, [headroom.debtItems, today])

  const daysLeftInMonth = differenceInCalendarDays(endOfMonth(today), today)
  const avgDailyNet = headroom.cashFlow.weekSummary.netTotal / 7
  const projectedNet = avgDailyNet * daysLeftInMonth

  const { endOfMonthFcf } = projectAffordability({
    liquidity: headroom.liquidity,
    debtDueToday: debtDueSoon,
    purchaseAmount,
    projectedNetRemaining: projectedNet,
  })

  const runwayAfter = headroom.avgDailyBurn > 0 ? Math.round(endOfMonthFcf / headroom.avgDailyBurn) : null
  const isSafe = endOfMonthFcf > 0 && (runwayAfter == null || runwayAfter >= RUNWAY_FLOOR_DAYS)

  const handleAction = async (item: FinanceSupplierDebtItem) => {
    await updateStatus.mutateAsync({
      id: item.id,
      status: nextStatusForAction(item.status),
    })
  }

  const pendingCount = headroom.topDue.filter((i) => i.status === "pending").length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
      <div className="space-y-3">
        <div className="rounded-card border border-border bg-card p-5 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#C74C3C] mb-2">
            This week&apos;s money story
          </p>
          <p className="text-lg leading-relaxed text-foreground">{headroom.narrative}</p>
          {headroom.cashFlow.events.length > 0 && (
            <p className="text-sm text-muted-foreground mt-3">
              Recent events:{" "}
              {headroom.cashFlow.events.map((e) => `${e.label} (−${formatCompactVnd(e.amount)})`).join(" · ")}
            </p>
          )}
        </div>

        <div className="rounded-card border border-[#6C2B29]/15 bg-[#FAF4EF] p-5">
          <FinancePill tone="burg">Can I afford…</FinancePill>
          <h3 className="text-xl font-semibold text-foreground mt-2">
            … this purchase, this month?
          </h3>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="purchase-m">Amount (M đ)</Label>
              <Input
                id="purchase-m"
                value={purchaseInput}
                onChange={(e) => setPurchaseInput(e.target.value)}
                className="bg-white"
              />
            </div>
            <span className="text-sm text-muted-foreground pb-2">= {formatVnd(purchaseAmount)}</span>
          </div>

          <div className="mt-4 rounded-lg bg-white p-3 text-sm space-y-1">
            <Row label="Today's liquidity" value={formatVnd(headroom.liquidity)} />
            <Row label="− Near-term debt due" value={`−${formatVnd(debtDueSoon)}`} negative />
            <Row label="− Purchase" value={`−${formatVnd(purchaseAmount)}`} negative />
            <Row
              label={`+ Projected net (${daysLeftInMonth}d)`}
              value={`+${formatVnd(Math.max(0, projectedNet))}`}
              positive
            />
            <div className="border-t border-border pt-2 flex justify-between font-semibold">
              <span>End-of-month free cash</span>
              <span className={isSafe ? "text-success" : "text-destructive"}>
                {formatVnd(endOfMonthFcf)}
              </span>
            </div>
          </div>

          <div
            className={`mt-3 rounded-lg p-3 text-sm ${
              isSafe ? "bg-success/10 text-[#14532D]" : "bg-warning/15 text-warning"
            }`}
          >
            {isSafe ? (
              <>
                <strong>Yes, comfortably.</strong>{" "}
                {runwayAfter != null &&
                  `Runway ~${headroom.runwayDays}→${runwayAfter} days after purchase. `}
                Safe above your {RUNWAY_FLOOR_DAYS}-day floor.
              </>
            ) : (
              <>
                <strong>Tight.</strong> This purchase would push headroom below your comfort zone.
                Consider timing after larger inflows or deferring approved payments.
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-card p-4 shadow-card">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h3 className="text-lg font-semibold">Next 5 due</h3>
          {pendingCount > 0 && (
            <FinancePill tone="warn">{pendingCount} pending payment</FinancePill>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">Action queue · ordered by urgency</p>
        {headroom.topDue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No open debt items.</p>
        ) : (
          <ul className="divide-y divide-border">
            {headroom.topDue.map((d) => {
              const urgency = dueUrgency(d.due_date, today)
              return (
                <li key={d.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{d.vendor}</p>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabel(d.category)} ·{" "}
                      <span
                        className={
                          urgency === "today" || urgency === "overdue"
                            ? "text-[#6C2B29] font-semibold"
                            : urgency === "soon"
                              ? "text-warning font-medium"
                              : ""
                        }
                      >
                        {formatDueRelative(d.due_date, today)}
                      </span>
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums shrink-0">
                    {formatCompactVnd(Number(d.amount_vnd))}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs shrink-0"
                    onClick={() => handleAction(d)}
                    disabled={updateStatus.isPending || d.status === "paid" || d.status === "stopped"}
                  >
                    {debtActionForStatus(d.status) ?? "—"}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  negative,
  positive,
}: {
  label: string
  value: string
  negative?: boolean
  positive?: boolean
}) {
  return (
    <div className="flex justify-between py-0.5">
      <span>{label}</span>
      <span
        className={`font-mono font-medium ${
          negative ? "text-[#6C2B29]" : positive ? "text-success" : ""
        }`}
      >
        {value}
      </span>
    </div>
  )
}

export default UnifiedHeadroomPanel
