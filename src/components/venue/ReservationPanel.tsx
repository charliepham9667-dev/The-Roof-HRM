import { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { useDeleteReservation } from "@/hooks/useReservations"
import type { CsvReservation } from "@/hooks/useReservationsCsv"

// ─── Source badge ──────────────────────────────────────────────────────────────

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  whatsapp:     { label: "WHATSAPP", cls: "bg-[#10b981]/10 text-[#065f46] border-[#10b981]/20" },
  social_media: { label: "WHATSAPP", cls: "bg-[#10b981]/10 text-[#065f46] border-[#10b981]/20" },
  website:      { label: "WEBSITE",  cls: "bg-[#3b82f6]/10 text-[#1e40af] border-[#3b82f6]/20" },
  phone:        { label: "PHONE",    cls: "bg-[#f59e0b]/10 text-[#92400e] border-[#f59e0b]/20" },
  email:        { label: "EMAIL",    cls: "bg-[#8b5cf6]/10 text-[#5b21b6] border-[#8b5cf6]/20" },
  walk_in:      { label: "WALK-IN",  cls: "bg-[#6b7280]/10 text-[#374151] border-[#6b7280]/20" },
}

function sourceFromReservation(reservation: CsvReservation): string {
  // DB-sourced reservations encode their source in the `occasion` field
  if (reservation.occasion && SOURCE_BADGE[reservation.occasion]) return reservation.occasion
  // CSV-sourced (Google Form submissions) — default to website
  const phone = reservation.phone ?? ""
  if (phone.toLowerCase().includes("zalo") || phone.toLowerCase().includes("wa")) return "whatsapp"
  return "website"
}

// ─── Draggable reservation card ────────────────────────────────────────────────

function DraggableReservationCard({
  reservation,
  isAllocated,
  canEdit,
}: {
  reservation: CsvReservation
  isAllocated: boolean
  canEdit: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `res-${reservation.name}-${reservation.time}`,
    data: { reservation },
    disabled: isAllocated,
  })

  const deleteRes = useDeleteReservation()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // DB-sourced cards store the reservation UUID in `mustHaves`
  const dbId = reservation.mustHaves ?? null

  const badge = SOURCE_BADGE[sourceFromReservation(reservation)] ?? SOURCE_BADGE.phone

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!dbId) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    await deleteRes.mutateAsync(dbId)
    setConfirmDelete(false)
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative rounded-sm border border-border bg-card p-2.5 select-none transition-all",
        isAllocated ? "opacity-40 cursor-not-allowed" : "cursor-grab hover:border-primary/40 hover:shadow-sm active:cursor-grabbing",
        isDragging && "opacity-30 rotate-1 shadow-lg",
        confirmDelete && "border-red-400 bg-red-50",
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="text-xs font-medium text-foreground truncate">{reservation.name || "—"}</div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn("rounded-sm border px-1 py-0.5 text-[8px] tracking-wide font-medium", badge.cls)}>
            {badge.label}
          </span>
          {/* Delete button — only for DB-sourced reservations that canEdit */}
          {canEdit && dbId && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleDelete}
              disabled={deleteRes.isPending}
              title={confirmDelete ? "Click again to confirm delete" : "Delete reservation"}
              className={cn(
                "rounded-sm px-1 py-0.5 text-[8px] font-medium border transition-colors disabled:opacity-50",
                confirmDelete
                  ? "border-red-400 bg-red-500 text-white hover:bg-red-600"
                  : "border-border text-muted-foreground opacity-0 group-hover:opacity-100 hover:border-red-400 hover:text-red-500 hover:bg-red-50",
              )}
            >
              {deleteRes.isPending ? "…" : confirmDelete ? "Sure?" : "✕"}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>⏰ {reservation.time || "—"}</span>
        <span>👥 {reservation.numberOfGuests} pax</span>
      </div>
      {reservation.specialRequests && (
        <div className="mt-1 text-[9px] text-muted-foreground/70 italic truncate">{reservation.specialRequests}</div>
      )}
      {isAllocated && (
        <div className="mt-1 text-[9px] text-[#10b981] font-medium">✓ Seated</div>
      )}
      {confirmDelete && (
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className="text-[9px] text-red-600 font-medium">Delete this reservation?</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
            className="text-[8px] text-muted-foreground hover:text-foreground underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── ReservationPanel ──────────────────────────────────────────────────────────

export function ReservationPanel({
  totalFree,
  totalTaken,
  totalReserved,
  totalCapacity,
  confirmedPax,
  todayReservations,
  allocatedIds,
  canEdit,
  onAddManual,
  onImportCsv,
}: {
  totalFree: number
  totalTaken: number
  totalReserved: number
  totalCapacity: number
  confirmedPax: number
  todayReservations: CsvReservation[]
  allocatedIds: Set<string>
  canEdit: boolean
  onAddManual: () => void
  onImportCsv: () => void
}) {
  const today = new Date()
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" })
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  return (
    <div className="flex flex-col gap-3 w-52 shrink-0">
      {/* Live table status */}
      <div className="rounded-card border border-border bg-card shadow-card p-3">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-[10px] tracking-widest font-semibold text-foreground uppercase">Live Table Status</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "FREE",     value: totalFree,     color: "text-[#10b981]" },
            { label: "TAKEN",    value: totalTaken,    color: "text-[#ef4444]" },
            { label: "RESERVED", value: totalReserved, color: "text-[#f59e0b]" },
          ].map((s) => (
            <div key={s.label}>
              <div className={cn("text-lg font-bold leading-none", s.color)}>{s.value}</div>
              <div className="text-[8px] tracking-widest text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
          Total capacity <span className="font-semibold text-foreground">{totalCapacity} pax</span>
          {" · "}Tonight's bookings:{" "}
          <span className="font-semibold text-primary">{confirmedPax} confirmed</span>
        </div>
      </div>

      {/* Shift / date */}
      <div className="rounded-card border border-border bg-card shadow-card p-3 space-y-1.5">
        <div className="text-[9px] tracking-widest text-muted-foreground uppercase">Shift</div>
        <div className="text-base font-semibold text-foreground">{dayName}</div>
        <div className="text-[10px] text-muted-foreground">{dateStr}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px]">🕐</span>
          <span className="rounded-sm border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-1.5 py-0.5 text-[9px] text-[#92400e]">
            Opening Hours: 14:00 – 02:00 AM
          </span>
        </div>
      </div>

      {/* Incoming reservations */}
      <div className="rounded-card border border-border bg-card shadow-card p-3 flex-1 flex flex-col gap-2 overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[9px] tracking-widest font-semibold text-foreground uppercase">Incoming Reservations</div>
          {canEdit && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onImportCsv}
                className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] tracking-wide text-muted-foreground hover:bg-secondary transition-colors"
              >
                Import CSV
              </button>
              <button
                type="button"
                onClick={onAddManual}
                className="rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[8px] tracking-wide text-primary hover:bg-primary/20 transition-colors font-medium"
              >
                + Manual
              </button>
            </div>
          )}
        </div>

        <div className="text-[9px] text-muted-foreground italic">Drag a reservation onto an available table to allocate it</div>

        <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5">
          {todayReservations.length === 0 ? (
            <div className="text-[10px] text-muted-foreground italic py-2">No reservations today.</div>
          ) : (
            todayReservations.map((r) => {
              const uid = `res-${r.name}-${r.time}`
              return (
                <DraggableReservationCard
                  key={uid}
                  reservation={r}
                  isAllocated={allocatedIds.has(uid)}
                  canEdit={canEdit}
                />
              )
            })
          )}

        </div>
      </div>
    </div>
  )
}
