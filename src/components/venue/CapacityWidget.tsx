import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useCapacityData } from "@/hooks/useCapacityData"
import { useReservationsCsv } from "@/hooks/useReservationsCsv"
import { AlertTriangle, Loader2 } from "lucide-react"

function getIctTodayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).formatToParts(new Date())
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`
}

export function CapacityWidget() {
  const { data, isLoading: capacityLoading } = useCapacityData()
  const { data: csvAll = [], isLoading: csvLoading } = useReservationsCsv()
  const todayIso = getIctTodayIso()
  const isLoading = capacityLoading || csvLoading

  // Merge CSV today bookings into slot booked counts
  const mergedData = useMemo(() => {
    if (!data) return null

    // Extra pax from CSV for today (phone/manually entered — not in Supabase)
    const csvTodayByHour: Record<number, number> = {}
    for (const r of csvAll) {
      if (r.dateOfReservation === todayIso && r.time) {
        const hour = parseInt(r.time.slice(0, 2), 10)
        csvTodayByHour[hour] = (csvTodayByHour[hour] ?? 0) + r.numberOfGuests
      }
    }

    const mergedSlots = data.slots.map((s) => ({
      ...s,
      booked: s.booked + (csvTodayByHour[s.hour] ?? 0),
    }))

    return { ...data, slots: mergedSlots }
  }, [data, csvAll, todayIso])
  const CHART_HEIGHT = 160 // px — fixed so bar height: px resolves correctly
  const [view, setView] = useState<"stats" | "tight">("stats")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading capacity…</span>
      </div>
    )
  }

  if (!mergedData || mergedData.slots.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No capacity data — configure time slot caps in Supabase.
      </div>
    )
  }

  const { slots, config } = mergedData
  const { warningThreshold, hardLimit } = config

  // Total max pax across all slots (use max single slot for the chart scale)
  const totalCap = Math.max(...slots.map((s) => s.maxPax), 1)

  const peakSlot = slots.reduce((a, b) => (b.booked > a.booked ? b : a), slots[0])
  const peak = peakSlot.booked
  const util = totalCap > 0 ? Math.round((peak / totalCap) * 100) : 0
  const overCount = slots.filter((s) => s.booked >= warningThreshold).length
  const avgFill = Math.round(
    (slots.reduce((a, s) => a + s.booked, 0) / slots.length / totalCap) * 100
  )
  const seatsLeftPeak = Math.max(totalCap - peak, 0)
  const tightest = [...slots].sort((a, b) => b.booked - a.booked).slice(0, 3)

  // CSS variables are stored as raw RGB tuples (e.g. "199 76 60"), so must wrap in rgb()
  const C_PRIMARY = "rgb(var(--primary))"
  const C_WARNING = "rgb(var(--warning))"
  const C_ERROR   = "rgb(var(--error))"

  const colorFor = (booked: number, maxPax: number) => {
    if (booked >= hardLimit || booked >= maxPax) return C_ERROR
    if (booked >= warningThreshold) return C_WARNING
    return C_PRIMARY
  }

  const warnPct = totalCap > 0 ? (warningThreshold / totalCap) * 100 : 0
  const limitPct = totalCap > 0 ? (hardLimit / totalCap) * 100 : 0

  const stats = [
    {
      label: "Seats left at peak",
      value: seatsLeftPeak,
      sub: peakSlot.time,
      danger: seatsLeftPeak <= 10,
    },
    {
      label: "Peak slot",
      value: peakSlot.time,
      sub: `${peak}/${totalCap} booked`,
      danger: false,
    },
    {
      label: `Slots over ≥${warningThreshold}`,
      value: overCount,
      sub: "need monitoring",
      danger: overCount > 0,
    },
    {
      label: "Average fill",
      value: `${avgFill}%`,
      sub: "across service",
      danger: false,
    },
  ]

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      {/* Header row */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[30px] font-bold leading-none tracking-tight">{util}%</div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            peak utilization · {peak}/{totalCap}
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          {peakSlot.time} over threshold
        </span>
      </div>

      {/* Bar chart — fixed px height so percentage bars resolve correctly */}
      <div className="relative flex items-end gap-1 pr-7" style={{ height: CHART_HEIGHT }}>
        {/* Threshold lines */}
        {[
          { pct: warnPct, val: warningThreshold, color: C_WARNING },
          { pct: limitPct, val: hardLimit,        color: C_ERROR   },
        ].map(({ pct, val, color }) => {
          const bottomPx = Math.round((pct / 100) * CHART_HEIGHT)
          return (
            <div
              key={val}
              className="pointer-events-none absolute left-0 right-7"
              style={{
                bottom: bottomPx,
                borderTop: `1px dashed ${color}`,
                opacity: 0.55,
              }}
            >
              <span
                className="absolute -right-7 font-mono text-[9px] font-bold"
                style={{ color, top: -10 }}
              >
                {val}
              </span>
            </div>
          )
        })}

        {/* Bars — items-end container aligns all bars at the bottom */}
        {slots.map((s) => {
          const barPx = Math.max(
            s.maxPax > 0 ? Math.round((s.booked / s.maxPax) * CHART_HEIGHT) : 0,
            s.booked > 0 ? 4 : 0,
          )
          const color = colorFor(s.booked, s.maxPax)
          return (
            <div
              key={s.time}
              className="flex flex-1 flex-col items-center justify-end gap-0.5"
              title={`${s.time} · ${s.booked} guests`}
            >
              {s.booked > 0 && (
                <span className="font-mono text-[8.5px] font-bold text-muted-foreground">
                  {s.booked}
                </span>
              )}
              <div
                style={{
                  width: "100%",
                  height: barPx,
                  background: color,
                  opacity: 0.92,
                  borderRadius: "4px 4px 0 0",
                  transition: "height .5s",
                  minHeight: s.booked > 0 ? 4 : 0,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Time labels row — separate so all labels stay on the same baseline */}
      <div className="flex gap-1 pr-7 mt-1">
        {slots.map((s) => (
          <span key={s.time} className="flex-1 text-center font-mono text-[9px] text-muted-foreground">
            {s.time.slice(0, 2)}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap gap-3.5 text-[11px] text-muted-foreground">
        {[
          { color: C_PRIMARY, label: "Healthy" },
          { color: C_WARNING, label: `Warning ≥${warningThreshold}` },
          { color: C_ERROR,   label: `Limit ${hardLimit}` },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* Lower panel — toggle */}
      <div className="mt-3.5 border-t border-border/60 pt-3.5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {view === "stats" ? "Service at a glance" : "Tightest slots"}
          </span>
          <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
            {(["stats", "tight"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap transition-colors",
                  view === v
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "stats" ? "Key stats" : "Tightest slots"}
              </button>
            ))}
          </div>
        </div>

        {view === "stats" ? (
          <div className="grid grid-cols-2 gap-2">
            {stats.map((st) => (
              <div key={st.label} className="rounded-lg bg-muted/40 p-3">
                <div
                  className={cn(
                    "text-lg font-bold leading-tight tabular-nums",
                    st.danger ? "text-destructive" : "text-foreground",
                  )}
                >
                  {st.value}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-secondary-foreground">
                  {st.label}
                </div>
                <div className="text-[10.5px] text-muted-foreground">{st.sub}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tightest.map((s) => {
              const pct = Math.min(s.maxPax > 0 ? (s.booked / s.maxPax) * 100 : 0, 100)
              const left = Math.max(s.maxPax - s.booked, 0)
              const color = colorFor(s.booked, s.maxPax)
              return (
                <div key={s.time} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 font-mono text-[12.5px] font-bold text-foreground">
                    {s.time}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono text-[11.5px] text-muted-foreground">
                    {s.booked}/{s.maxPax} · {left} left
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
