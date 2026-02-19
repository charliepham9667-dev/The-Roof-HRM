import { useRef, useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { VenueTable, TableStatus } from "./FloorPlan"
import type { CsvReservation } from "@/hooks/useReservationsCsv"

// ─── Constants ─────────────────────────────────────────────────────────────────

// Timeline: 14:00 → 26:00 (02:00 next day), 24 slots × 30 min
const START_HOUR = 14   // 14:00
const END_HOUR   = 26   // 02:00 next day (26 = 14 + 12)
const SLOT_MINS  = 30
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINS  // 24

function slotLabel(slotIndex: number): string {
  const totalMins = START_HOUR * 60 + slotIndex * SLOT_MINS
  const h = Math.floor(totalMins / 60) % 24
  const m = totalMins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Convert "HH:MM" string to slot index (0-based from START_HOUR). Returns -1 if out of range. */
function timeToSlot(time: string): number {
  const [hStr, mStr] = time.split(":")
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr || "0", 10)
  // Times after midnight (00–02) map to 24–26
  if (h < START_HOUR) h += 24
  const slot = ((h - START_HOUR) * 60 + m) / SLOT_MINS
  if (slot < 0 || slot >= TOTAL_SLOTS) return -1
  return slot
}

/** Current time as a fractional slot index. Returns null if outside range. */
function nowSlot(): number | null {
  const now = new Date()
  let h = now.getHours()
  const m = now.getMinutes()
  if (h < START_HOUR) h += 24
  const slot = ((h - START_HOUR) * 60 + m) / SLOT_MINS
  if (slot < 0 || slot >= TOTAL_SLOTS) return null
  return slot
}

const STATUS_BLOCK: Record<TableStatus, string> = {
  available: "bg-[#3b82f6]/15 border-[#3b82f6]/40 text-[#1e40af]",
  reserved:  "bg-[#10b981]/20 border-[#10b981]/50 text-[#065f46]",
  occupied:  "bg-[#f97316]/15 border-[#f97316]/40 text-[#9a3412]",
}

const STATUS_CHIP_LABEL: Record<TableStatus, string> = {
  available: "Free",
  reserved:  "Booked",
  occupied:  "Occupied",
}

// ─── Block Popover ─────────────────────────────────────────────────────────────

function BlockPopover({
  reservation,
  status,
  table,
  onClose,
  onSeatGuests,
  onMarkOccupied,
  onClear,
}: {
  reservation: CsvReservation
  status: TableStatus
  table: VenueTable
  onClose: () => void
  onSeatGuests?: () => void
  onMarkOccupied?: () => void
  onClear?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute z-50 w-52 rounded-lg border border-border bg-card shadow-xl p-3 text-left"
      style={{ top: "calc(100% + 4px)", left: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-foreground">{reservation.name}</span>
        <span className={cn(
          "rounded-sm border px-1.5 py-0.5 text-[8px] font-semibold tracking-wide",
          status === "occupied" ? "bg-[#f97316]/15 text-[#9a3412] border-[#f97316]/40"
            : "bg-[#10b981]/15 text-[#065f46] border-[#10b981]/40"
        )}>
          {STATUS_CHIP_LABEL[status]}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground space-y-0.5 mb-2">
        <div>{table.label} · {table.capacity > 0 ? `${table.capacity} cap` : "no cap"}</div>
        <div className="font-medium text-foreground">{reservation.time} · {reservation.numberOfGuests} pax</div>
        {reservation.specialRequests && (
          <div className="italic text-[9px] truncate">{reservation.specialRequests}</div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {status === "reserved" && onSeatGuests && (
          <button
            type="button"
            onClick={() => { onSeatGuests(); onClose() }}
            className="w-full rounded-sm bg-[#10b981] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#059669] transition-colors text-left"
          >
            ✓ Seat Guests
          </button>
        )}
        {status !== "occupied" && onMarkOccupied && (
          <button
            type="button"
            onClick={() => { onMarkOccupied(); onClose() }}
            className="w-full rounded-sm border border-[#f97316]/30 bg-[#f97316]/10 px-2 py-1 text-[10px] font-medium text-[#9a3412] hover:bg-[#f97316]/20 transition-colors text-left"
          >
            Mark Occupied
          </button>
        )}
        {onClear && (
          <button
            type="button"
            onClick={() => { onClear(); onClose() }}
            className="w-full rounded-sm border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary transition-colors text-left"
          >
            Clear Table
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Calendar booking block ────────────────────────────────────────────────────

function BookingBlock({
  reservation,
  status,
  table,
  slotStart,
  durationSlots,
  colWidth,
  onSeatGuests,
  onMarkOccupied,
  onClear,
}: {
  reservation: CsvReservation
  status: TableStatus
  table: VenueTable
  slotStart: number
  durationSlots: number
  colWidth: number
  onSeatGuests?: () => void
  onMarkOccupied?: () => void
  onClear?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      style={{
        position: "absolute",
        left: slotStart * colWidth + 2,
        width: durationSlots * colWidth - 4,
        top: 2,
        bottom: 2,
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className={cn(
          "h-full rounded border px-1.5 flex flex-col justify-center cursor-pointer hover:brightness-95 transition-all overflow-hidden",
          STATUS_BLOCK[status],
        )}
      >
        <div className="text-[10px] font-semibold truncate leading-tight">{reservation.name}</div>
        <div className="text-[9px] opacity-75 leading-tight truncate">
          {reservation.numberOfGuests}p · {STATUS_CHIP_LABEL[status]}
        </div>
      </div>

      {open && (
        <BlockPopover
          reservation={reservation}
          status={status}
          table={table}
          onClose={() => setOpen(false)}
          onSeatGuests={onSeatGuests}
          onMarkOccupied={onMarkOccupied}
          onClear={onClear}
        />
      )}
    </div>
  )
}

// ─── VenueCalendar ─────────────────────────────────────────────────────────────

export function VenueCalendar({
  tables,
  tableStatuses,
  assignments,
  onSlotClick,
  onSeatGuests,
  onMarkOccupied,
  onClearTable,
}: {
  tables: VenueTable[]
  tableStatuses: Record<string, TableStatus>
  assignments: Record<string, CsvReservation>
  onSlotClick?: (tableId: string, time: string) => void
  onSeatGuests?: (tableId: string) => void
  onMarkOccupied?: (tableId: string) => void
  onClearTable?: (tableId: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [nowPos, setNowPos] = useState<number | null>(null)
  const [colWidth, setColWidth] = useState(52)
  const headerRef = useRef<HTMLDivElement>(null)

  const ROW_HEIGHT = 36
  const LABEL_WIDTH = 72

  // Update now-line every 30s
  useEffect(() => {
    function update() { setNowPos(nowSlot()) }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [])

  // Scroll "now" into view on mount
  useEffect(() => {
    const ns = nowSlot()
    if (ns !== null && scrollRef.current) {
      const target = ns * colWidth - scrollRef.current.clientWidth / 2
      scrollRef.current.scrollLeft = Math.max(0, target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync header scroll with body scroll
  const handleBodyScroll = useCallback(() => {
    if (headerRef.current && scrollRef.current) {
      headerRef.current.scrollLeft = scrollRef.current.scrollLeft
    }
  }, [])

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i)

  // Only show tables with capacity (skip bar stools) and not DJ
  const visibleTables = tables.filter((t) => t.capacity > 0 && t.id !== "DJ")

  const totalGridWidth = TOTAL_SLOTS * colWidth

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-xl border border-[#dad4c8] bg-[#faf7f2]">
      {/* ── Sticky header row ── */}
      <div className="flex shrink-0 border-b border-border bg-[#faf7f2] z-10">
        {/* Table label column */}
        <div
          className="shrink-0 border-r border-border bg-[#faf7f2] flex items-center px-2"
          style={{ width: LABEL_WIDTH }}
        >
          <span className="text-[9px] tracking-widest text-muted-foreground uppercase font-semibold">Table</span>
        </div>
        {/* Scrollable time labels */}
        <div
          ref={headerRef}
          className="flex-1 overflow-hidden"
          style={{ overflowX: "hidden" }}
        >
          <div className="flex" style={{ width: totalGridWidth }}>
            {slots.map((i) => (
              <div
                key={i}
                className="shrink-0 border-r border-border/50 flex items-center justify-start pl-1"
                style={{ width: colWidth, height: 28 }}
              >
                <span className="text-[9px] text-muted-foreground">{slotLabel(i)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div
        ref={scrollRef}
        className="flex flex-1 min-h-0 overflow-auto"
        onScroll={handleBodyScroll}
      >
        {/* Table labels column — sticky */}
        <div className="shrink-0 sticky left-0 z-10 bg-[#faf7f2] border-r border-border">
          {visibleTables.map((table) => (
            <div
              key={table.id}
              className="flex flex-col justify-center border-b border-border/40 px-2"
              style={{ height: ROW_HEIGHT, width: LABEL_WIDTH }}
            >
              <span className="text-[10px] font-semibold text-foreground leading-tight truncate">{table.label || table.id}</span>
              <span className="text-[8px] text-muted-foreground leading-tight">{table.capacity}p</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="relative" style={{ width: totalGridWidth, flexShrink: 0 }}>
          {/* Now-line */}
          {nowPos !== null && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: nowPos * colWidth }}
            >
              <div className="w-px h-full bg-[#d97706] opacity-80" />
              <div
                className="absolute -top-0.5 -translate-x-1/2 rounded-full bg-[#d97706] text-white text-[7px] font-bold px-1 py-px whitespace-nowrap"
              >
                NOW
              </div>
            </div>
          )}

          {/* Row backgrounds + booking blocks */}
          {visibleTables.map((table, rowIdx) => {
            const status = tableStatuses[table.id] ?? "available"
            const reservation = assignments[table.id] ?? null

            // Determine block span: default 2 slots (1 hr) if no explicit duration
            let blockStart = -1
            let blockSpan = 2
            if (reservation?.time) {
              const s = timeToSlot(reservation.time)
              if (s >= 0) {
                blockStart = s
                blockSpan = 2 // 1 hour default
              }
            }

            return (
              <div
                key={table.id}
                className={cn(
                  "absolute border-b border-border/40 flex",
                  rowIdx % 2 === 0 ? "bg-transparent" : "bg-black/[0.015]",
                )}
                style={{ top: rowIdx * ROW_HEIGHT, height: ROW_HEIGHT, width: totalGridWidth }}
              >
                {/* Slot cells — clickable for empty slots */}
                {slots.map((slotIdx) => {
                  const isOccupiedByBlock =
                    blockStart >= 0 && slotIdx >= blockStart && slotIdx < blockStart + blockSpan
                  return (
                    <div
                      key={slotIdx}
                      className={cn(
                        "shrink-0 border-r border-border/30 h-full",
                        !isOccupiedByBlock && status === "available" && "hover:bg-[#f59e0b]/10 cursor-pointer transition-colors",
                      )}
                      style={{ width: colWidth }}
                      onClick={() => {
                        if (!isOccupiedByBlock && status === "available" && onSlotClick) {
                          onSlotClick(table.id, slotLabel(slotIdx))
                        }
                      }}
                    />
                  )
                })}

                {/* Booking block overlay */}
                {reservation && blockStart >= 0 && (
                  <BookingBlock
                    reservation={reservation}
                    status={status}
                    table={table}
                    slotStart={blockStart}
                    durationSlots={blockSpan}
                    colWidth={colWidth}
                    onSeatGuests={onSeatGuests ? () => onSeatGuests(table.id) : undefined}
                    onMarkOccupied={onMarkOccupied ? () => onMarkOccupied(table.id) : undefined}
                    onClear={onClearTable ? () => onClearTable(table.id) : undefined}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Size control ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-t border-border/50 bg-[#faf7f2]">
        <span className="text-[9px] text-muted-foreground">Zoom</span>
        <input
          type="range"
          min={36}
          max={96}
          step={4}
          value={colWidth}
          onChange={(e) => setColWidth(Number(e.target.value))}
          className="w-20 accent-[#d97706]"
        />
        <span className="text-[9px] text-muted-foreground">{TOTAL_SLOTS} slots · {slotLabel(0)}–{slotLabel(TOTAL_SLOTS - 1)}</span>
      </div>
    </div>
  )
}
