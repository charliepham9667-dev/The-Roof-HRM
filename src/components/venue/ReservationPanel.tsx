import { useState, useRef, useEffect } from "react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { useDeleteReservation, useUpdateReservation } from "@/hooks/useReservations"
import type { CsvReservation } from "@/hooks/useReservationsCsv"
import { Clock, Users, Phone, Mail, ChevronDown, ChevronUp, MapPin, MessageSquare, Check, X, Pencil } from "lucide-react"

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

// ─── Inline comment widget ────────────────────────────────────────────────────

export function InlineComment({
  dbId,
  currentNote,
  canEdit,
  compact = false,
}: {
  dbId: string | null
  currentNote: string | null | undefined
  canEdit: boolean
  compact?: boolean
}) {
  const updateRes = useUpdateReservation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentNote ?? "")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Keep draft in sync when currentNote changes (e.g. after save)
  useEffect(() => {
    if (!editing) setDraft(currentNote ?? "")
  }, [currentNote, editing])

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  async function handleSave(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    if (!dbId) return
    await updateRes.mutateAsync({ id: dbId, notes: draft.trim() })
    setEditing(false)
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(currentNote ?? "")
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave(e)
    if (e.key === "Escape") { setDraft(currentNote ?? ""); setEditing(false) }
  }

  const hasNote = (currentNote ?? "").trim().length > 0

  if (!canEdit && !hasNote) return null

  if (compact) {
    // Card-size compact version for desktop sidebar cards
    return (
      <div className="mt-1.5" onPointerDown={(e) => e.stopPropagation()}>
        {editing ? (
          <div className="flex flex-col gap-1">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment… (e.g. Coming 30 min late)"
              rows={2}
              className="w-full resize-none rounded border border-primary/40 bg-background px-1.5 py-1 text-[9px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <div className="flex items-center gap-1 justify-end">
              <button type="button" onClick={handleCancel} className="rounded px-1 py-0.5 text-[8px] text-muted-foreground hover:text-foreground border border-border hover:bg-muted transition-colors">
                <X className="h-2.5 w-2.5" />
              </button>
              <button type="button" onClick={handleSave} disabled={updateRes.isPending} className="rounded px-1 py-0.5 text-[8px] bg-primary text-primary-foreground hover:bg-primary/90 border border-primary disabled:opacity-50 transition-colors">
                {updateRes.isPending ? "…" : <Check className="h-2.5 w-2.5" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-1 group/note">
            {hasNote ? (
              <>
                <MessageSquare className="h-2.5 w-2.5 text-primary/60 shrink-0 mt-0.5" />
                <span className="text-[9px] text-primary/80 italic flex-1 break-words">{currentNote}</span>
              </>
            ) : (
              <span className="text-[9px] text-muted-foreground/50 italic">No comment</span>
            )}
            {canEdit && dbId && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditing(true) }}
                className="shrink-0 opacity-0 group-hover/note:opacity-100 ml-auto transition-opacity"
                title={hasNote ? "Edit comment" : "Add comment"}
              >
                <Pencil className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // Full-size version for list rows
  return (
    <div className="mt-2" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment… (e.g. Coming 30 min late, requested window seat)"
            rows={2}
            className="w-full resize-none rounded-md border border-primary/40 bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex items-center gap-1.5 justify-between">
            <span className="text-[10px] text-muted-foreground">⌘ Enter to save · Esc to cancel</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={handleCancel} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground border border-border hover:bg-muted transition-colors">
                <X className="h-3 w-3" /> Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={updateRes.isPending} className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {updateRes.isPending ? "Saving…" : <><Check className="h-3 w-3" /> Save</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 group/note rounded-md px-2.5 py-1.5 -mx-2.5 hover:bg-muted/40 transition-colors cursor-default">
          <MessageSquare className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", hasNote ? "text-primary/70" : "text-muted-foreground/40")} />
          <div className="flex-1 min-w-0">
            {hasNote ? (
              <p className="text-xs text-foreground/80 italic break-words">{currentNote}</p>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">No comment yet</p>
            )}
          </div>
          {canEdit && dbId && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 opacity-0 group-hover/note:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted"
              title={hasNote ? "Edit comment" : "Add comment"}
            >
              <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      )}
    </div>
  )
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

  // DB-sourced cards carry the reservation UUID in `dbId`
  const dbId = reservation.dbId ?? null

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
      <InlineComment dbId={dbId} currentNote={reservation.notes} canEdit={canEdit} compact />
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

// ─── Mobile list item (non-draggable, tap to expand) ──────────────────────────

function MobileReservationListItem({
  reservation: r,
  isAllocated,
  canEdit,
}: {
  reservation: CsvReservation
  isAllocated: boolean
  canEdit: boolean
  onDelete: () => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const deleteRes = useDeleteReservation()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dbId = r.dbId ?? null
  const badge = SOURCE_BADGE[sourceFromReservation(r)] ?? SOURCE_BADGE.website

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!dbId) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    await deleteRes.mutateAsync(dbId)
    setConfirmDelete(false)
  }

  return (
    <div className={cn("transition-colors", isAllocated && "opacity-50")}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5"
      >
        <div className="flex items-start gap-3">
          {/* Time pill */}
          <div className="shrink-0 flex flex-col items-center justify-center rounded-lg bg-primary/8 border border-primary/20 px-2 py-2 min-w-[50px]">
            <Clock className="h-3 w-3 text-primary mb-0.5" />
            <span className="text-[11px] font-bold text-primary leading-none">{r.time || "—"}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate">{r.name || "Unknown"}</span>
              <span className={cn("rounded-sm border px-1 py-0.5 text-[8px] tracking-wide font-medium", badge.cls)}>
                {badge.label}
              </span>
              {isAllocated && (
                <span className="text-[9px] text-[#10b981] font-medium">✓ Seated</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span className="font-medium text-foreground">{r.numberOfGuests}</span> pax
              </span>
              {r.table && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {r.table}
                </span>
              )}
              {r.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <a href={`tel:${r.phone}`} className="hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                    {r.phone}
                  </a>
                </span>
              )}
            </div>
            {r.specialRequests && !expanded && (
              <p className="mt-1 text-[10px] text-muted-foreground italic truncate">📝 {r.specialRequests}</p>
            )}
          </div>

          <div className="shrink-0 text-muted-foreground mt-0.5">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-border/40 space-y-1.5 bg-muted/20">
          {r.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <a href={`mailto:${r.email}`} className="hover:text-foreground truncate">{r.email}</a>
            </div>
          )}
          {r.occasion && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Occasion: </span>{r.occasion}
            </div>
          )}
          {r.specialRequests && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Special Requests: </span>{r.specialRequests}
            </div>
          )}
          <InlineComment dbId={dbId} currentNote={r.notes} canEdit={canEdit} />
          {canEdit && dbId && (
            <div className="flex items-center justify-end pt-1">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">Delete this reservation?</span>
                  <button type="button" onClick={handleDelete} disabled={deleteRes.isPending} className="rounded px-2 py-0.5 text-xs bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                    {deleteRes.isPending ? "…" : "Yes, delete"}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground underline">
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 border border-red-400/30 rounded px-2 py-0.5 hover:bg-red-50 transition-colors">
                  Delete
                </button>
              )}
            </div>
          )}
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

  // Sort reservations by time
  const sorted = [...todayReservations].sort((a, b) =>
    (a.time ?? "").localeCompare(b.time ?? "")
  )
  const totalPax = sorted.reduce((sum, r) => sum + (r.numberOfGuests ?? 0), 0)

  return (
    <>
      {/* ── DESKTOP sidebar (md+) ── */}
      <div className="hidden md:flex flex-col gap-3 w-52 shrink-0 min-h-0">
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
        <div className="rounded-card border border-border bg-card shadow-card p-3 flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between mb-1 shrink-0">
            <div className="text-[9px] tracking-widest font-semibold text-foreground uppercase">Incoming Reservations</div>
            {canEdit && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={onImportCsv} className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] tracking-wide text-muted-foreground hover:bg-secondary transition-colors">
                  Import CSV
                </button>
                <button type="button" onClick={onAddManual} className="rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[8px] tracking-wide text-primary hover:bg-primary/20 transition-colors font-medium">
                  + Manual
                </button>
              </div>
            )}
          </div>
          <div className="text-[9px] text-muted-foreground italic shrink-0">Drag a reservation onto an available table to allocate it</div>
          <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-0.5">
            {sorted.length === 0 ? (
              <div className="text-[10px] text-muted-foreground italic py-2">No reservations today.</div>
            ) : (
              sorted.map((r) => {
                const uid = `res-${r.name}-${r.time}`
                return (
                  <DraggableReservationCard key={uid} reservation={r} isAllocated={allocatedIds.has(uid)} canEdit={canEdit} />
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE full-width list (< md) ── */}
      <div className="flex flex-col min-h-0 flex-1 gap-2.5 md:hidden overflow-hidden">
        {/* Stats row — compact, fixed height */}
        <div className="grid grid-cols-2 gap-2.5 shrink-0">
          <div className="rounded-xl border border-border bg-card px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-[9px] tracking-widest font-semibold text-muted-foreground uppercase">Live Status</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[
                { label: "Free",     value: totalFree,     color: "text-[#10b981]" },
                { label: "Taken",    value: totalTaken,    color: "text-[#ef4444]" },
                { label: "Reserved", value: totalReserved, color: "text-[#f59e0b]" },
              ].map((s) => (
                <div key={s.label}>
                  <div className={cn("text-base font-bold leading-none", s.color)}>{s.value}</div>
                  <div className="text-[8px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2.5 flex flex-col justify-between">
            <div className="text-[9px] tracking-widest font-semibold text-muted-foreground uppercase">Tonight</div>
            <div className="text-xl font-bold text-foreground leading-none mt-1">{confirmedPax}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">confirmed pax</div>
          </div>
        </div>

        {/* Reservations list — fills remaining height and scrolls */}
        <div className="rounded-xl border border-border bg-card flex flex-col min-h-0 flex-1 overflow-hidden">
          {/* Header — sticky */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
            <div>
              <div className="text-xs font-semibold text-foreground uppercase tracking-widest">Today's Reservations</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{dateStr} · {sorted.length} bookings · {totalPax} guests</div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={onImportCsv} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors">
                  CSV
                </button>
                <button type="button" onClick={onAddManual} className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/20 transition-colors font-medium">
                  + Add
                </button>
              </div>
            )}
          </div>

          {/* Scrollable list */}
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground text-sm">
              No reservations today
            </div>
          ) : (
            <div className="divide-y divide-border overflow-y-auto flex-1">
              {sorted.map((r, idx) => (
                <MobileReservationListItem
                  key={`mob-${r.name}-${r.time}-${idx}`}
                  reservation={r}
                  isAllocated={allocatedIds.has(`res-${r.name}-${r.time}`)}
                  canEdit={canEdit}
                  onDelete={async () => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
