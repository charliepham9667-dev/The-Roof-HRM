import { useDroppable } from "@dnd-kit/core"
import { useRef, useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { CsvReservation } from "@/hooks/useReservationsCsv"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TableStatus = "available" | "occupied" | "reserved"

export interface VenueTable {
  id: string
  label: string
  zone: string
  capacity: number
  shape: "circle" | "rect"
  x: number  // left %
  y: number  // top %
  w?: number // explicit width px
  h?: number // explicit height px
}

// ─── Floor layout — matched to actual The Roof 3F plan ────────────────────────
//
// Canvas is 1000 × 620 virtual units (aspect ~1.61).
// x/y are percentages of canvas width/height.
// Rect tables use w/h in virtual px (scaled by CSS).

export const VENUE_TABLES: VenueTable[] = [
  // ── West VIP zone ────────────────────────────────────────────────
  { id: "VIP-L1", label: "VIP-L1", zone: "west", capacity: 6, shape: "rect",   x: 1.5, y: 12,  w: 56, h: 68 },
  { id: "T27",    label: "T27",    zone: "west", capacity: 4, shape: "circle", x: 5.5, y: 52 },
  { id: "VIP-L2", label: "VIP-L2", zone: "west", capacity: 6, shape: "rect",   x: 1.5, y: 72,  w: 56, h: 68 },

  // ── VIP 1A / 1B column ───────────────────────────────────────────
  { id: "VIP-1A", label: "VIP-1A", zone: "west", capacity: 6, shape: "rect",   x: 15,  y: 38,  w: 56, h: 68 },
  { id: "VIP-1B", label: "VIP-1B", zone: "west", capacity: 6, shape: "rect",   x: 15,  y: 64,  w: 56, h: 68 },

  // ── VIP 2A / 2B column ───────────────────────────────────────────
  { id: "VIP-2A", label: "VIP-2A", zone: "west", capacity: 6, shape: "rect",   x: 24,  y: 38,  w: 56, h: 68 },
  { id: "VIP-2B", label: "VIP-2B", zone: "west", capacity: 6, shape: "rect",   x: 24,  y: 64,  w: 56, h: 68 },

  // ── VIP 3A / 3B column ───────────────────────────────────────────
  { id: "VIP-3A", label: "VIP-3A", zone: "west", capacity: 6, shape: "rect",   x: 33,  y: 38,  w: 56, h: 68 },
  { id: "VIP-3B", label: "VIP-3B", zone: "west", capacity: 6, shape: "rect",   x: 33,  y: 64,  w: 56, h: 68 },

  // ── Bar stools (decorative, no-capacity) ─────────────────────────
  { id: "BS1", label: "", zone: "bar", capacity: 0, shape: "circle", x: 30.5, y: 17 },
  { id: "BS2", label: "", zone: "bar", capacity: 0, shape: "circle", x: 34,   y: 17 },
  { id: "BS3", label: "", zone: "bar", capacity: 0, shape: "circle", x: 37.5, y: 17 },
  { id: "BS4", label: "", zone: "bar", capacity: 0, shape: "circle", x: 41,   y: 17 },
  { id: "BS5", label: "", zone: "bar", capacity: 0, shape: "circle", x: 44.5, y: 17 },
  { id: "BS6", label: "", zone: "bar", capacity: 0, shape: "circle", x: 48,   y: 17 },
  { id: "BS7", label: "", zone: "bar", capacity: 0, shape: "circle", x: 51.5, y: 17 },
  { id: "BS8", label: "", zone: "bar", capacity: 0, shape: "circle", x: 55,   y: 17 },

  // ── Middle tables — upper row: T35, T34, T33 ─────────────────────
  { id: "T35", label: "T35", zone: "middle", capacity: 4, shape: "circle", x: 46, y: 28 },
  { id: "T34", label: "T34", zone: "middle", capacity: 4, shape: "circle", x: 52, y: 28 },
  { id: "T33", label: "T33", zone: "middle", capacity: 4, shape: "circle", x: 58, y: 28 },

  // ── Middle tables — lower row: T38, T37, T36 ─────────────────────
  { id: "T38", label: "T38", zone: "middle", capacity: 4, shape: "circle", x: 46, y: 42 },
  { id: "T37", label: "T37", zone: "middle", capacity: 4, shape: "circle", x: 52, y: 42 },
  { id: "T36", label: "T36", zone: "middle", capacity: 4, shape: "circle", x: 58, y: 42 },

  // ── East Platform — top row: T32, T31, T30 ───────────────────────
  { id: "T32", label: "T32", zone: "east", capacity: 4, shape: "circle", x: 72, y: 14 },
  { id: "T31", label: "T31", zone: "east", capacity: 4, shape: "circle", x: 79, y: 14 },
  { id: "T30", label: "T30", zone: "east", capacity: 4, shape: "circle", x: 86, y: 14 },

  // ── East Platform — second row: T21, T22 ─────────────────────────
  { id: "T21", label: "T21", zone: "east", capacity: 4, shape: "circle", x: 72, y: 28 },
  { id: "T22", label: "T22", zone: "east", capacity: 4, shape: "circle", x: 79, y: 28 },

  // ── East Platform — right column ─────────────────────────────────
  { id: "S14",  label: "S14",  zone: "east", capacity: 4, shape: "circle", x: 91, y: 37 },
  { id: "DJ",   label: "DJ",   zone: "east", capacity: 0, shape: "rect",   x: 79, y: 45, w: 62, h: 62 },
  { id: "S13",  label: "S13",  zone: "east", capacity: 4, shape: "circle", x: 91, y: 51 },
  { id: "S121", label: "S121", zone: "east", capacity: 4, shape: "circle", x: 91, y: 65 },
  { id: "S11",  label: "S11",  zone: "east", capacity: 4, shape: "circle", x: 91, y: 79 },
  { id: "S9",   label: "S9",   zone: "east", capacity: 4, shape: "circle", x: 79, y: 86 },
  { id: "S10",  label: "S10",  zone: "east", capacity: 4, shape: "circle", x: 86, y: 86 },

  // ── South Row — S1–S8 ────────────────────────────────────────────
  { id: "S1", label: "S1", zone: "south", capacity: 4, shape: "circle", x: 13,   y: 91 },
  { id: "S2", label: "S2", zone: "south", capacity: 4, shape: "circle", x: 20.5, y: 91 },
  { id: "S3", label: "S3", zone: "south", capacity: 4, shape: "circle", x: 28,   y: 91 },
  { id: "S4", label: "S4", zone: "south", capacity: 4, shape: "circle", x: 35.5, y: 91 },
  { id: "S5", label: "S5", zone: "south", capacity: 4, shape: "circle", x: 43,   y: 91 },
  { id: "S6", label: "S6", zone: "south", capacity: 4, shape: "circle", x: 50.5, y: 91 },
  { id: "S7", label: "S7", zone: "south", capacity: 4, shape: "circle", x: 58,   y: 91 },
  { id: "S8", label: "S8", zone: "south", capacity: 4, shape: "circle", x: 65.5, y: 91 },
]

// ─── Colours ───────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<TableStatus, { circle: string; rect: string }> = {
  available: {
    circle: "bg-[#3b82f6] border-[#60a5fa] text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]",
    rect:   "bg-[#3b82f6]/90 border-[#60a5fa] text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]",
  },
  reserved: {
    circle: "bg-[#10b981] border-[#34d399] text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    rect:   "bg-[#10b981]/90 border-[#34d399] text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]",
  },
  occupied: {
    circle: "bg-[#f97316] border-[#fb923c] text-white shadow-[0_0_8px_rgba(249,115,22,0.5)]",
    rect:   "bg-[#f97316]/90 border-[#fb923c] text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]",
  },
}

const STATUS_CHIP: Record<TableStatus, { label: string; cls: string }> = {
  available: { label: "Free",     cls: "bg-[#3b82f6]/20 text-[#1e40af] border-[#3b82f6]/40" },
  reserved:  { label: "Booked",   cls: "bg-[#10b981]/20 text-[#065f46] border-[#10b981]/40" },
  occupied:  { label: "Occupied", cls: "bg-[#f97316]/20 text-[#9a3412] border-[#f97316]/40" },
}

// ─── Table Popover ─────────────────────────────────────────────────────────────

function TablePopover({
  table,
  status,
  reservation,
  onClose,
  onSeatGuests,
  onMarkOccupied,
  onClear,
  onAddReservation,
  onAddWalkIn,
}: {
  table: VenueTable
  status: TableStatus
  reservation: CsvReservation | null
  onClose: () => void
  onSeatGuests?: () => void
  onMarkOccupied?: () => void
  onClear?: () => void
  onAddReservation?: () => void
  onAddWalkIn?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [onClose])

  const chip = STATUS_CHIP[status]

  return (
    <div
      ref={ref}
      className="absolute z-50 w-52 rounded-lg border border-border bg-card shadow-xl p-3 text-left"
      style={{ top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-foreground">{table.label || table.id}</span>
        <span className={cn("rounded-sm border px-1.5 py-0.5 text-[8px] font-semibold tracking-wide", chip.cls)}>
          {chip.label}
        </span>
      </div>

      {/* Capacity + reservation info */}
      <div className="text-[10px] text-muted-foreground mb-2.5">
        {table.capacity > 0 ? `Capacity: ${table.capacity} pax` : "No seating"}
        {reservation && (
          <div className="mt-1 font-medium text-foreground">
            {reservation.name}
            <span className="font-normal text-muted-foreground ml-1">· {reservation.numberOfGuests} pax · {reservation.time}</span>
          </div>
        )}
        {reservation?.specialRequests && (
          <div className="mt-0.5 text-[9px] italic text-muted-foreground/70 truncate">{reservation.specialRequests}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1">
        {/* Primary: seat / mark occupied */}
        {status === "reserved" && reservation && onSeatGuests && (
          <button
            type="button"
            onClick={() => { onSeatGuests(); onClose() }}
            className="w-full rounded-sm bg-[#10b981] px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-[#059669] transition-colors text-left"
          >
            ✓ Seat Guests
          </button>
        )}
        {status !== "occupied" && onMarkOccupied && (
          <button
            type="button"
            onClick={() => { onMarkOccupied(); onClose() }}
            className="w-full rounded-sm border border-[#f97316]/30 bg-[#f97316]/10 px-2 py-1.5 text-[10px] font-medium text-[#9a3412] hover:bg-[#f97316]/20 transition-colors text-left"
          >
            Mark Occupied
          </button>
        )}

        {/* Divider before booking actions */}
        {(onAddReservation || onAddWalkIn) && (
          <div className="border-t border-border/60 my-0.5" />
        )}

        {/* Add reservation */}
        {onAddReservation && (
          <button
            type="button"
            onClick={() => { onAddReservation(); onClose() }}
            className="w-full rounded-sm border border-border px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-secondary transition-colors text-left flex items-center gap-1.5"
          >
            <span className="text-[11px]">📋</span> Add Reservation
          </button>
        )}

        {/* Walk-in */}
        {onAddWalkIn && (
          <button
            type="button"
            onClick={() => { onAddWalkIn(); onClose() }}
            className="w-full rounded-sm border border-border px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-secondary transition-colors text-left flex items-center gap-1.5"
          >
            <span className="text-[11px]">🚶</span> Walk-in
          </button>
        )}

        {/* Clear */}
        {status !== "available" && onClear && (
          <>
            <div className="border-t border-border/60 my-0.5" />
            <button
              type="button"
              onClick={() => { onClear(); onClose() }}
              className="w-full rounded-sm border border-border px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary transition-colors text-left"
            >
              Clear Table
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Droppable table (normal mode) ─────────────────────────────────────────────

function DroppableTable({
  table,
  status,
  assignedReservation,
  onClick,
  scale,
  onSeatGuests,
  onMarkOccupied,
  onClear,
  onAddReservation,
  onAddWalkIn,
}: {
  table: VenueTable
  status: TableStatus
  assignedReservation?: CsvReservation | null
  onClick: (t: VenueTable) => void
  scale: number
  onSeatGuests?: (tableId: string) => void
  onMarkOccupied?: (tableId: string) => void
  onClear?: (tableId: string) => void
  onAddReservation?: (tableId: string) => void
  onAddWalkIn?: (tableId: string) => void
}) {
  const isBarStool = table.zone === "bar"
  const isDJ = table.id === "DJ"
  const isClickable = !isBarStool && !isDJ

  const [popoverOpen, setPopoverOpen] = useState(false)

  const { setNodeRef, isOver } = useDroppable({
    id: table.id,
    data: { table },
    disabled: isBarStool || isDJ,
  })

  const cls = STATUS_CLS[status]
  const chip = STATUS_CHIP[status]

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isClickable) return
    e.stopPropagation()
    setPopoverOpen((v) => !v)
    onClick(table)
  }, [isClickable, onClick, table])

  if (table.shape === "rect") {
    return (
      <div
        ref={isDJ ? undefined : setNodeRef}
        onClick={handleClick}
        style={{
          left: `${table.x}%`,
          top: `${table.y}%`,
          width: (table.w ?? 56) * scale,
          height: (table.h ?? 68) * scale,
          zIndex: popoverOpen ? 30 : undefined,
        }}
        className={cn(
          "absolute flex flex-col items-center justify-center rounded-lg border-2 transition-all",
          isDJ
            ? "bg-[#1e293b] border-[#334155] text-[#94a3b8] cursor-default"
            : [cls.rect, "cursor-pointer hover:brightness-110 hover:scale-[1.03]"],
          isOver && !isDJ && "ring-2 ring-white/60 scale-[1.05]",
        )}
      >
        {(() => {
          const labelSz = Math.round(9  * scale)
          const subSz   = Math.round(7  * scale)
          const chipSz  = Math.round(7  * scale)
          return (
            <>
              <span style={{ fontSize: labelSz }} className="font-bold tracking-wide leading-none">{table.label}</span>
              {!isDJ && !isBarStool && (
                <>
                  <span style={{ fontSize: chipSz }} className={cn("mt-0.5 rounded-sm border px-1 py-px font-semibold leading-none", chip.cls)}>
                    {assignedReservation ? `Booked · ${assignedReservation.time}` : chip.label}
                  </span>
                  {assignedReservation && (
                    <span style={{ fontSize: subSz }} className="font-semibold mt-0.5 truncate max-w-[80%] px-0.5 opacity-90">
                      {assignedReservation.name?.split(" ")[0]}
                    </span>
                  )}
                  <span style={{ fontSize: subSz }} className="opacity-70 mt-0.5">{table.capacity}p</span>
                </>
              )}
            </>
          )
        })()}

        {/* Popover */}
        {popoverOpen && isClickable && (
          <TablePopover
            table={table}
            status={status}
            reservation={assignedReservation ?? null}
            onClose={() => setPopoverOpen(false)}
            onSeatGuests={onSeatGuests ? () => onSeatGuests(table.id) : undefined}
            onMarkOccupied={onMarkOccupied ? () => onMarkOccupied(table.id) : undefined}
            onClear={onClear ? () => onClear(table.id) : undefined}
            onAddReservation={onAddReservation ? () => onAddReservation(table.id) : undefined}
            onAddWalkIn={onAddWalkIn ? () => onAddWalkIn(table.id) : undefined}
          />
        )}
      </div>
    )
  }

  const circlePx = Math.round(44 * scale)

  if (isBarStool) {
    // Bar stools: fixed 20px, never scale
    return (
      <div
        style={{ left: `${table.x}%`, top: `${table.y}%`, width: 20, height: 20 }}
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#374151] border border-[#4b5563]"
      />
    )
  }

  const labelSize  = Math.round(9  * scale)
  const subSize    = Math.round(7  * scale)
  const chipSize   = Math.round(6  * scale)

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      style={{ left: `${table.x}%`, top: `${table.y}%`, width: circlePx, height: circlePx, zIndex: popoverOpen ? 30 : undefined }}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:brightness-110 hover:scale-110",
        cls.circle,
        isOver && "ring-2 ring-white/60 scale-110",
      )}
    >
      <span style={{ fontSize: labelSize }} className="font-bold leading-none">{table.label}</span>
      {assignedReservation ? (
        <>
          <span style={{ fontSize: subSize }} className="leading-none mt-0.5 font-semibold opacity-95 truncate max-w-[80%]">
            {assignedReservation.name?.split(" ")[0]}
          </span>
          <span style={{ fontSize: chipSize }} className="leading-none mt-px opacity-80">{assignedReservation.time}</span>
        </>
      ) : (
        <span style={{ fontSize: chipSize }} className={cn("mt-0.5 rounded-sm border px-1 py-px font-semibold leading-none", chip.cls)}>
          {chip.label}
        </span>
      )}

      {/* Popover */}
      {popoverOpen && (
        <TablePopover
          table={table}
          status={status}
          reservation={assignedReservation ?? null}
          onClose={() => setPopoverOpen(false)}
          onSeatGuests={onSeatGuests ? () => onSeatGuests(table.id) : undefined}
          onMarkOccupied={onMarkOccupied ? () => onMarkOccupied(table.id) : undefined}
          onClear={onClear ? () => onClear(table.id) : undefined}
          onAddReservation={onAddReservation ? () => onAddReservation(table.id) : undefined}
          onAddWalkIn={onAddWalkIn ? () => onAddWalkIn(table.id) : undefined}
        />
      )}
    </div>
  )
}

// ─── Editable table (edit mode) ────────────────────────────────────────────────

function EditableTable({
  table,
  onMove,
  onRename,
  onDelete,
  scale,
}: {
  table: VenueTable
  onMove: (id: string, x: number, y: number) => void
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
  scale: number
}) {
  const [renaming, setRenaming] = useState(false)
  const [draftLabel, setDraftLabel] = useState(table.label)
  const inputRef = useRef<HTMLInputElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (renaming) inputRef.current?.focus()
  }, [renaming])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (renaming) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = false

    const canvas = containerRef.current?.parentElement
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: (e.clientX - rect.left) / rect.width * 100,
      oy: (e.clientY - rect.top) / rect.height * 100,
    }
  }, [renaming])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return
    const dx = Math.abs(e.clientX - dragStart.current.mx)
    const dy = Math.abs(e.clientY - dragStart.current.my)
    if (dx > 3 || dy > 3) isDragging.current = true

    if (!isDragging.current) return

    const canvas = containerRef.current?.parentElement
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    const newX = Math.min(98, Math.max(0, (e.clientX - rect.left) / rect.width * 100))
    const newY = Math.min(98, Math.max(0, (e.clientY - rect.top) / rect.height * 100))
    onMove(table.id, newX, newY)
  }, [onMove, table.id])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    dragStart.current = null
    isDragging.current = false
  }, [])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDraftLabel(table.label)
    setRenaming(true)
  }, [table.label])

  const commitRename = useCallback(() => {
    onRename(table.id, draftLabel.trim() || table.label)
    setRenaming(false)
  }, [onRename, table.id, draftLabel, table.label])

  const isBarStool = table.zone === "bar"
  const isDJ = table.id === "DJ"

  const circlePx = Math.round(44 * scale)

  const baseStyle: React.CSSProperties = {
    left: `${table.x}%`,
    top: `${table.y}%`,
    ...(table.shape === "rect"
      ? { width: (table.w ?? 56) * scale, height: (table.h ?? 68) * scale }
      : isBarStool
        ? { width: 20, height: 20 }  // bar stools: fixed size
        : { width: circlePx, height: circlePx }),
  }

  const sharedClasses = cn(
    "absolute border-2 border-dashed border-blue-400 bg-blue-500/20 text-white flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none ring-2 ring-blue-400/50",
    table.shape === "rect" ? "rounded-lg" : "-translate-x-1/2 -translate-y-1/2 rounded-full",
  )

  return (
    <div
      ref={containerRef}
      style={baseStyle}
      className={sharedClasses}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {renaming ? (
        <input
          ref={inputRef}
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename()
            if (e.key === "Escape") { setDraftLabel(table.label); setRenaming(false) }
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-[90%] bg-white/90 text-gray-900 text-[9px] font-bold text-center rounded px-1 py-0.5 outline-none border border-blue-400"
        />
      ) : (
        <>
          {!isBarStool && (
            <span className="text-[9px] font-bold leading-none text-center px-0.5 truncate max-w-full">
              {isDJ ? "DJ" : table.label}
            </span>
          )}
          {!isDJ && !isBarStool && (
            <span className="text-[7px] opacity-70 mt-0.5">{table.capacity}p</span>
          )}
        </>
      )}
      {/* drag handle indicator */}
      {!renaming && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[6px] text-white">
          ✥
        </span>
      )}
      {/* delete button */}
      {!renaming && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(table.id) }}
          className="absolute -top-1 -left-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 hover:bg-red-400 text-white text-[8px] leading-none transition-colors z-10"
          title="Delete table"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ─── FloorPlan ─────────────────────────────────────────────────────────────────

