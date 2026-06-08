import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useTableCapacity } from "@/hooks/useTableCapacity"
import { type CsvReservation } from "@/hooks/useReservationsCsv"
import {
  TOTAL_TABLES,
  MAX_TABLES_PER_SLOT,
  SLOT_HOURS,
  classifySeating,
  type SlotAllocation,
} from "@/lib/capacityModel"
import { AlertTriangle, Loader2, Waves, Sparkles, CheckCircle2, Ban, ChevronDown, Phone } from "lucide-react"

const ZONE = {
  green:      { chip: "bg-emerald-100 text-emerald-700", label: "Open" },
  discussion: { chip: "bg-amber-100 text-amber-700",     label: "Discuss" },
  full:       { chip: "bg-red-100 text-red-600",         label: "Full" },
} as const

// Table type colors
const SEAVIEW_BLUE    = "#2c5f9e"
const SOFA_GREEN      = "#2e7a52"
const STANDING_YELLOW = "#b8862e"

function seatingColor(r: CsvReservation): string {
  const t = classifySeating({ table: r.table, specialRequests: r.specialRequests, numberOfGuests: r.numberOfGuests })
  return t === "seaview" ? SEAVIEW_BLUE : t === "sofa" ? SOFA_GREEN : STANDING_YELLOW
}

function seatingLabel(r: CsvReservation): string {
  const t = classifySeating({ table: r.table, specialRequests: r.specialRequests, numberOfGuests: r.numberOfGuests })
  return t === "seaview" ? "Seaview" : t === "sofa" ? "Sofa" : "Standing"
}

// ─── Compact guest row inside an expanded slot ─────────────────────────────

