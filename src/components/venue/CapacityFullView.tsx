import { cn } from "@/lib/utils"
import { useTableCapacity } from "@/hooks/useTableCapacity"
import {
  GREEN_TABLES_PER_SLOT,
  MAX_TABLES_PER_SLOT,
  SEAVIEW_CAP_PER_SLOT,
  VENUE_CAPACITY,
  type SlotAllocation,
} from "@/lib/capacityModel"
import { AlertTriangle, Loader2, Flag, Users, Waves, Armchair, MessageCircle } from "lucide-react"

function StatChip({ label, value, sub, icon, tone = "default" }: {
  label: string; value: string | number; sub: string; icon: React.ReactNode
  tone?: "default" | "warning" | "error" | "ocean"
}) {
  const toneMap = {
    default: { icon: "text-muted-foreground", bg: "bg-muted/60" },
    warning: { icon: "text-amber-600", bg: "bg-amber-50" },
    error:   { icon: "text-red-600",   bg: "bg-red-50" },
    ocean:   { icon: "text-sky-600",   bg: "bg-sky-50" },
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

const ZONE_STYLE = {
  green:      { bar: "var(--primary)", chip: "bg-emerald-100 text-emerald-700", label: "Open" },
  discussion: { bar: "#a06820",        chip: "bg-amber-100 text-amber-700",   label: "Discuss" },
  full:       { bar: "#b83232",        chip: "bg-red-100 text-red-600",       label: "Full" },
} as const

function SlotRow({ s }: { s: SlotAllocation }) {
  const z = ZONE_STYLE[s.zone]
  // Bar fills against the hard cap so the green→overflow band is visible.
  const pct = Math.min((s.tablesReserved / MAX_TABLES_PER_SLOT) * 100, 100)
  const greenLinePct = (GREEN_TABLES_PER_SLOT / MAX_TABLES_PER_SLOT) * 100
  const seaviewFull = s.seaviewReserved >= SEAVIEW_CAP_PER_SLOT

  return (
    <div className="flex items-center gap-3">
      <span className="w-[42px] shrink-0 font-mono text-[12.5px] font-semibold text-foreground">{s.time}</span>

      {/* Table utilisation bar */}
      <div className="relative flex-1 h-5 overflow-hidden rounded-md bg-muted/60">
        {/* Green-capacity line (comfortable reservable tables) */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-10 border-r border-dashed border-emerald-500/50"
          style={{ left: `${greenLinePct}%` }}
        />
        <div
          className="h-full rounded-md transition-all duration-500"
          style={{ width: `${pct}%`, background: z.bar }}
        />
      </div>

      {/* Seaview sub-meter */}
      <div
        className={cn(
          "flex w-[78px] shrink-0 items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold",
          seaviewFull
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-sky-200 bg-sky-50 text-sky-700",
        )}
        title="Seaview tables reserved this slot (cap 2 — rest held for walk-ins)"
      >
        <Waves className="h-3 w-3" />
        {s.seaviewReserved}/{SEAVIEW_CAP_PER_SLOT}
      </div>

      {/* Tables count + zone badge */}
      <div className="flex w-[150px] shrink-0 items-center justify-end gap-1.5">
        <span className="font-mono text-[12px] text-muted-foreground">
          {s.tablesReserved}/{GREEN_TABLES_PER_SLOT}
          {s.tablesPending > 0 && (
            <span className="text-amber-600"> ({s.tablesPending}p)</span>
          )}
          {" · "}{s.pax}pax
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", z.chip)}>{z.label}</span>
      </div>
    </div>
  )
}

export function CapacityFullView() {
  const { slots, isLoading, peakSlot, discussionSlots, fullSlots, seaviewOverflowSlots, totalTables, totalPax } =
    useTableCapacity()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="flex flex-wrap gap-3">
        <StatChip
          label="Green capacity"
          value={GREEN_TABLES_PER_SLOT}
          sub="tables/slot — 2 seaview + 9 sofa"
          icon={<Users className="h-4 w-4" />}
        />
        <StatChip
          label="Seaview cap"
          value={`${SEAVIEW_CAP_PER_SLOT}/slot`}
          sub={`${VENUE_CAPACITY.seating.seaview.total} total · 9 held for walk-ins`}
          icon={<Waves className="h-4 w-4" />}
          tone="ocean"
        />
        <StatChip
          label="Overflow buffer"
          value={`+${VENUE_CAPACITY.seating.standing.total}`}
          sub="non-seaview standing — needs discussion"
          icon={<MessageCircle className="h-4 w-4" />}
          tone="warning"
        />
        <StatChip
          label="Hard max"
          value={MAX_TABLES_PER_SLOT}
          sub="tables/slot — then decline / waitlist"
          icon={<Flag className="h-4 w-4" />}
          tone="error"
        />
      </div>

      {/* Today rollup */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card px-5 py-3 text-[12.5px] shadow-sm">
        <span className="font-semibold text-foreground">Tonight:</span>
        <span className="text-muted-foreground">{totalTables} tables · {totalPax} pax across all slots</span>
        {peakSlot && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">
            Peak {peakSlot.time} · {peakSlot.tablesReserved} tables
          </span>
        )}
        {seaviewOverflowSlots > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 font-semibold text-sky-700">
            <Waves className="h-3 w-3" />
            {seaviewOverflowSlots} slot{seaviewOverflowSlots !== 1 ? "s" : ""} over seaview cap
          </span>
        )}
        {discussionSlots > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 font-semibold text-amber-700">
            <MessageCircle className="h-3 w-3" />
            {discussionSlots} need discussion
          </span>
        )}
        {fullSlots > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 font-semibold text-red-600">
            <AlertTriangle className="h-3 w-3" />
            {fullSlots} full
          </span>
        )}
      </div>

      {/* Utilization by time slot */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <span className="text-[13.5px] font-semibold text-foreground">Utilization by time slot</span>
          <span className="text-[11px] text-muted-foreground">tables reserved · seaview sub-cap</span>
        </div>
        <div className="flex flex-col gap-2.5 px-5 py-4">
          {slots.map((s) => (
            <SlotRow key={s.time} s={s} />
          ))}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 border-t border-border/60 px-5 py-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--primary)" }} />
            Open (≤{GREEN_TABLES_PER_SLOT})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#a06820" }} />
            Discussion (seaview cap / overflow)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#b83232" }} />
            Full (&gt;{MAX_TABLES_PER_SLOT})
          </span>
          <span className="flex items-center gap-1.5">
            <Waves className="h-3 w-3 text-sky-600" />
            Seaview reserved / cap
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-amber-600 font-mono font-bold">(np)</span>
            pending tables
          </span>
        </div>
      </div>

      {/* Sofa rule note */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-5 py-3.5 text-[12.5px] text-muted-foreground">
        <Armchair className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p>
          <span className="font-semibold text-foreground">9 sofa tables</span> seat a minimum of {VENUE_CAPACITY.seating.sofa.minPax} pax —
          relaxed to {VENUE_CAPACITY.seating.sofa.slowHourMinPax} pax during slow hours (14:00–18:00).
          Reservations stop after {VENUE_CAPACITY.lastSlotHour}:00 — later arrivals are walk-in only.
        </p>
      </div>
    </div>
  )
}
