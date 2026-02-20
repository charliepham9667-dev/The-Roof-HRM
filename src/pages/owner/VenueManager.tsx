import { useState, useCallback } from "react"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"
import { useTodayReservationsCsv } from "@/hooks/useReservationsCsv"
import { useTodayReservations } from "@/hooks/useReservations"
import { FloorPlan, VENUE_TABLES, type TableStatus, type VenueTable } from "@/components/venue/FloorPlan"
import { ReservationPanel } from "@/components/venue/ReservationPanel"
import { ReservationFormSheet } from "@/components/venue/ReservationFormSheet"
import { VenueCalendar } from "@/components/venue/VenueCalendar"
import type { CsvReservation } from "@/hooks/useReservationsCsv"
import type { Reservation } from "@/types"

const LAYOUT_STORAGE_KEY = "venue-layout-v1"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function canEditReservations(profile: any): boolean {
  if (!profile) return false
  if (profile.role === "owner") return true
  if (profile.managerType === "floor") return true
  const job = (profile.jobRole || "").toLowerCase()
  return job === "cashier" || job === "receptionist"
}

function loadLayout(): VenueTable[] {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as VenueTable[]
  } catch {}
  return VENUE_TABLES
}

function saveLayout(tables: VenueTable[]) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(tables))
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
      {[
        { label: "Free",     dot: "bg-[#3b82f6]", glow: "shadow-[0_0_6px_rgba(59,130,246,0.7)]" },
        { label: "Booked",   dot: "bg-[#10b981]", glow: "shadow-[0_0_6px_rgba(16,185,129,0.7)]" },
        { label: "Occupied", dot: "bg-[#f97316]", glow: "shadow-[0_0_6px_rgba(249,115,22,0.7)]" },
      ].map((l) => (
        <div key={l.label} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", l.dot, l.glow)} />
          {l.label}
        </div>
      ))}
    </div>
  )
}

// ─── VenueManager page ─────────────────────────────────────────────────────────

