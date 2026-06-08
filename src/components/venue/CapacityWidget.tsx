import { useState } from "react"
import { cn } from "@/lib/utils"
import { useTableCapacity } from "@/hooks/useTableCapacity"
import {
  GREEN_TABLES_PER_SLOT,
  MAX_TABLES_PER_SLOT,
  SEAVIEW_CAP_PER_SLOT,
  type SlotAllocation,
} from "@/lib/capacityModel"
import { AlertTriangle, Loader2, Waves, Sparkles, CheckCircle2, Ban } from "lucide-react"

const ZONE = {
  green:      { bar: "var(--primary)", chip: "bg-emerald-100 text-emerald-700", label: "Open" },
  discussion: { bar: "#a06820",        chip: "bg-amber-100 text-amber-700",     label: "Discuss" },
  full:       { bar: "#b83232",        chip: "bg-red-100 text-red-600",         label: "Full" },
} as const

// Bars scale against the hard cap so the green-capacity line is visible mid-track.
const greenLinePct = (GREEN_TABLES_PER_SLOT / MAX_TABLES_PER_SLOT) * 100

function SlotBar({ s }: { s: SlotAllocation }) {
  const z = ZONE[s.zone]
  const pct = Math.min((s.tablesReserved / MAX_TABLES_PER_SLOT) * 100, 100)
  const seaviewFull = s.seaviewReserved >= SEAVIEW_CAP_PER_SLOT
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[40px] shrink-0 font-mono text-[11.5px] font-semibold text-foreground">{s.time}</span>

      {/* Bar track */}
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted/60">
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-10 border-r border-dashed border-emerald-500/50"
          style={{ left: `${greenLinePct}%` }}
        />
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${pct}%`, background: z.bar, minWidth: s.tablesReserved > 0 ? 6 : 0 }}
        />
      </div>

      {/* Seaview sub-meter */}
      <span
        className={cn(
          "flex w-[46px] shrink-0 items-center justify-center gap-0.5 font-mono text-[10px] font-semibold",
          seaviewFull ? "text-amber-600" : "text-sky-600",
        )}
        title="seaview reserved / cap (2 — rest held for walk-ins)"
      >
        <Waves className="h-2.5 w-2.5" />
        {s.seaviewReserved}/{SEAVIEW_CAP_PER_SLOT}
      </span>

      {/* Count */}
      <span className="w-[42px] shrink-0 text-right font-mono text-[11px] text-muted-foreground">
        {s.tablesReserved}/{GREEN_TABLES_PER_SLOT}
      </span>

      {/* Zone badge */}
      <span className={cn("w-[56px] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[9.5px] font-bold", z.chip)}>
        {z.label}
      </span>
    </div>
  )
}

const REC_BANNER = {
  green: { wrap: "border-emerald-200 bg-emerald-50", text: "text-emerald-800", icon: "text-emerald-600", Icon: CheckCircle2 },
  amber: { wrap: "border-amber-200 bg-amber-50",     text: "text-amber-800",   icon: "text-amber-600",   Icon: AlertTriangle },
  red:   { wrap: "border-red-200 bg-red-50",         text: "text-red-800",     icon: "text-red-600",     Icon: Ban },
} as const

export function CapacityWidget() {
  const { slots, isLoading, peakSlot, discussionSlots, fullSlots, seaviewOverflowSlots, recommendation } =
    useTableCapacity()
  const [view, setView] = useState<"slots" | "stats">("slots")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading capacity…</span>
      </div>
    )
  }

  if (slots.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">No reservable slots configured.</div>
  }

  const peak = peakSlot?.tablesReserved ?? 0
  const util = Math.round((peak / GREEN_TABLES_PER_SLOT) * 100)
  const rb = REC_BANNER[recommendation.tone]

  const stats = [
    { label: "Green capacity", value: `${peak}/${GREEN_TABLES_PER_SLOT}`, sub: peakSlot ? `peak ${peakSlot.time}` : "—", danger: peak > GREEN_TABLES_PER_SLOT },
    { label: "Seaview pressure", value: `${seaviewOverflowSlots} slot${seaviewOverflowSlots !== 1 ? "s" : ""}`, sub: `over ${SEAVIEW_CAP_PER_SLOT}/slot cap`, danger: seaviewOverflowSlots > 0 },
    { label: "Need discussion", value: discussionSlots, sub: "offer non-seaview / bar", danger: discussionSlots > 0 },
    { label: "Full slots", value: fullSlots, sub: `> ${MAX_TABLES_PER_SLOT} tables`, danger: fullSlots > 0 },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[30px] font-bold leading-none tracking-tight">{util}%</div>
          <div className="mt-1 text-[12px] text-muted-foreground">peak fill · {peak}/{GREEN_TABLES_PER_SLOT} tables</div>
        </div>
        {peakSlot && peakSlot.zone !== "green" && (
          <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            {peakSlot.time} {peakSlot.zone === "full" ? "full" : "needs discussion"}
          </span>
        )}
      </div>

      {/* AI recommendation */}
      <div className={cn("mb-4 flex items-start gap-2 rounded-lg border px-3 py-2", rb.wrap)}>
        <Sparkles className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", rb.icon)} />
        <div className="min-w-0">
          <p className={cn("text-[12.5px] font-bold leading-snug", rb.text)}>{recommendation.headline}</p>
          <p className="text-[11px] text-muted-foreground leading-snug">{recommendation.detail}</p>
        </div>
      </div>

      {/* View toggle */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {view === "slots" ? "Utilization by time slot" : "Service at a glance"}
        </span>
        <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
          {(["slots", "stats"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap transition-colors",
                view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "slots" ? "Time slots" : "Key stats"}
            </button>
          ))}
        </div>
      </div>

      {view === "slots" ? (
        <>
          <div className="flex flex-col gap-2">
            {slots.map((s) => (
              <SlotBar key={s.time} s={s} />
            ))}
          </div>
          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
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
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 border-r border-dashed border-emerald-500/70" /> green cap {GREEN_TABLES_PER_SLOT}
            </span>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {stats.map((st) => (
            <div key={st.label} className="rounded-lg bg-muted/40 p-3">
              <div className={cn("text-lg font-bold leading-tight tabular-nums", st.danger ? "text-destructive" : "text-foreground")}>
                {st.value}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-secondary-foreground">{st.label}</div>
              <div className="text-[10.5px] text-muted-foreground">{st.sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
