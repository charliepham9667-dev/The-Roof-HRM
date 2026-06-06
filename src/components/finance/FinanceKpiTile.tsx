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
  const pillTone =
    trendPercent !== undefined ? trendPillTone(trendPercent) : "neutral"

  return (
    <div
      className={cn(
        "rounded-card border p-3.5 shadow-card sm:p-4",
        isWarning
          ? "border-warning/25 bg-warning/[0.05]"
          : "border-border bg-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "min-w-0 text-[10.5px] font-semibold uppercase tracking-wide",
            isWarning ? "text-warning" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {trendPercent !== undefined && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide",
              pillStyles[pillTone],
            )}
          >
            {trendPillLabel(trendPercent)}
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-1.5 whitespace-nowrap font-serif text-xl font-semibold tabular-nums tracking-tight sm:text-[30px]",
          isWarning ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>
      {comparisonLine && (
        <p
          className={cn(
            "mt-1 text-[11.5px] leading-snug",
            isWarning ? "text-amber-900/80" : "text-muted-foreground",
          )}
        >
          {comparisonLine}
        </p>
      )}
    </div>
  )
}
