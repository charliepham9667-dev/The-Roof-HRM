import { useState } from "react"
import { cn } from "@/lib/utils"
import { useTableCapacity } from "@/hooks/useTableCapacity"
import {
  GREEN_TABLES_PER_SLOT,
  MAX_TABLES_PER_SLOT,
  SEAVIEW_CAP_PER_SLOT,
  type SlotAllocation,
} from "@/lib/capacityModel"
import { AlertTriangle, Loader2, Waves } from "lucide-react"

const CHART_HEIGHT = 160 // px — fixed so bar heights resolve correctly

const ZONE_COLOR = {
  green: "var(--primary)",
  discussion: "#a06820",
  full: "#b83232",
} as const

export function CapacityWidget() {
  const { slots, isLoading, peakSlot, discussionSlots, fullSlots, seaviewOverflowSlots } = useTableCapacity()
  const [view, setView] = useState<"stats" | "tight">("stats")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading capacity…</span>
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">No reservable slots configured.</div>
    )
  }

  const peak = peakSlot?.tablesReserved ?? 0
  const util = Math.round((peak / GREEN_TABLES_PER_SLOT) * 100)
  const tightest = [...slots].sort((a, b) => b.tablesReserved - a.tablesReserved).slice(0, 3)

  const stats = [
    {
      label: "Green capacity",
      value: `${peak}/${GREEN_TABLES_PER_SLOT}`,
      sub: peakSlot ? `peak ${peakSlot.time}` : "—",
      danger: peak > GREEN_TABLES_PER_SLOT,
    },
    {
      label: "Seaview pressure",
      value: `${seaviewOverflowSlots} slot${seaviewOverflowSlots !== 1 ? "s" : ""}`,
      sub: `over ${SEAVIEW_CAP_PER_SLOT}/slot cap`,
      danger: seaviewOverflowSlots > 0,
    },
    {
      label: "Need discussion",
      value: discussionSlots,
      sub: "offer non-seaview / bar",
      danger: discussionSlots > 0,
    },
    {
      label: "Full slots",
      value: fullSlots,
      sub: `> ${MAX_TABLES_PER_SLOT} tables`,
      danger: fullSlots > 0,
    },
  ]

  // Threshold lines drawn against the hard cap (chart scale).
  const greenLinePx = Math.round((GREEN_TABLES_PER_SLOT / MAX_TABLES_PER_SLOT) * CHART_HEIGHT)

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      {/* Header row */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[30px] font-bold leading-none tracking-tight">{util}%</div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            peak fill · {peak}/{GREEN_TABLES_PER_SLOT} tables
          </div>
        </div>
        {peakSlot && peakSlot.zone !== "green" && (
          <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            {peakSlot.time} {peakSlot.zone === "full" ? "full" : "needs discussion"}
          </span>
        )}
      </div>

      {/* Bar chart */}
      <div className="relative flex items-end gap-2 pr-8" style={{ height: CHART_HEIGHT }}>
        {/* Green capacity line */}
        <div
          className="pointer-events-none absolute left-0 right-8"
          style={{ bottom: greenLinePx, borderTop: "1px dashed #2e7a52", opacity: 0.6 }}
        >
          <span className="absolute -right-8 font-mono text-[9px] font-bold text-emerald-700" style={{ top: -10 }}>
            {GREEN_TABLES_PER_SLOT}
          </span>
        </div>

        {slots.map((s: SlotAllocation) => {
          const barPx = Math.max(
            Math.round((s.tablesReserved / MAX_TABLES_PER_SLOT) * CHART_HEIGHT),
            s.tablesReserved > 0 ? 4 : 0,
          )
          return (
            <div
              key={s.time}
              className="flex flex-1 flex-col items-center justify-end gap-0.5"
              title={`${s.time} · ${s.tablesReserved} tables · ${s.seaviewReserved}/${SEAVIEW_CAP_PER_SLOT} seaview · ${s.pax} pax`}
            >
              {s.tablesReserved > 0 && (
                <span className="font-mono text-[8.5px] font-bold text-muted-foreground">{s.tablesReserved}</span>
              )}
              <div
                style={{
                  width: "60%",
                  height: barPx,
                  background: ZONE_COLOR[s.zone],
                  opacity: 0.92,
                  borderRadius: "4px 4px 0 0",
                  transition: "height .5s",
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Time labels */}
      <div className="mt-1 flex gap-2 pr-8">
        {slots.map((s) => (
          <span key={s.time} className="flex-1 text-center font-mono text-[9px] text-muted-foreground">
            {s.time.slice(0, 2)}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap gap-3.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--primary)" }} /> Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: "#a06820" }} /> Discussion
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: "#b83232" }} /> Full
        </span>
        <span className="flex items-center gap-1.5">
          <Waves className="h-3 w-3 text-sky-600" /> seaview cap {SEAVIEW_CAP_PER_SLOT}/slot
        </span>
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
                  view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
                <div className="mt-0.5 text-[11px] font-semibold text-secondary-foreground">{st.label}</div>
                <div className="text-[10.5px] text-muted-foreground">{st.sub}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tightest.map((s) => {
              const pct = Math.min((s.tablesReserved / GREEN_TABLES_PER_SLOT) * 100, 100)
              const left = Math.max(GREEN_TABLES_PER_SLOT - s.tablesReserved, 0)
              return (
                <div key={s.time} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 font-mono text-[12.5px] font-bold text-foreground">{s.time}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ZONE_COLOR[s.zone] }} />
                  </div>
                  <span className="w-28 shrink-0 text-right font-mono text-[11.5px] text-muted-foreground">
                    {s.tablesReserved}/{GREEN_TABLES_PER_SLOT} · {left} left
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