export function VenueManager() {
  const profile = useAuthStore((s) => s.profile)
  const canEdit = canEditReservations(profile)

  const { data: csvReservations = [] } = useTodayReservationsCsv()
  const { data: dbReservations = [] } = useTodayReservations()

  // Merge DB reservations (manually created) into the CsvReservation format
  // so they appear in the panel alongside Google-Sheet-sourced ones.
  const allReservations: CsvReservation[] = (() => {
    const merged = [...csvReservations]
    const csvKeys = new Set(csvReservations.map((r) => `${(r.name ?? "").toLowerCase()}|${r.time ?? ""}`))
    for (const r of dbReservations) {
      const key = `${r.customerName.toLowerCase()}|${r.reservationTime.slice(0, 5)}`
      if (!csvKeys.has(key)) {
        merged.push({
          submittedAt: r.createdAt,
          email: r.customerEmail ?? null,
          phone: r.customerPhone ?? null,
          name: r.customerName,
          table: r.tablePreference ?? null,
          notes: r.notes ?? null,
          dateOfReservation: r.reservationDate,
          dateRaw: r.reservationDate,
          time: r.reservationTime.slice(0, 5),
          numberOfGuests: r.partySize,
          specialRequests: r.specialRequests ?? null,
          specialPackages: null,
          // Encode the DB source in `occasion` so the panel badge shows the correct source
          occasion: r.source ?? null,
          // Encode the DB row ID in `mustHaves` so the panel can offer a delete action
          mustHaves: r.id,
          status: "today",
        })
      }
    }
    return merged.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
  })()

  // ── View tab ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"floor" | "calendar">("floor")

  // ── Layout state ────────────────────────────────────────────────────────────
  const [tables, setTables] = useState<VenueTable[]>(loadLayout)
  const [editMode, setEditMode] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)
  const [tableScale, setTableScale] = useState(1)

  // ── Table status + assignments ───────────────────────────────────────────────
  const [tableStatuses, setTableStatuses] = useState<Record<string, TableStatus>>({})
  const [assignments, setAssignments] = useState<Record<string, CsvReservation>>({})
  const [allocatedIds, setAllocatedIds] = useState<Set<string>>(new Set())

  // ── Form sheet ───────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [defaultTable, setDefaultTable] = useState<string | undefined>()
  const [defaultTime, setDefaultTime] = useState<string | undefined>()
  const [defaultSource, setDefaultSource] = useState<string | undefined>()

  // ── Drag overlay ─────────────────────────────────────────────────────────────
  const [activeReservation, setActiveReservation] = useState<CsvReservation | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Computed totals
  const totalCapacity = tables.reduce((s, t) => s + t.capacity, 0)
  const confirmedPax = allReservations.reduce((s, r) => s + r.numberOfGuests, 0)
  const totalTaken = Object.values(tableStatuses).filter((s) => s === "occupied").length
  const totalReserved = Object.values(tableStatuses).filter((s) => s === "reserved").length
  const totalFree = tables.filter((t) => t.capacity > 0).length - totalTaken - totalReserved

  // ── Layout edit handlers ─────────────────────────────────────────────────────

  const handleMove = useCallback((id: string, x: number, y: number) => {
    setTables((prev) => prev.map((t) => t.id === id ? { ...t, x, y } : t))
  }, [])

  const handleRename = useCallback((id: string, label: string) => {
    setTables((prev) => prev.map((t) => t.id === id ? { ...t, label } : t))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleSaveLayout = useCallback(() => {
    saveLayout(tables)
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2000)
    setEditMode(false)
  }, [tables])

  const handleResetLayout = useCallback(() => {
    if (!confirm("Reset layout to factory default? This cannot be undone.")) return
    localStorage.removeItem(LAYOUT_STORAGE_KEY)
    setTables(VENUE_TABLES)
    setEditMode(false)
  }, [])

  const handleDiscardEdit = useCallback(() => {
    setTables(loadLayout())
    setEditMode(false)
  }, [])

  // ── Table popover action handlers ─────────────────────────────────────────────

  const handleSeatGuests = useCallback((tableId: string) => {
    setTableStatuses((prev) => ({ ...prev, [tableId]: "occupied" }))
  }, [])

  const handleMarkOccupied = useCallback((tableId: string) => {
    setTableStatuses((prev) => ({ ...prev, [tableId]: "occupied" }))
  }, [])

  const handleClearTable = useCallback((tableId: string) => {
    setTableStatuses((prev) => {
      const next = { ...prev }
      delete next[tableId]
      return next
    })
    setAssignments((prev) => {
      const next = { ...prev }
      const res = next[tableId]
      if (res) {
        const uid = `res-${res.name}-${res.time}`
        setAllocatedIds((ids) => {
          const s = new Set(ids)
          s.delete(uid)
          return s
        })
      }
      delete next[tableId]
      return next
    })
  }, [])

  const handleAddReservation = useCallback((tableId: string) => {
    const table = tables.find((t) => t.id === tableId)
    setEditingReservation(null)
    setDefaultTable(table?.label ?? tableId)
    setDefaultTime(undefined)
    setDefaultSource(undefined)
    setFormOpen(true)
  }, [tables])

  const handleAddWalkIn = useCallback((tableId: string) => {
    const table = tables.find((t) => t.id === tableId)
    setEditingReservation(null)
    setDefaultTable(table?.label ?? tableId)
    setDefaultTime(undefined)
    setDefaultSource("walk_in")
    setFormOpen(true)
  }, [tables])

  // ── Reservation handlers ─────────────────────────────────────────────────────

  const handleTableClick = useCallback((_table: VenueTable) => {
    // Popover handles actions; this is now a no-op (popover is self-contained)
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const res = event.active.data.current?.reservation as CsvReservation | undefined
    setActiveReservation(res ?? null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveReservation(null)
    if (!over) return
    const reservation = active.data.current?.reservation as CsvReservation | undefined
    const table = over.data.current?.table as VenueTable | undefined
    if (!reservation || !table || table.capacity === 0) return
    const uid = `res-${reservation.name}-${reservation.time}`
    setAssignments((prev) => ({ ...prev, [table.id]: reservation }))
    setTableStatuses((prev) => ({ ...prev, [table.id]: "reserved" }))
    setAllocatedIds((prev) => new Set([...prev, uid]))
  }, [])

  const handleAddManual = useCallback(() => {
    setEditingReservation(null)
    setDefaultTable(undefined)
    setDefaultTime(undefined)
    setDefaultSource(undefined)
    setFormOpen(true)
  }, [])

  const handleImportCsv = useCallback(() => {
    alert("CSV import: connect your Google Sheet in Settings to auto-sync reservations.")
  }, [])

  // Calendar slot click → pre-fill time in form
  const handleSlotClick = useCallback((tableId: string, time: string) => {
    const table = tables.find((t) => t.id === tableId)
    setEditingReservation(null)
    setDefaultTable(table?.label ?? tableId)
    setDefaultTime(time)
    setDefaultSource(undefined)
    setFormOpen(true)
  }, [tables])

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* ── Page header ── */}
      <div className="shrink-0">
        {/* Row 1: title + view toggle */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold leading-tight text-foreground">Venue Manager</h1>
            <p className="mt-1 text-sm text-muted-foreground">The Roof · 3F</p>
          </div>

          {/* View toggle — moved here from underline tabs */}
          <div className="flex items-center gap-1 mt-1 shrink-0">
            <button
              type="button"
              onClick={() => { setActiveTab("floor"); setEditMode(false) }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border",
                activeTab === "floor"
                  ? "border-[#78350F]/30 bg-[#78350F]/10 text-[#78350F]"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="6" height="6" rx="1"/>
                <rect x="9" y="1" width="6" height="6" rx="1"/>
                <rect x="1" y="9" width="6" height="6" rx="1"/>
                <rect x="9" y="9" width="6" height="6" rx="1"/>
              </svg>
              <span className="hidden sm:inline">2D Floor Plan</span>
              <span className="sm:hidden">2D</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("calendar"); setEditMode(false) }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border",
                activeTab === "calendar"
                  ? "border-[#78350F]/30 bg-[#78350F]/10 text-[#78350F]"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="3" width="14" height="12" rx="1.5"/>
                <path d="M5 1v4M11 1v4M1 7h14"/>
              </svg>
              Calendar
            </button>
          </div>
        </div>

        {/* Row 2: controls toolbar — wraps on mobile */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {activeTab === "floor" && !editMode && <Legend />}

          {savedNotice && (
            <span className="text-xs font-medium text-green-600 animate-pulse">Layout saved!</span>
          )}

          {/* Table size slider — floor plan only */}
          {activeTab === "floor" && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Table size</span>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={tableScale}
                onChange={(e) => setTableScale(Number(e.target.value))}
                className="w-24 accent-blue-600"
              />
              <span className="text-[11px] text-muted-foreground w-7 text-right">{Math.round(tableScale * 100)}%</span>
            </div>
          )}

          {activeTab === "floor" && profile?.role === "owner" && !editMode && (
            <>
              <button
                type="button"
                onClick={handleResetLayout}
                className="rounded-sm border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Reset Layout
              </button>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="rounded-sm bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
              >
                Edit Layout
              </button>
            </>
          )}

          {activeTab === "floor" && editMode && (
            <>
              <span className="hidden sm:inline text-[11px] text-blue-600 font-medium">
                Drag to reposition · Double-click to rename · × to delete
              </span>
              <button
                type="button"
                onClick={handleDiscardEdit}
                className="rounded-sm border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveLayout}
                className="rounded-sm bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 transition-colors"
              >
                Save Layout
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Mobile banner — floor plan only visible on md+ */}
        {activeTab === "floor" && (
          <div className="md:hidden flex items-center gap-2 rounded-lg border border-info/20 bg-info/8 px-4 py-2.5 text-sm text-info shrink-0">
            <span>🖥</span>
            <span>Floor plan available on tablet and desktop</span>
          </div>
        )}

        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

          {/* Left panel — full width on mobile when floor tab is active */}
          {!editMode && (
            <div className={cn(
              activeTab === "floor" ? "w-full md:w-auto" : "hidden",
              activeTab === "calendar" && "hidden",
              "md:block"
            )}>
              <ReservationPanel
                totalFree={Math.max(0, totalFree)}
                totalTaken={totalTaken}
                totalReserved={totalReserved}
                totalCapacity={totalCapacity}
                confirmedPax={confirmedPax}
                todayReservations={allReservations}
                allocatedIds={allocatedIds}
                canEdit={canEdit}
                onAddManual={handleAddManual}
                onImportCsv={handleImportCsv}
              />
            </div>
          )}

          {/* Main view — canvas hidden on mobile for floor tab */}
          <div className={cn(
            "flex-1 min-w-0 flex flex-col",
            activeTab === "floor" && "hidden md:flex",
          )}>
            {activeTab === "floor" && (
              <FloorPlan
                tables={tables}
                tableStatuses={tableStatuses}
                assignments={assignments}
                onTableClick={handleTableClick}
                editMode={editMode}
                onMove={handleMove}
                onRename={handleRename}
                onDelete={handleDelete}
                tableScale={tableScale}
                onSeatGuests={handleSeatGuests}
                onMarkOccupied={handleMarkOccupied}
                onClearTable={handleClearTable}
                onAddReservation={handleAddReservation}
                onAddWalkIn={handleAddWalkIn}
              />
            )}

            {activeTab === "calendar" && (
              <VenueCalendar
                tables={tables}
                tableStatuses={tableStatuses}
                assignments={assignments}
                onSlotClick={handleSlotClick}
                onSeatGuests={handleSeatGuests}
                onMarkOccupied={handleMarkOccupied}
                onClearTable={handleClearTable}
              />
            )}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeReservation ? (
            <div className="rounded-sm border border-primary bg-card p-2 shadow-xl w-44 rotate-1 opacity-90 pointer-events-none">
              <div className="text-xs font-medium text-foreground">{activeReservation.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {activeReservation.time} · {activeReservation.numberOfGuests} pax
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Reservation form sheet */}
      {canEdit && (
        <ReservationFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          reservation={editingReservation}
          defaultTable={defaultTable}
          defaultTime={defaultTime}
          defaultSource={defaultSource}
        />
      )}
    </div>
  )
}

export default VenueManager
