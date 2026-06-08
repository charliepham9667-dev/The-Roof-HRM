import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useReservationsCsv, type CsvReservation } from "@/hooks/useReservationsCsv"
import { useWebFormReservations, useDeclinedReservations } from "@/hooks/useWebFormReservations"
import { useConversations } from "@/hooks/useInbox"
import { DeclinedLostLog } from "@/components/venue/DeclinedLostLog"
import { CapacityFullView } from "@/components/venue/CapacityFullView"
import { CapacityWidget } from "@/components/venue/CapacityWidget"
import { ResponderModal } from "@/components/venue/ResponderModal"
import { ReservationsListView } from "@/components/venue/ReservationsListView"
import { GuestCRM } from "@/components/venue/GuestCRM"
import { useAuthStore } from "@/stores/authStore"
import { AIInbox } from "@/components/venue/AIInbox"
import {
  Calendar, Clock, Users, MessageCircle, ChevronRight, CheckCircle,
  Globe, BarChart2, Ban, Loader2,
} from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ICT_TZ = "Asia/Ho_Chi_Minh"
function getTodayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ICT_TZ }).formatToParts(new Date())
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`
}

// Derive country from phone prefix (best-effort)
const PHONE_FLAGS: [string, string, string][] = [
  ["+84",  "🇻🇳", "Vietnam"],
  ["+44",  "🇬🇧", "United Kingdom"],
  ["+1",   "🇺🇸", "United States"],
  ["+61",  "🇦🇺", "Australia"],
  ["+82",  "🇰🇷", "South Korea"],
  ["+886", "🇹🇼", "Taiwan"],
  ["+81",  "🇯🇵", "Japan"],
  ["+33",  "🇫🇷", "France"],
  ["+49",  "🇩🇪", "Germany"],
  ["+353", "🇮🇪", "Ireland"],
  ["+65",  "🇸🇬", "Singapore"],
  ["+66",  "🇹🇭", "Thailand"],
]
function flagFromPhone(phone: string | null): string {
  if (!phone) return ""
  for (const [prefix, flag] of PHONE_FLAGS) {
    if (phone.startsWith(prefix)) return flag
  }
  return ""
}
function countryFromPhone(phone: string | null): string {
  if (!phone) return ""
  for (const [prefix, , country] of PHONE_FLAGS) {
    if (phone.startsWith(prefix)) return country
  }
  return ""
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, tone = "primary", onClick,
}: {
  label: string
  value: number | string
  sub: string
  icon: React.ReactNode
  tone?: "primary" | "warning" | "success" | "info"
  onClick?: () => void
}) {
  const toneColor = { primary: "var(--primary)", warning: "#a06820", success: "#2e7a52", info: "#2c5f9e" }[tone]
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border/60 bg-card p-4 shadow-sm",
        onClick && "cursor-pointer transition-colors hover:bg-muted/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: toneColor + "18", color: toneColor }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 text-[30px] font-bold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">{sub}</div>
    </div>
  )
}

// ─── Widget wrapper ───────────────────────────────────────────────────────────

function Widget({
  title, icon, action, children, onHeaderClick,
}: {
  title: string
  icon: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  onHeaderClick?: () => void
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div
        onClick={onHeaderClick}
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3.5",
          onHeaderClick && "cursor-pointer transition-colors hover:bg-muted/30",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <span className="text-[13.5px] font-semibold text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {onHeaderClick && <ChevronRight className="h-4 w-4 text-muted-foreground/60" />}
        </div>
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  )
}

// ─── Pending approvals queue ──────────────────────────────────────────────────

function PendingQueue({
  pending,
  onRespond,
}: {
  pending: CsvReservation[]
  onRespond: (r: CsvReservation) => void
}) {
  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-center text-muted-foreground">
        <CheckCircle className="h-5 w-5 text-emerald-500" />
        <p className="text-[13px]">All caught up — no pending approvals.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {pending.map((r) => {
        const responded = !!r.respondedAt
        return (
          <div
            key={r.reservationSystemId ?? r.name}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-2.5"
          >
            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-semibold text-foreground truncate max-w-[160px]">
                  {r.name}
                </span>
                <span className="text-[13px]">{flagFromPhone(r.phone)}</span>
                {/* Response badge */}
                {responded ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                    <Clock className="h-2.5 w-2.5" />
                    Responded · awaiting reply
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      border: "1px dashed #d8c08a",
                      color: "#a06820",
                      background: "transparent",
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#c9a23f" }} />
                    Not responded
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />{r.time ?? "—"}
                </span>
                <span className="flex items-center gap-0.5">
                  <Users className="h-2.5 w-2.5" />{r.numberOfGuests} pax
                </span>
                {r.occasion && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                    {r.occasion === "website" ? "Website" : r.occasion === "whatsapp" || r.occasion === "social_media" ? "WhatsApp" : r.occasion}
                  </span>
                )}
              </div>
            </div>
            {/* Respond button */}
            <button
              type="button"
              onClick={() => onRespond(r)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
                responded
                  ? "border border-border bg-card text-foreground hover:bg-muted"
                  : "bg-primary text-white hover:bg-primary/90",
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {responded ? "Resend / update" : "Respond"}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Declined & Lost mini-widget ──────────────────────────────────────────────

function DeclinedMini({ rows }: { rows: CsvReservation[] }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No declined or lost reservations.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.slice(0, 5).map((r) => {
        const st =
          r.bookingStatus === "declined" ? { dot: "#b83232", label: "Declined",  cls: "bg-red-50 text-red-600 border-red-200" } :
          r.bookingStatus === "noshow"   ? { dot: "#b83232", label: "No Show",   cls: "bg-red-50 text-red-600 border-red-200" } :
                                           { dot: "#82786a", label: "Cancelled", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" }
        const reason = r.responseMessage ?? (r.bookingStatus === "noshow" ? "Did not arrive" : "Cancelled")
        return (
          <div
            key={r.reservationSystemId ?? r.name}
            className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-2.5"
          >
            <span className="h-2 w-2 shrink-0 rounded-full mt-0.5" style={{ background: st.dot }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-semibold">{r.name}</span>
                <span className="text-[12px]">{flagFromPhone(r.phone)}</span>
                <span className="text-[11.5px] text-muted-foreground">
                  {r.dateOfReservation} · {r.time} · {r.numberOfGuests} pax
                </span>
              </div>
              {reason && (
                <p className="mt-0.5 truncate text-[11.5px] italic text-muted-foreground">{reason}</p>
              )}
            </div>
            <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold", st.cls)}>
              {st.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Nationality bar list ─────────────────────────────────────────────────────

function NatList({ reservations }: { reservations: CsvReservation[] }) {
  const nats = useMemo(() => {
    const map: Record<string, { flag: string; name: string; count: number }> = {}
    for (const r of reservations) {
      const flag = flagFromPhone(r.phone)
      if (!flag) continue
      const country = countryFromPhone(r.phone) || flag
      const key = flag
      if (!map[key]) map[key] = { flag, name: country, count: 0 }
      map[key].count++
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [reservations])

  const max = Math.max(...nats.map((n) => n.count), 1)

  if (nats.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No nationality data yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {nats.map((n) => (
        <div key={n.flag}>
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="flex items-center gap-1.5">
              <span className="text-[14px]">{n.flag}</span>
              <span className="text-foreground/80">{n.name}</span>
            </span>
            <span className="font-semibold text-muted-foreground">{n.count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(n.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Booking source donut (simple) ────────────────────────────────────────────

const SRC_COLORS: Record<string, string> = {
  website:      "#2c5f9e",
  whatsapp:     "#2e7a52",
  social_media: "#2e7a52",
  walk_in:      "#82786a",
  phone:        "#a06820",
  instagram:    "#6a4fa3",
  staff:        "#c74c3c",
}
const SRC_LABELS: Record<string, string> = {
  website: "Website", whatsapp: "WhatsApp", social_media: "WhatsApp",
  walk_in: "Walk-in", phone: "Phone", instagram: "Instagram", staff: "Staff",
}

function BookingSource({ reservations }: { reservations: CsvReservation[] }) {
  const sources = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of reservations) {
      const src = r.occasion ?? "website"
      map[src] = (map[src] ?? 0) + 1
    }
    return Object.entries(map)
      .map(([key, count]) => ({ key, label: SRC_LABELS[key] ?? key, count, color: SRC_COLORS[key] ?? "#c74c3c" }))
      .sort((a, b) => b.count - a.count)
  }, [reservations])

  const total = sources.reduce((a, s) => a + s.count, 0)
  if (total === 0) return <p className="text-[13px] text-muted-foreground">No source data yet.</p>

  // Simple SVG donut
  const r = 40, thick = 10, circ = 2 * Math.PI * r
  let offset = 0
  const segments = sources.map((s) => {
    const dash = (s.count / total) * circ
    const gap = circ - dash
    const seg = { ...s, dash, gap, offset }
    offset += dash
    return seg
  })

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
        <svg width={100} height={100} viewBox="-50 -50 100 100" style={{ transform: "rotate(-90deg)" }}>
          {segments.map((seg) => (
            <circle
              key={seg.key}
              r={r} cx={0} cy={0}
              fill="none"
              stroke={seg.color}
              strokeWidth={thick}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold">{total}</span>
          <span className="text-[10px] text-muted-foreground">bookings</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {sources.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: s.color }} />
            <span className="flex-1 text-foreground">{s.label}</span>
            <span className="font-semibold text-muted-foreground">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type TabId = "overview" | "reservations" | "capacity" | "inbox" | "guests"

const TABS: { id: TabId; label: string }[] = [
  { id: "overview",     label: "Overview" },
  { id: "reservations", label: "Reservations" },
  { id: "capacity",     label: "Capacity" },
  { id: "inbox",        label: "AI Inbox" },
  { id: "guests",       label: "Guests" },
]

// ─── canEdit helper ───────────────────────────────────────────────────────────

function canEditReservations(profile: any): boolean {
  if (!profile) return false
  if (profile.role === "owner") return true
  if (profile.managerType === "floor") return true
  const job = (profile.jobRole ?? "").toLowerCase()
  return job === "cashier" || job === "receptionist"
}

// ─── Main export ──────────────────────────────────────────────────────────────

type AnalyticsRange = "tonight" | "week" | "month"

const RANGE_LABELS: { id: AnalyticsRange; label: string }[] = [
  { id: "tonight", label: "Tonight" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
]

export function ReservationOverview() {
  const profile = useAuthStore((s) => s.profile)
  const canEdit = canEditReservations(profile)
  const todayIso = getTodayIso()

  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [responderRes, setResponderRes] = useState<CsvReservation | null>(null)
  const [showDeclinedLog, setShowDeclinedLog] = useState(false)
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("tonight")

  const { data: webFormAll = [], isLoading: webLoading } = useWebFormReservations()
  const { data: sheetAll = [], isLoading: sheetLoading } = useReservationsCsv()
  const { data: declinedRows = [] } = useDeclinedReservations()
  const { data: conversations = [] } = useConversations()

  const isLoading = webLoading || sheetLoading

  // Merge Supabase + Google Sheets, deduplicated by name+date+time
  const allReservations = useMemo<CsvReservation[]>(() => {
    const merged = [...webFormAll]
    const seenKeys = new Set(
      merged.map((r) => `${(r.name ?? "").toLowerCase()}|${r.dateOfReservation}|${(r.time ?? "").slice(0, 5)}`)
    )
    for (const r of sheetAll) {
      const key = `${(r.name ?? "").toLowerCase()}|${r.dateOfReservation}|${(r.time ?? "").slice(0, 5)}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        merged.push(r)
      }
    }
    return merged
  }, [webFormAll, sheetAll])

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  const todayReservations = allReservations.filter((r) => r.dateOfReservation === todayIso)
  const pending = todayReservations.filter((r) => r.bookingStatus === "pending")
  const accepted = todayReservations.filter((r) => r.bookingStatus === "accepted")
  const guestsToday = todayReservations
    .filter((r) => ["pending", "accepted"].includes(r.bookingStatus ?? ""))
    .reduce((a, r) => a + r.numberOfGuests, 0)
  const notResponded = pending.filter((r) => !r.respondedAt).length

  // Analytics range filter (for Nationality + Booking Source widgets)
  const analyticsReservations = useMemo(() => {
    if (analyticsRange === "tonight") return todayReservations
    const days = analyticsRange === "week" ? 7 : 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffIso = cutoff.toISOString().slice(0, 10)
    return allReservations.filter((r) => (r.dateOfReservation ?? "") >= cutoffIso)
  }, [analyticsRange, todayReservations, allReservations])

  // ── Declined log view ──
  if (showDeclinedLog) {
    return <DeclinedLostLog onBack={() => setShowDeclinedLog(false)} />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="-mx-0 flex gap-0.5 overflow-x-auto border-b border-border/60">
        {TABS.map((t) => {
          const active = activeTab === t.id
          const pill =
            t.id === "overview" && pending.length > 0 ? pending.length :
            t.id === "inbox" && totalUnread > 0 ? totalUnread : null
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {pill != null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    t.id === "inbox"
                      ? "bg-red-100 text-red-600"
                      : "bg-amber-100 text-amber-700",
                  )}
                >
                  {pill}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Reservations Today"
              value={todayReservations.length}
              sub={`${guestsToday} guests expected`}
              icon={<Calendar className="h-4 w-4" />}
              tone="primary"
              onClick={() => setActiveTab("reservations")}
            />
            <KpiCard
              label="Pending Approval"
              value={pending.length}
              sub={notResponded > 0 ? `${notResponded} not yet responded` : "All replied · awaiting guests"}
              icon={<Clock className="h-4 w-4" />}
              tone="warning"
              onClick={() => setActiveTab("reservations")}
            />
            <KpiCard
              label="Approved"
              value={accepted.length}
              sub="Confirmed for tonight"
              icon={<CheckCircle className="h-4 w-4" />}
              tone="success"
            />
            <KpiCard
              label="Total Guests"
              value={guestsToday}
              sub="Across all slots"
              icon={<Users className="h-4 w-4" />}
              tone="info"
            />
          </div>

          {/* Two-column body */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
              {/* Left column */}
              <div className="flex flex-col gap-4">
                {/* Pending Approvals */}
                <Widget
                  title="Pending Approvals"
                  icon={<Clock className="h-4 w-4" />}
                  action={
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                      {pending.length} waiting
                    </span>
                  }
                >
                  <PendingQueue pending={pending} onRespond={setResponderRes} />
                </Widget>

                {/* Capacity by Time Slot */}
                <Widget
                  title="Capacity by Time Slot"
                  icon={<BarChart2 className="h-4 w-4" />}
                  action={
                    <button
                      type="button"
                      onClick={() => setActiveTab("capacity")}
                      className="rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Manage
                    </button>
                  }
                >
                  <CapacityWidget />
                </Widget>
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-4">
                {/* Analytics range toggle */}
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 self-start">
                  {RANGE_LABELS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAnalyticsRange(id)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        analyticsRange === id
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Nationality Breakdown */}
                <Widget
                  title="Nationality Breakdown"
                  icon={<Globe className="h-4 w-4" />}
                  action={
                    <button
                      type="button"
                      onClick={() => setActiveTab("guests")}
                      className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      View all
                    </button>
                  }
                >
                  <NatList reservations={analyticsReservations} />
                </Widget>

                {/* Booking Source */}
                <Widget
                  title="Booking Source"
                  icon={<BarChart2 className="h-4 w-4" />}
                >
                  <BookingSource reservations={analyticsReservations} />
                </Widget>

                {/* Declined & Lost */}
                <Widget
                  title="Declined & Lost"
                  icon={<Ban className="h-4 w-4" />}
                  action={
                    <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">
                      {declinedRows.length}
                    </span>
                  }
                  onHeaderClick={() => setShowDeclinedLog(true)}
                >
                  <DeclinedMini rows={declinedRows} />
                </Widget>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Reservations tab ── */}
      {activeTab === "reservations" && (
        <div className="flex-1 min-h-0">
          <ReservationsListView canEdit={canEdit} />
        </div>
      )}

      {/* ── Capacity tab ── */}
      {activeTab === "capacity" && <CapacityFullView />}

      {/* ── AI Inbox tab ── */}
      {activeTab === "inbox" && <AIInbox />}

      {/* ── Guests tab ── */}
      {activeTab === "guests" && <GuestCRM />}

      {/* Responder modal — global, outside tab */}
      <ResponderModal
        reservation={responderRes}
        onClose={() => setResponderRes(null)}
      />
    </div>
  )
}
