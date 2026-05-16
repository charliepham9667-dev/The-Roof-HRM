import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  computeMonthPace,
  formatPaceBadge,
  type MonthPaceInput,
} from "@/lib/finance-pace"

function formatM(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  return `${(value / 1_000_000).toFixed(1)}M`
}

export type MonthPaceCardProps = MonthPaceInput & {
  onEditTarget?: () => void
}

export function MonthPaceCard({
  mtdRevenue,
  monthlyTarget,
  dayOfMonth,
  daysInMonth,
  avgDailyRevenue,
  onEditTarget,
}: MonthPaceCardProps) {
  const pace = computeMonthPace({
    mtdRevenue,
    monthlyTarget,
    dayOfMonth,
    daysInMonth,
    avgDailyRevenue,
  })

  const headline = pace.isAheadOfPace ? "Ahead of Pace" : "Behind Pace"
  const progressActual = Math.min(
    100,
    monthlyTarget > 0 ? (mtdRevenue / monthlyTarget) * 100 : 0,
  )
  const progressOnPace = Math.min(100, pace.progressOnPacePercent)

  return (
    <div className="rounded-card border border-success/30 bg-gradient-to-br from-success/[0.08] to-success/[0.18] p-3.5 shadow-card sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-success">
          Month Pace
        </span>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-bold text-success">
            {formatPaceBadge(pace.paceAheadPercent)}
          </span>
          {onEditTarget && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onEditTarget}
              className="h-7 w-7 -mr-1 text-success/70 hover:text-success"
              title="Manage targets"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <p className="mt-1.5 font-serif text-2xl font-semibold tracking-tight text-green-950 sm:text-[30px]">
        {headline}
      </p>

      <div className="relative mt-2 h-2 overflow-hidden rounded bg-green-950/10">
        <div
          className="absolute inset-y-0 left-0 rounded bg-green-950/20"
          style={{ width: `${progressOnPace}%` }}
          title="Expected at pace"
        />
        <div
          className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-success to-green-500"
          style={{ width: `${progressActual}%` }}
          title="Actual MTD"
        />
        {progressOnPace > 0 && progressOnPace < 100 && (
          <div
            className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-foreground"
            style={{ left: `${progressOnPace}%` }}
            title="Pace marker"
          />
        )}
      </div>

      <div className="mt-1 flex justify-between text-[10.5px] text-green-900/80">
        <span>
          Run {formatM(avgDailyRevenue)}/day · pace {formatM(pace.dailyTargetPace)}
        </span>
        <span className="tabular-nums">
          {Math.round(progressActual)}% / {Math.round(progressOnPace)}%
        </span>
      </div>
    </div>
  )
}
