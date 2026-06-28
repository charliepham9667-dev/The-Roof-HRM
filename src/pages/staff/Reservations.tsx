import { useMemo, useState } from 'react'
import {
  Calendar,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Star,
  RefreshCw,
  Loader2,
  Ban,
  MapPin,
  Plus,
} from 'lucide-react'
import { useReservationsCsv, type CsvReservation } from '@/hooks/useReservationsCsv'
import { useWebFormReservations, useDeclinedReservations } from '@/hooks/useWebFormReservations'
import { useReservations } from '@/hooks/useReservations'
import type { Reservation } from '@/types'
import { ReservationFormSheet } from '@/components/venue/ReservationFormSheet'

// Manual reservations live in the HRM `reservations` table (entered via the form,
// phone/walk-in bookings). Map them into the shared shape so staff can see them too.
function dbReservationToCsv(r: Reservation, todayIso: string): CsvReservation {
  return {
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
    mustHaves: null,
    status: r.reservationDate === todayIso ? 'today' : 'upcoming',
    bookingStatus: 'accepted' as const, // manually entered = confirmed
    dbId: r.id,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIctTodayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).formatToParts(
    new Date(),
  )
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}`
}

function formatDateShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTodayFull() {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function dedupeReservations(a: CsvReservation[], b: CsvReservation[]): CsvReservation[] {
  const seen = new Set<string>()
  const result: CsvReservation[] = []
  for (const r of [...a, ...b]) {
    // Dedup by name + date + time — consistent across CSV and Supabase sources
    const nameKey = (r.name ?? '').toLowerCase().trim()
    const phoneKey = (r.phone ?? '').replace(/\D/g, '').slice(-9)
    const timeKey = (r.time ?? '').slice(0, 5)
    const dateKey = r.dateOfReservation ?? ''
    // Use phone if available (more reliable), fall back to name
    const key = phoneKey.length >= 7
      ? `${phoneKey}|${dateKey}|${timeKey}`
      : `${nameKey}|${dateKey}|${timeKey}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(r)
    }
  }
  return result
}

// ─── Reservation card ─────────────────────────────────────────────────────────

