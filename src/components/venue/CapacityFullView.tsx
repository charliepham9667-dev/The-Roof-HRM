import { cn } from "@/lib/utils"
import { useCapacityData } from "@/hooks/useCapacityData"
import { useWebFormReservations } from "@/hooks/useWebFormReservations"
import { AlertTriangle, Loader2, Flag, Users } from "lucide-react"

const ICT_TZ = "Asia/Ho_Chi_Minh"
function getTodayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ICT_TZ }).formatToParts(new Date())
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`
}

function StatChip({ label, value, sub, icon, tone = "default" }: {
  label: string; value: string | number; sub: string; icon: React.ReactNode
  tone?: "default" | "warning" | "error"
}) {
  const toneMap = {
    default: { icon: "text-muted-foreground", bg: "bg-muted/60" },
    warning: { icon: "text-amber-600", bg: "bg-amber-50" },
    error:   { icon: "text-red-600",   bg: "bg-red-50" },
  }
  const t = toneMap[tone]
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", t.bg, t.icon)}>{icon}</span>
      </div>
      <div className="text-[32px] font-bold leading-none tracking-tight">{value}</div>
      <div className="text-[12px] text-muted-foreground">{sub}</div>
    </div>
  )
}

export function CapacityFullView() {
  const { data, isLoading } = useCapacityData()
  const { data: allReservations = [] } = useWebFormReservations()
  const todayIso = getTodayIso()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (!data || data.slots.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No capacity data — configure time slot caps in Supabase.
      </div>
    )
  }

  const { slots, config } = data
  const { warningThreshold, hardLimit } = config
  const totalCap = slots[0]?.maxPax ?? 120
  const overLimitSlots = slots.filter((s) => s.booked >= hardLimit).length
  const warnPct = (warningThreshold / totalCap) * 100
  const limitPct = (hardLimit / totalCap) * 100

  // Flagged reservations: today's pending that push a slot over warning threshold
  const todayPending = allReservations.filter(
    (r) => r.dateOfReservation === todayIso && r.bookingStatus === "pending"
  )
  const flagged = todayPending.filter((r) => {
    const hour = parseInt((r.time ?? "00:00").slice(0, 2), 10)
    const slot = slots.find((s) => s.hour === hour)
    return slot && slot.booked + r.numberOfGuests >= warningThreshold
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="flex gap-3">
        <StatChip
          label="Total Capacity"
          value={totalCap}
          sub={`seats · 3F venue`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatChip
          label="Warning Threshold"
          value={warningThreshold}
          sub={`${Math.round(warnPct)}% — flag for review`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="warning"
        />
        <StatChip
          label="Hard Limit"
          value={hardLimit}
          sub="no further approvals"
          icon={<Flag className="h-4 w-4" />}
          tone="error"
        />
      </div>

      {/* Utilization by time slot */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <span className="text-[13.5px] font-semibold text-foreground">Utilization by time slot</span>
          {overLimitSlots > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {overLimitSlots} slot{overLimitSlots !== 1 ? "s" : ""} over limit
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2.5 px-5 py-4">
          {slots.map((s) => {
            const pct = totalCap > 0 ? Math.min((s.booked / totalCap) * 100, 100) : 0
            const isOver = s.booked >= hardLimit
            const isWarn = !isOver && s.booked >= warningThreshold
            const barColor = isOver ? "#b83232" : isWarn ? "#a06820" : "var(--primary)"

            return (
              <div key={s.time} className="flex items-center gap-3">
                {/* Time label */}
                <span className="w-[42px] shrink-0 font-mono text-[12.5px] font-semibold text-foreground">{s.time}</span>

                {/* Bar track */}
                <div className="relative flex-1 h-5 overflow-hidden rounded-md bg-muted/60">
                  {/* Warning line */}
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 border-r border-dashed border-amber-400/60"
                    style={{ left: `${warnPct}%` }}
                  />
                  {/* Limit line */}
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 border-r border-dashed border-red-400/60"
                    style={{ left: `${limitPct}%` }}
                  />
                  {/* Filled bar */}
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>

                {/* Count + badge */}
                <div className="flex w-[120px] shrink-0 items-center justify-end gap-1.5">
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {s.booked}/{totalCap} · {Math.round(pct)}%
                  </span>
                  {isOver && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">Over</span>
                  )}
                  {isWarn && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Warn</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Flagged — require manual review */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-amber-600" />
            <span className="text-[13.5px] font-semibold text-foreground">Flagged — require manual review</span>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
            {flagged.length}
          </span>
        </div>
        {flagged.length === 0 ? (
          <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">
            No flagged reservations — all slots within limits.
          </p>
        ) : (
          <div className="flex flex-col gap-0">
            {flagged.map((r, i) => {
              const hour = parseInt((r.time ?? "00:00").slice(0, 2), 10)
              const slot = slots.find((s) => s.hour === hour)
              return (
                <div
                  key={r.reservationSystemId ?? i}
                  className="flex items-center gap-3 border-b border-border/40 px-5 py-3 last:border-0"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13.5px] font-semibold text-foreground">
                      {r.name} · {r.numberOfGuests} pax
                    </span>
                    <p className="text-[12px] text-muted-foreground">
                      {r.time?.slice(0, 5)} slot · pushes {r.time?.slice(0, 5)} over warning threshold
                      {slot && ` (${slot.booked + r.numberOfGuests}/${totalCap})`}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full border px-3 py-0.5 text-[11px] font-semibold",
                    r.bookingStatus === "accepted"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  )}>
                    {r.bookingStatus === "accepted" ? "● Approved" : "● Pending"}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
