import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useReservationsCsv, type CsvReservation } from "@/hooks/useReservationsCsv"
import { useReservations, useDeleteReservation } from "@/hooks/useReservations"
import { ReservationFormSheet } from "@/components/venue/ReservationFormSheet"
import type { Reservation } from "@/types"
import {
  Calendar,
  Clock,
  Users,
  Phone,
  Mail,
  MapPin,
  Plus,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  Trash2,
} from "lucide-react"

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  whatsapp:     { label: "WhatsApp", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  social_media: { label: "WhatsApp", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  website:      { label: "Website",  cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  phone:        { label: "Phone",    cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  email:        { label: "Email",    cls: "bg-violet-50 text-violet-700 border border-violet-200" },
  walk_in:      { label: "Walk-in",  cls: "bg-zinc-100 text-zinc-600 border border-zinc-200" },
}

const ICT_TZ = "Asia/Ho_Chi_Minh"

function getTodayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ICT_TZ }).formatToParts(new Date())
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString("en-US", { timeZone: ICT_TZ, weekday: "short", month: "short", day: "numeric" })
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + "T00:00:00")
  const b = new Date(isoB + "T00:00:00")
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function sourceBadge(r: CsvReservation) {
  const src = r.occasion && SOURCE_BADGE[r.occasion] ? r.occasion : "website"
  const phone = r.phone ?? ""
  if (phone.toLowerCase().includes("zalo") || phone.toLowerCase().includes("wa")) return SOURCE_BADGE.whatsapp
  return SOURCE_BADGE[src] ?? SOURCE_BADGE.website
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ReservationRow({
  r,
  canEdit,
  onEdit,
}: {
  r: CsvReservation
  canEdit: boolean
  onEdit: (r: CsvReservation) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteRes = useDeleteReservation()
  const badge = sourceBadge(r)
  const dbId = r.mustHaves ?? null

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!dbId) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    await deleteRes.mutateAsync(dbId)
    setConfirmDelete(false)
  }

  return (
    <div className="group border-b border-border last:border-0 transition-colors hover:bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-3.5"
      >
        <div className="flex items-center gap-4">
          {/* Date badge */}
          <div className="shrink-0 flex flex-col items-center justify-center rounded-lg bg-muted/60 border border-border px-2.5 py-2 min-w-[54px] text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {r.dateOfReservation ? new Date(r.dateOfReservation + "T00:00:00").toLocaleDateString("en-US", { month: "short" }) : "—"}
            </span>
            <span className="text-xl font-bold text-foreground leading-none">
              {r.dateOfReservation ? r.dateOfReservation.slice(8) : "—"}
            </span>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{r.name || "Unknown"}</span>
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", badge.cls)}>{badge.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {r.time || "—"}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {r.numberOfGuests} pax
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

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onEdit(r) }}
                className="opacity-0 group-hover:opacity-100 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-muted transition-colors"
              >
                Edit
              </button>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-4 pt-1 bg-muted/20 border-t border-border/40 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
            {r.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 shrink-0" />
                <a href={`mailto:${r.email}`} className="hover:text-foreground truncate">{r.email}</a>
              </div>
            )}
            {r.occasion && !SOURCE_BADGE[r.occasion] && (
              <div><span className="font-medium text-foreground/70">Occasion: </span>{r.occasion}</div>
            )}
            {r.specialRequests && (
              <div className="col-span-full"><span className="font-medium text-foreground/70">Special requests: </span>{r.specialRequests}</div>
            )}
            {r.specialPackages && (
              <div className="col-span-full"><span className="font-medium text-foreground/70">Package: </span>{r.specialPackages}</div>
            )}
            {r.notes && r.notes.trim() && (
              <div className="col-span-full"><span className="font-medium text-foreground/70">Notes: </span>{r.notes}</div>
            )}
          </div>
          {canEdit && dbId && (
            <div className="flex items-center justify-end pt-1 gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-xs text-destructive">Delete this reservation?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteRes.isPending}
                    className="flex items-center gap-1 rounded px-2.5 py-1 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {deleteRes.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Confirm
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground underline">Cancel</button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
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

// ─── Section header ────────────────────────────────────────────────────────────

function SectionDivider({ label, count, pax }: { label: string; count: number; pax: number }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 bg-muted/50 border-b border-border sticky top-0 z-10">
      <span className="text-xs font-bold uppercase tracking-widest text-foreground">{label}</span>
      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {count} {count === 1 ? "booking" : "bookings"}
      </span>
      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {pax} {pax === 1 ? "guest" : "guests"}
      </span>
    </div>
  )
}

// ─── Date group header ────────────────────────────────────────────────────────