function ReservationCard({
  r,
  highlight = false,
  showDate = false,
}: {
  r: CsvReservation
  highlight?: boolean
  showDate?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails =
    r.specialRequests || r.specialPackages || r.occasion || r.mustHaves || r.table || r.notes

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-colors ${
        highlight ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        className={`flex w-full items-start gap-3 px-4 py-4 text-left ${hasDetails ? 'active:bg-muted/40' : ''}`}
      >
        {/* Time badge */}
        <div
          className={`flex shrink-0 flex-col items-center justify-center rounded-xl px-2.5 py-2 min-w-[54px] ${
            highlight ? 'bg-primary/10' : 'bg-muted/50'
          }`}
        >
          <Clock className={`mb-0.5 h-3 w-3 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
          <span
            className={`text-xs font-bold leading-none tabular-nums ${
              highlight ? 'text-primary' : 'text-foreground'
            }`}
          >
            {r.time ?? '—'}
          </span>
          {showDate && r.dateOfReservation && (
            <span className="mt-1 text-[9px] font-medium text-muted-foreground leading-none">
              {new Date(r.dateOfReservation + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Name + badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-[15px] text-foreground truncate">
              {r.name || 'Guest'}
            </span>
            {r.specialPackages && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                <Star className="h-2.5 w-2.5" />
                {r.specialPackages}
              </span>
            )}
            {r.responseType === 'confirm' && r.responseChannels?.includes('Guest self-confirm') && (
              <span className="inline-flex items-center rounded-full bg-emerald-600 border border-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                ✓ Confirmed
              </span>
            )}
          </div>

          {/* Pax + table */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 shrink-0" />
              <span className="font-semibold text-foreground">{r.numberOfGuests}</span>
              {r.numberOfGuests === 1 ? ' guest' : ' guests'}
            </span>
            {r.table && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {r.table}
              </span>
            )}
            {r.occasion && r.occasion !== 'website' && r.occasion !== 'whatsapp' && (
              <span className="capitalize text-muted-foreground/70">{r.occasion}</span>
            )}
          </div>

          {/* Special requests preview */}
          {r.specialRequests && !expanded && (
            <p className="mt-1.5 text-[12px] italic text-muted-foreground line-clamp-1">
              📝 {r.specialRequests}
            </p>
          )}
        </div>

        {/* Expand toggle */}
        {hasDetails && (
          <div className="shrink-0 mt-1 text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="space-y-2 border-t border-border/50 px-4 pb-4 pt-3">
          {r.specialRequests && (
            <div className="text-[12.5px] text-foreground/80">
              <span className="font-semibold text-foreground/60 uppercase text-[10px] tracking-wide">
                Special requests{' '}
              </span>
              {r.specialRequests}
            </div>
          )}
          {r.mustHaves && r.mustHaves.trim() && (
            <div className="text-[12.5px] text-foreground/80">
              <span className="font-semibold text-foreground/60 uppercase text-[10px] tracking-wide">
                Must haves{' '}
              </span>
              {r.mustHaves}
            </div>
          )}
          {r.notes && r.notes.trim() && (
            <div className="text-[12.5px] text-foreground/80">
              <span className="font-semibold text-foreground/60 uppercase text-[10px] tracking-wide">
                Notes{' '}
              </span>
              {r.notes}
            </div>
          )}
          {r.occasion && r.occasion !== 'website' && r.occasion !== 'whatsapp' && (
            <div className="text-[12.5px] text-foreground/80">
              <span className="font-semibold text-foreground/60 uppercase text-[10px] tracking-wide">
                Occasion{' '}
              </span>
              <span className="capitalize">{r.occasion}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Declined card (compact) ──────────────────────────────────────────────────

function DeclinedCard({ r }: { r: CsvReservation }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-200/50 bg-red-50/40 px-4 py-3 opacity-70">
      <Ban className="h-4 w-4 shrink-0 text-red-400" />
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium text-foreground/70">{r.name || 'Guest'}</span>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {r.dateOfReservation && (
            <span className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {formatDateShort(r.dateOfReservation)}
            </span>
          )}
          {r.time && (
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {r.time}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-2.5 w-2.5" />
            {r.numberOfGuests}
          </span>
        </div>
      </div>
      <span className="shrink-0 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
        Declined
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StaffReservations() {
  const todayIso = getIctTodayIso()

  const {
    data: csvData = [],
    isLoading: csvLoading,
    refetch: refetchCsv,
    isFetching: csvFetching,
  } = useReservationsCsv()

  const {
    data: supabaseData = [],
    isLoading: supaLoading,
    refetch: refetchSupa,
    isFetching: supaFetching,
  } = useWebFormReservations()

  const {
    data: declinedData = [],
    isLoading: declinedLoading,
    refetch: refetchDeclined,
  } = useDeclinedReservations()

  // Manual reservations from the HRM table (today → next 30 days)
  const dbCutoffIso = useMemo(() => {
    const d = new Date(todayIso + 'T00:00:00')
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  }, [todayIso])
  const {
    data: dbData = [],
    isLoading: dbLoading,
    refetch: refetchDb,
    isFetching: dbFetching,
  } = useReservations(todayIso, dbCutoffIso)

  const [declinedOpen, setDeclinedOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const isLoading = csvLoading || supaLoading || dbLoading
  const isFetching = csvFetching || supaFetching || dbFetching

  function refetchAll() {
    refetchCsv()
    refetchSupa()
    refetchDeclined()
    refetchDb()
  }

  // Merge CSV + website + manual (HRM) reservations, dedupe — confirmed only (no pending shown to staff)
  const allActive = useMemo(() => {
    const confirmedSupabase = supabaseData.filter(
      (r) => r.bookingStatus === 'accepted' || !r.bookingStatus,
    )
    // CSV entries are all accepted (manually entered = confirmed)
    const confirmedCsv = csvData.filter(
      (r) => r.bookingStatus === 'accepted' || !r.bookingStatus,
    )
    // Manual HRM reservations — drop cancelled / no-show / completed
    const confirmedDb = dbData
      .filter((r) => !['cancelled', 'no_show', 'completed'].includes(r.status))
      .map((r) => dbReservationToCsv(r, todayIso))
    return dedupeReservations(confirmedCsv, [...confirmedSupabase, ...confirmedDb])
  }, [csvData, supabaseData, dbData, todayIso])

  // Today's reservations sorted by time
  const todayList = useMemo(
    () =>
      allActive
        .filter((r) => r.dateOfReservation === todayIso)
        .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [allActive, todayIso],
  )

  // Upcoming (future dates) sorted by date then time, next 14 days
  const upcomingList = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 14)
    const cutoffIso = cutoff.toISOString().slice(0, 10)
    return allActive
      .filter((r) => r.dateOfReservation && r.dateOfReservation > todayIso && r.dateOfReservation <= cutoffIso)
      .sort((a, b) => {
        const dc = (a.dateOfReservation ?? '').localeCompare(b.dateOfReservation ?? '')
        return dc !== 0 ? dc : (a.time ?? '').localeCompare(b.time ?? '')
      })
  }, [allActive, todayIso])

  // Group upcoming by date
  const upcomingByDate = useMemo(() => {
    const groups: Record<string, CsvReservation[]> = {}
    for (const r of upcomingList) {
      const d = r.dateOfReservation ?? 'unknown'
      if (!groups[d]) groups[d] = []
      groups[d].push(r)
    }
    return groups
  }, [upcomingList])

  // KPIs
  const todayPax = todayList.reduce((s, r) => s + r.numberOfGuests, 0)
  const upcomingPax = upcomingList.reduce((s, r) => s + r.numberOfGuests, 0)
  const totalGuests = todayPax + upcomingPax

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-24">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Reservations</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{formatTodayFull()}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={refetchAll}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 active:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 active:bg-primary/80"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Today */}
        <div className="flex flex-col rounded-2xl border border-border bg-card px-3.5 py-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Today
          </span>
          <span className="mt-1 text-3xl font-bold text-foreground leading-none tabular-nums">
            {todayList.length}
          </span>
          <span className="mt-1 text-[11px] text-muted-foreground">
            {todayPax} {todayPax === 1 ? 'guest' : 'guests'}
          </span>
        </div>

        {/* Upcoming */}
        <div className="flex flex-col rounded-2xl border border-border bg-card px-3.5 py-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Upcoming
          </span>
          <span className="mt-1 text-3xl font-bold text-foreground leading-none tabular-nums">
            {upcomingList.length}
          </span>
          <span className="mt-1 text-[11px] text-muted-foreground">next 14 days</span>
        </div>

        {/* Total guests */}
        <div className="flex flex-col rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">
            Total Pax
          </span>
          <span className="mt-1 text-3xl font-bold text-primary leading-none tabular-nums">
            {totalGuests}
          </span>
          <span className="mt-1 text-[11px] text-primary/60">upcoming</span>
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-3 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading reservations…</span>
        </div>
      ) : (
        <>
          {/* ── TODAY ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Tonight</span>
              <div className="h-px flex-1 bg-primary/15" />
              <span className="text-xs font-semibold text-primary/60">{todayPax} pax</span>
            </div>

            {todayList.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
                <Calendar className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No reservations tonight</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayList.map((r, i) => (
                  <ReservationCard
                    key={r.reservationSystemId ?? `today-${i}`}
                    r={r}
                    highlight={true}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── UPCOMING ── */}
          {upcomingList.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400 ring-4 ring-blue-400/15" />
                <span className="text-xs font-bold uppercase tracking-widest text-blue-500">
                  Upcoming
                </span>
                <div className="h-px flex-1 bg-blue-500/15" />
                <span className="text-xs font-semibold text-blue-400/60">
                  {upcomingList.length} reservations
                </span>
              </div>

              <div className="space-y-4">
                {Object.entries(upcomingByDate).map(([date, items]) => {
                  const datePax = items.reduce((s, r) => s + r.numberOfGuests, 0)
                  return (
                    <div key={date}>
                      {/* Date subheader */}
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {formatDateShort(date)}
                        </span>
                        <div className="h-px flex-1 bg-border/60" />
                        <span className="text-[11px] text-muted-foreground/60">{datePax} pax</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((r, i) => (
                          <ReservationCard
                            key={r.reservationSystemId ?? `upcoming-${date}-${i}`}
                            r={r}
                            highlight={false}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── DECLINED ── */}
          {(declinedData.length > 0 || declinedLoading) && (
            <section>
              <button
                type="button"
                onClick={() => setDeclinedOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-xl border border-red-200/50 bg-red-50/30 px-4 py-3 text-left transition-colors active:bg-red-50"
              >
                <Ban className="h-4 w-4 shrink-0 text-red-400" />
                <span className="flex-1 text-[13px] font-semibold text-red-700/80">
                  Declined & Cancelled
                </span>
                <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">
                  {declinedData.length}
                </span>
                {declinedOpen ? (
                  <ChevronUp className="h-4 w-4 text-red-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-red-400" />
                )}
              </button>

              {declinedOpen && (
                <div className="mt-2 space-y-2">
                  {declinedLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    declinedData
                      .filter((r) => r.dateOfReservation && r.dateOfReservation >= todayIso)
                      .sort((a, b) => (a.dateOfReservation ?? '').localeCompare(b.dateOfReservation ?? ''))
                      .map((r, i) => (
                        <DeclinedCard key={r.reservationSystemId ?? `declined-${i}`} r={r} />
                      ))
                  )}
                  {!declinedLoading &&
                    declinedData.filter((r) => r.dateOfReservation && r.dateOfReservation >= todayIso)
                      .length === 0 && (
                      <p className="py-3 text-center text-[12.5px] text-muted-foreground">
                        No declined reservations for upcoming dates
                      </p>
                    )}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <ReservationFormSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        reservation={null}
        defaultSource="phone"
      />
    </div>
  )
}
