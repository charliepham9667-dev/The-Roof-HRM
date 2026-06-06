import { cn } from "@/lib/utils"
import type { DebtItemStatus } from "@/lib/finance-headroom"

export { formatCompactVnd, formatVnd } from "@/lib/finance-headroom"

type PillTone = "success" | "warn" | "info" | "brand" | "burg" | "error" | "neutral"

const pillStyles: Record<PillTone, string> = {
  success: "bg-success/10 text-success",
  warn: "bg-warning/15 text-warning",
  info: "bg-blue-500/10 text-blue-700",
  brand: "bg-primary/15 text-primary",
  burg: "bg-[#6C2B29]/10 text-[#6C2B29]",
  error: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
}

export function FinancePill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: PillTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide whitespace-nowrap",
        pillStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function FinanceKpiCard({
  label,
  sublabel,
  value,
  footer,
  pill,
  variant = "default",
  className,
}: {
  label: string
  sublabel?: string
  value: string
  footer?: React.ReactNode
  pill?: React.ReactNode
  variant?: "default" | "success" | "hero" | "active"
  className?: string
}) {
  const variants = {
    default: "bg-card border-border text-foreground",
    success: "bg-success/5 border-success/25",
    hero: "bg-gradient-to-br from-success/10 to-success/20 border-success/30",
    active: "bg-[#4A1F1C] border-[#4A1F1C] text-[#F4E9D3]",
  }
  return (
    <div className={cn("rounded-card border p-4 shadow-card", variants[variant], className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className={cn(
              "text-[10.5px] font-semibold uppercase tracking-wide",
              variant === "active" ? "text-[#E7C8B1]" : "text-muted-foreground",
            )}
          >
            {label}
          </div>
          {sublabel && (
            <div
              className={cn(
                "text-[11px] mt-0.5",
                variant === "active" ? "text-[#E7C8B1]/80" : "text-muted-foreground",
              )}
            >
              {sublabel}
            </div>
          )}
        </div>
        {pill}
      </div>
      <div
        className={cn(
          "mt-2 whitespace-nowrap text-2xl font-semibold tabular-nums tracking-tight",
          variant === "hero" ? "text-[#14532D]" : variant === "active" ? "text-white" : "text-foreground",
        )}
      >
        {value}
      </div>
      {footer && (
        <div
          className={cn(
            "mt-1 text-[11px]",
            variant === "active" ? "text-[#E7C8B1]/90" : "text-muted-foreground",
          )}
        >
          {footer}
        </div>
      )}
    </div>
  )
}

export function DebtStatusBadge({ status }: { status: DebtItemStatus }) {
  const map: Record<DebtItemStatus, { label: string; tone: PillTone }> = {
    paid: { label: "Paid", tone: "success" },
    pending: { label: "Pending", tone: "warn" },
    stopped: { label: "Stopped", tone: "neutral" },
  }
  const { label, tone } = map[status] ?? { label: status, tone: "neutral" as PillTone }
  return <FinancePill tone={tone}>{label}</FinancePill>
}

/** Shared stat cell for Finance Summary footer grids */
export function FinanceSummaryStatCell({
  label,
  value,
  sub,
  valueClassName,
  boxed = false,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  valueClassName?: string
  boxed?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        boxed &&
          "rounded-lg border border-border bg-[#FAFAF8] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
      )}
    >
      <p className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 whitespace-nowrap font-serif text-lg font-semibold leading-tight tabular-nums", valueClassName)}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10.5px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function MiniSparkline({
  data,
  color = "currentColor",
  className,
}: {
  data: number[]
  color?: string
  className?: string
}) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const w = 120
  const h = 28
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} className={className} aria-hidden>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