export function FloorPlan({
  tables,
  tableStatuses,
  assignments,
  onTableClick,
  editMode = false,
  onMove,
  onRename,
  onDelete,
  tableScale = 1,
  onSeatGuests,
  onMarkOccupied,
  onClearTable,
  onAddReservation,
  onAddWalkIn,
}: {
  tables: VenueTable[]
  tableStatuses: Record<string, TableStatus>
  assignments: Record<string, CsvReservation>
  onTableClick: (table: VenueTable) => void
  editMode?: boolean
  onMove?: (id: string, x: number, y: number) => void
  onRename?: (id: string, label: string) => void
  onDelete?: (id: string) => void
  tableScale?: number
  onSeatGuests?: (tableId: string) => void
  onMarkOccupied?: (tableId: string) => void
  onClearTable?: (tableId: string) => void
  onAddReservation?: (tableId: string) => void
  onAddWalkIn?: (tableId: string) => void
}) {
  return (
    <div
      className={cn(
        "relative w-full rounded-xl overflow-hidden border select-none",
        editMode ? "border-blue-400 border-2" : "border-[#dad4c8]",
      )}
      style={{ paddingBottom: "62%", background: "#faf7f2" }}
    >
      {editMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white text-[10px] font-semibold px-3 py-1 rounded-full shadow-lg pointer-events-none">
          Edit Mode — drag to reposition · double-click to rename · × to delete
        </div>
      )}

      {!editMode && (
        <div className="absolute top-2 right-3 z-10 text-[9px] text-muted-foreground/60 italic pointer-events-none">
          Click a table for details · Drag a reservation to book
        </div>
      )}

      {/* ── West Platform zone border ─────────────────────── */}
      <div
        className="absolute rounded-lg border border-dashed border-[#7f1d1d]/70"
        style={{ left: "0.5%", top: "7%", width: "10%", height: "83%" }}
      >
        <span className="absolute -bottom-4 left-1 text-[7px] tracking-widest text-[#ef4444]/60 uppercase whitespace-nowrap">West</span>
      </div>

      {/* ── Main Bar ─────────────────────────────────────── */}
      <div
        className="absolute flex items-center justify-center rounded-lg border border-[#334155]"
        style={{ left: "29%", top: "2%", width: "29%", height: "10%", background: "#1e293b" }}
      >
        <span className="text-[10px] font-bold tracking-[0.2em] text-[#94a3b8] uppercase">Main Bar</span>
      </div>

      {/* ── East Platform zone border ─────────────────────── */}
      <div
        className="absolute rounded-lg border border-dashed border-[#7f1d1d]/70"
        style={{ left: "68%", top: "7%", width: "30%", height: "83%" }}
      >
        <span className="absolute -top-3 right-2 bg-white px-1 text-[7px] tracking-widest text-[#94a3b8]/60 uppercase">East Platform</span>
      </div>

      {/* ── All tables ───────────────────────────────────── */}
      {tables.map((table) =>
        editMode ? (
          <EditableTable
            key={table.id}
            table={table}
            onMove={onMove ?? (() => {})}
            onRename={onRename ?? (() => {})}
            onDelete={onDelete ?? (() => {})}
            scale={tableScale}
          />
        ) : (
          <DroppableTable
            key={table.id}
            table={table}
            status={tableStatuses[table.id] ?? "available"}
            assignedReservation={assignments[table.id] ?? null}
            onClick={onTableClick}
            scale={tableScale}
            onSeatGuests={onSeatGuests}
            onMarkOccupied={onMarkOccupied}
            onClear={onClearTable}
            onAddReservation={onAddReservation}
            onAddWalkIn={onAddWalkIn}
          />
        )
      )}
    </div>
  )
}
