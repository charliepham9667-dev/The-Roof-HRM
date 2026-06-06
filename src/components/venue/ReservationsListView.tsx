import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useReservationsCsv, type CsvReservation } from "@/hooks/useReservationsCsv"
import { useReservations, useDeleteReservation } from "@/hooks/useReservations"
import { ReservationFormSheet } from "@/components/venue/ReservationFormSheet"
import { InlineComment } from "@/components/venue/ReservationPanel"
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
        className="w-full text-left px-3 py-3 sm:px-5 sm:py-3.5"
      >
        <div className="flex items-start gap-2.5 sm:items-center sm:gap-4">
          {/* Date badge */}
          <div className="shrink-0 flex min-w-[46px] flex-col items-center justify-center rounded-lg border border-border bg-muted/60 px-2 py-1.5 text-center sm:min-w-[54px] sm:px-2.5 sm:py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {r.dateOfReservation ? new Date(r.dateOfReservation + "T00:00:00").toLocaleDateString("en-US", { month: "short" }) : "—"}
            </span>
            <span className="text-lg font-bold leading-none text-foreground sm:text-xl">
              {r.dateOfReservation ? r.dateOfReservation.slice(8) : "—"}
            </span>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-foreground">{r.name || "Unknown"}</span>
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", badge.cls)}>{badge.label}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {canEdit && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onEdit(r) }}
                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    Edit
                  </button>
                )}
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                {r.time || "—"}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 shrink-0" />
                {r.numberOfGuests} pax
              </span>
              {r.table && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {r.table}
                </span>
              )}
              {r.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3 shrink-0" />
                  <a href={`tel:${r.phone}`} className="hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                    {r.phone}
                  </a>
                </span>
              )}
            </div>
            {r.specialRequests && !expanded && (
              <p className="mt-1 line-clamp-2 text-[10px] italic text-muted-foreground">📝 {r.specialRequests}</p>
            )}
            {r.notes && r.notes.trim() && !expanded && (
              <p className="mt-0.5 line-clamp-2 text-[10px] italic text-primary/70">
                💬 {r.notes}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="space-y-2 border-t border-border/40 bg-muted/20 px-3 pb-4 pt-1 sm:px-5">
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
          </div>
          <div className="pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Staff comment</p>
            <InlineComment dbId={dbId} currentNote={r.notes} canEdit={canEdit} />
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
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 sm:gap-3 sm:px-5 sm:py-2.5">
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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-dashed border-border/60 bg-background px-3 py-2 sm:gap-3 sm:px-5">
      <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
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
      source: (r.occasion as import("@/types").ReservationSource | undefined) ?? "website",
      notes: r.notes ?? undefined,
      reminderSent: false,
      createdAt: r.submittedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setFormOpen(true)
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Toolbar — stacked on mobile so Add reservation is never clipped */}
      <div className="shrink-0 flex flex-col gap-2.5 border-b border-border bg-muted/10 px-3 py-3 sm:px-5 sm:py-3.5">
        <div className="relative min-w-0 w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:py-1.5"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <p className="text-xs text-muted-foreground">
            <span>{filtered.length} reservations</span>
            <span className="mx-1.5 text-border">·</span>
            <span>{todayPax + upcomingPax} total guests</span>
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => { setEditingReservation(null); setFormOpen(true) }}
              className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto sm:py-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add reservation
            </button>
          )}
        </div>
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
                <div className="sticky top-[41px] z-10 flex flex-col items-center gap-2 border-y border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:gap-3 sm:px-5">
                  <div className="hidden h-px flex-1 bg-primary/20 sm:block" />
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                    <Calendar className="h-3.5 w-3.5" />
                    Upcoming
                  </span>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {upcomingList.length} bookings · {upcomingPax} guests
                  </span>
                  <div className="hidden h-px flex-1 bg-primary/20 sm:block" />
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