function GuestRow({ r }: { r: CsvReservation }) {
  const color = seatingColor(r)
  const label = seatingLabel(r)
  const phone = r.phone?.replace(/\s/g, "") ?? null
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-background px-2.5 py-2">
      {/* Seating type indicator */}
      <span
        className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: color }}
        title={label}
      />
      <div className="min-w-0 flex-1">
        {/* Name + pax */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] font-semibold text-foreground truncate max-w-[140px]">
            {r.name || "Unknown"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {r.numberOfGuests} pax
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none"
            style={{ background: color + "22", color }}
          >
            {label}
          </span>
        </div>
        {/* Phone + special requests */}
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {phone && (
            <span className="flex items-center gap-0.5">
              <Phone className="h-2.5 w-2.5" />
              {phone}
            </span>
          )}
          {r.specialRequests && (
            <span className="italic truncate max-w-[200px]">"{r.specialRequests}"</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Slot bar row with expandable guest list ───────────────────────────────

function SlotBar({ s, reservations }: { s: SlotAllocation; reservations: CsvReservation[] }) {
  const [open, setOpen] = useState(false)
  const z = ZONE[s.zone]
  const blue   = s.seaviewReserved
  const green  = s.sofaReserved
  const yellow = s.barReserved
  const filled = blue + green + yellow
  const seaviewFull = s.seaviewReserved >= s.seaviewCap
  const cellCount = Math.max(TOTAL_TABLES, filled)
  const hasGuests = reservations.length > 0

  return (
    <div className={cn("rounded-lg transition-colors", hasGuests && "bg-muted/20")}>
      {/* Bar row — click to toggle guests */}
      <div
        className={cn("flex items-center gap-2.5 px-1 py-1", hasGuests && "cursor-pointer")}
        onClick={() => hasGuests && setOpen((v) => !v)}
      >
        {/* Time */}
        <span className="w-[40px] shrink-0 font-mono text-[11.5px] font-semibold text-foreground">{s.time}</span>

        {/* Segmented blocks */}
        <div className="flex flex-1 gap-[2px]">
          {Array.from({ length: cellCount }).map((_, i) => {
            let color: string | null = null
            let title = "Open"
            if (i < blue) { color = SEAVIEW_BLUE; title = "Seaview" }
            else if (i < blue + green) { color = SOFA_GREEN; title = "Sofa" }
            else if (i < filled) { color = STANDING_YELLOW; title = "Standing" }
            return (
              <div
                key={i}
                className={cn("h-5 flex-1 rounded-sm", color ? "" : "bg-muted/70")}
                style={color ? { background: color } : undefined}
                title={title}
              />
            )
          })}
        </div>

        {/* Seaview sub-meter */}
        <span
          className={cn(
            "flex w-[42px] shrink-0 items-center justify-center gap-0.5 font-mono text-[10px] font-semibold",
            seaviewFull ? "text-amber-600" : "text-sky-600",
          )}
          title={`seaview reserved / cap for this slot (${s.seaviewCap})`}
        >
          <Waves className="h-2.5 w-2.5" />
          {s.seaviewReserved}/{s.seaviewCap}
        </span>

        {/* Count — hidden on small screens */}
        <span className="hidden w-[42px] shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:block">
          {filled}/{TOTAL_TABLES}
        </span>

        {/* Zone badge — hidden on small screens */}
        <span className={cn("hidden w-[52px] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[9.5px] font-bold sm:block", z.chip)}>
          {z.label}
        </span>

        {/* Expand chevron */}
        {hasGuests && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </div>

      {/* Guest list */}
      {hasGuests && open && (
        <div className="flex flex-col gap-1.5 px-2 pb-2 pt-0.5">
          {reservations.map((r) => (
            <GuestRow key={`${r.reservationSystemId ?? r.name}-${r.time}`} r={r} />
          ))}
        </div>
      )}
    </div>
  )
}

const REC_BANNER = {
  green: { wrap: "border-emerald-200 bg-emerald-50", text: "text-emerald-800", icon: "text-emerald-600", Icon: CheckCircle2 },
  amber: { wrap: "border-amber-200 bg-amber-50",     text: "text-amber-800",   icon: "text-amber-600",   Icon: AlertTriangle },
  red:   { wrap: "border-red-200 bg-red-50",         text: "text-red-800",     icon: "text-red-600",     Icon: Ban },
} as const

export function CapacityWidget() {
  const { slots, isLoading, peakSlot, discussionSlots, fullSlots, seaviewOverflowSlots, recommendation, dayRows } =
    useTableCapacity()
  const [view, setView] = useState<"slots" | "stats">("slots")

  // Group today's reservations by start hour
  const reservationsByHour = useMemo(() => {
    const map = new Map<number, CsvReservation[]>()
    for (const h of SLOT_HOURS) map.set(h, [])
    for (const r of dayRows) {
      if (!r.time) continue
      const hour = parseInt(r.time.slice(0, 2), 10)
      if (map.has(hour)) map.get(hour)!.push(r)
    }
    return map
  }, [dayRows])

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
  const util = Math.round((peak / TOTAL_TABLES) * 100)
  const rb = REC_BANNER[recommendation.tone]

  const stats = [
    { label: "Peak fill", value: `${peak}/${TOTAL_TABLES}`, sub: peakSlot ? `at ${peakSlot.time}` : "—", danger: peak >= TOTAL_TABLES },
    { label: "Seaview pressure", value: `${seaviewOverflowSlots} slot${seaviewOverflowSlots !== 1 ? "s" : ""}`, sub: "seaview cap reached", danger: seaviewOverflowSlots > 0 },
    { label: "Need discussion", value: discussionSlots, sub: "steer to sofa / standing", danger: discussionSlots > 0 },
    { label: "Full slots", value: fullSlots, sub: `all ${MAX_TABLES_PER_SLOT} tables gone`, danger: fullSlots > 0 },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[30px] font-bold leading-none tracking-tight">{util}%</div>
          <div className="mt-1 text-[12px] text-muted-foreground">peak fill · {peak}/{TOTAL_TABLES} tables</div>
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
          <div className="flex flex-col gap-1">
            {slots.map((s) => (
              <SlotBar
                key={s.time}
                s={s}
                reservations={reservationsByHour.get(s.hour) ?? []}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEAVIEW_BLUE }} /> Seaview (11)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SOFA_GREEN }} /> Sofa (9)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STANDING_YELLOW }} /> Standing (7)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-muted/70" /> Open
            </span>
            <span className="flex items-center gap-1.5">
              <Waves className="h-3 w-3 text-sky-600" /> cap: 11→8→7→4→2→2→2
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
