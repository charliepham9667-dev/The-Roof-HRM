import { cn } from "@/lib/utils"

function formatM(value: number): string {
  return `${(value / 1_000_000).toFixed(1)}M`
}

export type VelocityInsightPillProps = {
  isOnTrack: boolean
  avgDailyRevenue: number
  remainingDays: number
  className?: string
}

export function VelocityInsightPill({
  isOnTrack,
  avgDailyRevenue,
  remainingDays,
  className,
}: VelocityInsightPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        isOnTrack
          ? "bg-success/15 text-success"
          : "bg-error/15 text-error",
        className,
      )}
    >
      <span className="text-[10px]" aria-hidden>
        ●
      </span>
      {isOnTrack ? "On track" : "Behind pace"} · {formatM(avgDailyRevenue)}/day ·{" "}
      {remainingDays} day{remainingDays === 1 ? "" : "s"} left
    </span>
  )
}