function DateGroupHeader({ iso, todayIso }: { iso: string; todayIso: string }) {
  const days = daysBetween(todayIso, iso)
  const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`
  const formatted = formatDate(iso)
  return (
    <div className="flex items-center gap-3 px-5 py-2 border-b border-dashed border-border/60 bg-background">
      <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-xs font-semibold text-foreground">{formatted}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ReservationsListView({ canEdit }: { canEdit: boolean }) {
  const todayIso = getTodayIso()
  const nextMonthIso = (() => {
    const d = new Date(todayIso + "T00:00:00")
    d.setDate(d.getDate() + 60)
    return d.toISOString().slice(0, 10)
  })()

  const { data: csvAll = [], isLoading: csvLoading } = useReservationsCsv()
  const { data: dbAll = [], isLoading: dbLoading } = useReservations(todayIso, nextMonthIso)

  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)

  // Merge CSV + DB reservations (today + future only), deduplicate
  const allReservations = useMemo<CsvReservation[]>(() => {
    const merged = csvAll.filter((r) => r.status === "today" || r.status === "upcoming")
    const csvKeys = new Set(merged.map((r) => `${(r.name ?? "").toLowerCase()}|${r.dateOfReservation}|${r.time ?? ""}`))

    for (const r of dbAll) {
      const key = `${r.customerName.toLowerCase()}|${r.reservationDate}|${r.reservationTime.slice(0, 5)}`
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
          occasion: r.source ?? null,
          mustHaves: r.id,
          status: r.reservationDate === todayIso ? "today" : "upcoming",
        })
      }
    }

    // Sort by date then time
    merged.sort((a, b) => {
      const dc = (a.dateOfReservation ?? "").localeCompare(b.dateOfReservation ?? "")
      if (dc !== 0) return dc
      return (a.time ?? "").localeCompare(b.time ?? "")
    })

    return merged
  }, [csvAll, dbAll, todayIso])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allReservations
    const q = search.toLowerCase()
    return allReservations.filter((r) =>
      (r.name ?? "").toLowerCase().includes(q) ||
      (r.phone ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.specialRequests ?? "").toLowerCase().includes(q)
    )
  }, [allReservations, search])

  const todayList = filtered.filter((r) => r.dateOfReservation === todayIso)
  const upcomingList = filtered.filter((r) => r.dateOfReservation !== todayIso)

  // Group upcoming by date
  const upcomingByDate = useMemo(() => {
    const map = new Map<string, CsvReservation[]>()
    for (const r of upcomingList) {
      const key = r.dateOfReservation ?? "unknown"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return map
  }, [upcomingList])

  const todayPax = todayList.reduce((s, r) => s + r.numberOfGuests, 0)
  const upcomingPax = upcomingList.reduce((s, r) => s + r.numberOfGuests, 0)

  const isLoading = csvLoading || dbLoading

  function handleEdit(r: CsvReservation) {
    if (!r.mustHaves) return
    // Build a minimal Reservation-shaped object for the form
    setEditingReservation({
      id: r.mustHaves,
      customerName: r.name ?? "",
      customerPhone: r.phone ?? undefined,
      customerEmail: r.email ?? undefined,
      reservationDate: r.dateOfReservation ?? todayIso,
      reservationTime: r.time ?? "19:00",
      partySize: r.numberOfGuests,
      tablePreference: r.table ?? undefined,
      specialRequests: r.specialRequests ?? undefined,
      status: "confirmed",
      source: r.occasion ?? undefined,
      notes: r.notes ?? undefined,
      reminderSent: false,
      createdAt: r.submittedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-muted/10">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, phone, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
          <span>{filtered.length} reservations</span>
          <span>·</span>
          <span>{todayPax + upcomingPax} total guests</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => { setEditingReservation(null); setFormOpen(true) }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add reservation
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading reservations…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <Calendar className="h-8 w-8 opacity-30" />
            <p className="text-sm">{search ? "No reservations match your search" : "No upcoming reservations"}</p>
          </div>
        ) : (
          <>
            {/* ── Today ── */}
            {todayList.length > 0 && (
              <section>
                <SectionDivider label="Today" count={todayList.length} pax={todayPax} />
                {todayList.map((r, i) => (
                  <ReservationRow key={`t-${i}`} r={r} canEdit={canEdit} onEdit={handleEdit} />
                ))}
              </section>
            )}

            {/* ── Upcoming divider ── */}
            {upcomingList.length > 0 && (
              <section>
                <div className="flex items-center gap-3 px-5 py-3 bg-primary/5 border-y border-primary/20 sticky top-[41px] z-10">
                  <div className="h-px flex-1 bg-primary/20" />
                  <span className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Upcoming
                  </span>
                  <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {upcomingList.length} bookings · {upcomingPax} guests
                  </span>
                  <div className="h-px flex-1 bg-primary/20" />
                </div>

                {/* Group by date */}
                {Array.from(upcomingByDate.entries()).map(([date, rows]) => (
                  <div key={date}>
                    <DateGroupHeader iso={date} todayIso={todayIso} />
                    {rows.map((r, i) => (
                      <ReservationRow key={`u-${date}-${i}`} r={r} canEdit={canEdit} onEdit={handleEdit} />
                    ))}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {/* Edit / add form */}
      {canEdit && (
        <ReservationFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          reservation={editingReservation}
          defaultTable={undefined}
          defaultTime={undefined}
          defaultSource={undefined}
        />
      )}
    </div>
  )
}
