import { cn } from "@/lib/utils"

type Tone = "default" | "warning"

export type FinanceKpiTileProps = {
  label: string
  value: string
  trendPercent?: number
  comparisonLine?: string
  tone?: Tone
  className?: string
}

function trendPillLabel(trend: number) {
  const abs = Math.abs(Math.round(trend * 10) / 10)
  const arrow = trend > 0 ? "↑" : trend < 0 ? "↓" : "—"
  return `${arrow} ${abs}% YoY`
}

function trendPillTone(trend: number): "success" | "warn" | "neutral" {
  if (trend > 0) return "success"
  if (trend < 0) return "warn"
  return "neutral"
}

const pillStyles = {
  success: "bg-success/10 text-success border border-success/20",
  warn: "bg-warning/12 text-warning border border-warning/30",
  neutral: "bg-muted text-muted-foreground border border-border",
}

export function FinanceKpiTile({
  label,
  value,
  trendPercent,
  comparisonLine,
  tone = "default",
  className,
}: FinanceKpiTileProps) {
  const isWarning = tone === "warning"
  const pillTone = trendPercent !== undefined ? trendPillTone(trendPercent) : "neutral"

  return (
    <div
      className={cn(
        "rounded-card border shadow-card flex flex-col gap-1 px-3 py-2.5 sm:p-4",
        isWarning ? "border-warning/25 bg-warning/[0.05]" : "border-border bg-card",
        className,
      )}
    >
      {/* Label + trend pill row */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-widest truncate",
            isWarning ? "text-warning" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {trendPercent !== undefined && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide",
              pillStyles[pillTone],
            )}
          >
            {trendPillLabel(trendPercent)}
          </span>
        )}
      </div>

      {/* Value */}
      <p
        className={cn(
          "whitespace-nowrap font-semibold tabular-nums leading-none",
          "text-xl sm:text-[28px]",
          isWarning ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>

      {/* Comparison — hidden on mobile, shown on sm+ */}
      {comparisonLine && (
        <p
          className={cn(
            "hidden sm:block text-[11px] leading-snug",
            isWarning ? "text-amber-900/80" : "text-muted-foreground",
          )}
        >
          {comparisonLine}
        </p>
      )}
    </div>
  )
}
