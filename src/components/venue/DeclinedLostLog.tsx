import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { CsvReservation } from "@/hooks/useReservationsCsv"
import { useDeclinedReservations } from "@/hooks/useWebFormReservations"
import { ArrowLeft, Search, Ban, Calendar, Clock, MessageCircle, Mail, Loader2 } from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sentMessageOf(r: CsvReservation): string {
  return r.responseMessage ?? ""
}

function channelsOf(r: CsvReservation): string[] {
  return r.responseChannels ?? []
}

function statusLabel(status: string | undefined): { label: string; cls: string; dot: string } {
  switch (status) {
    case "declined":  return { label: "Declined",  cls: "bg-red-50 text-red-600 border border-red-200",     dot: "#b83232" }
    case "cancelled": return { label: "Cancelled", cls: "bg-zinc-100 text-zinc-600 border border-zinc-200", dot: "#82786a" }
    case "noshow":    return { label: "No Show",   cls: "bg-red-50 text-red-600 border border-red-200",     dot: "#b83232" }
    default:          return { label: status ?? "—", cls: "bg-zinc-100 text-zinc-600 border border-zinc-200", dot: "#82786a" }
  }
}

function byLabel(r: CsvReservation): string {
  if (r.bookingStatus === "cancelled") return "Guest cancelled"
  if (r.bookingStatus === "noshow") return "Marked no-show"
  if (r.bookingStatus === "declined") return "Declined by venue"
  return "Cancelled by venue"
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AV_COLORS = ["#9a6f2e", "#c74c3c", "#2e7a52", "#2c5f9e", "#6a4fa3", "#80591f"]
function Avatar({ name, size = 36 }: { name: string | null; size?: number }) {
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
  const idx = (name ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: AV_COLORS[idx], fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  )
}

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_BADGE: Record<string, string> = {
  website:      "bg-blue-50 text-blue-700 border border-blue-200",
  whatsapp:     "bg-emerald-50 text-emerald-700 border border-emerald-200",
  social_media: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  phone:        "bg-amber-50 text-amber-700 border border-amber-200",
  walk_in:      "bg-zinc-100 text-zinc-600 border border-zinc-200",
}
function SourceBadge({ source }: { source: string | null }) {
  const cls = SOURCE_BADGE[source ?? ""] ?? "bg-zinc-100 text-zinc-600 border border-zinc-200"
  const labels: Record<string, string> = {
    website: "Website", whatsapp: "WhatsApp", social_media: "WhatsApp",
    phone: "Phone", walk_in: "Walk-in",
  }
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", cls)}>
      {labels[source ?? ""] ?? source ?? "Unknown"}
    </span>
  )
}

// ─── Table header ─────────────────────────────────────────────────────────────

function Th({ label, align = "left", w }: { label: string; align?: string; w?: number | string }) {
  return (
    <th
      className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
      style={{ textAlign: align as "left" | "center" | "right", width: w, whiteSpace: "nowrap" }}
    >
      {label}
    </th>
  )
}

// ─── Log screen ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "all",       label: "All" },
  { id: "cancelled", label: "Cancelled" },
  { id: "declined",  label: "Declined" },
  { id: "noshow",    label: "No-show" },
] as const

type TabId = typeof TABS[number]["id"]

interface DeclinedLostLogProps {
  onBack: () => void
}

export function DeclinedLostLog({ onBack }: DeclinedLostLogProps) {
  const { data: rows = [], isLoading } = useDeclinedReservations()
  const [q, setQ] = useState("")
  const [tab, setTab] = useState<TabId>("all")

  const counts = useMemo(() => ({
    all:       rows.length,
    cancelled: rows.filter((r) => r.bookingStatus === "cancelled").length,
    declined:  rows.filter((r) => r.bookingStatus === "declined").length,
    noshow:    rows.filter((r) => r.bookingStatus === "noshow").length,
  }), [rows])

  const filtered = useMemo(() => {
    let list = tab === "all" ? rows : rows.filter((r) => r.bookingStatus === tab)
    if (q.trim()) {
      const s = q.toLowerCase()
      list = list.filter(
        (r) =>
          (r.name ?? "").toLowerCase().includes(s) ||
          sentMessageOf(r).toLowerCase().includes(s)
      )
    }
    return list
  }, [rows, tab, q])

  return (
    <div className="flex flex-col gap-5">
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to overview
      </button>

      {/* Title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Declined &amp; lost</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every declined, cancelled &amp; no-show booking and the message we sent the guest · The Roof · 3F
          </p>
        </div>
        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
          {counts.all} total
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-foreground bg-foreground text-white"
                  : "border-border bg-card text-secondary-foreground hover:bg-muted",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                  active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[t.id]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search guest, nationality or message…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Ban className="h-7 w-7 opacity-30" />
            <p className="text-sm">{q ? "No matches" : "No reservations in this view"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <Th label="Guest" />
                  <Th label="Booking" w={150} />
                  <Th label="Party" align="center" w={70} />
                  <Th label="Status" w={120} />
                  <Th label="When / by" w={180} />
                  <Th label="Message we sent" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const st = statusLabel(r.bookingStatus)
                  const msgSent = sentMessageOf(r)
                  const channels = channelsOf(r)
                  const isLast = i === filtered.length - 1

                  return (
                    <tr
                      key={r.reservationSystemId ?? i}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}
                    >
                      {/* Guest */}
                      <td className="px-3.5 py-3.5 align-top">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.name} size={36} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13.5px] font-semibold text-foreground whitespace-nowrap">
                                {r.name ?? "—"}
                              </span>
                            </div>
                            {r.reservationSystemId && (
                              <div className="font-mono text-[11px] text-muted-foreground">
                                {r.reservationSystemId.slice(0, 8)}…
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Booking */}
                      <td className="px-3.5 py-3.5 align-top">
                        <div className="flex items-center gap-1.5 text-[12.5px] text-secondary-foreground">
                          <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {formatDate(r.dateOfReservation)}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-secondary-foreground">
                          <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {r.time ?? "—"}
                        </div>
                        <div className="mt-1.5">
                          <SourceBadge source={r.occasion} />
                        </div>
                      </td>

                      {/* Party */}
                      <td className="px-2 py-3.5 text-center align-top">
                        <span className="font-mono text-[15px] font-bold tabular-nums text-foreground">
                          {r.numberOfGuests}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-3.5 align-top">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", st.cls)}>
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
                          {st.label}
                        </span>
                      </td>

                      {/* When / by */}
                      <td className="px-3.5 py-3.5 align-top">
                        <div className="text-[12.5px] text-foreground whitespace-nowrap">
                          {r.respondedAt
                            ? new Date(r.respondedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
                              " · " +
                              new Date(r.respondedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
                            : r.submittedAt
                            ? new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "—"}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                          <span>{byLabel(r)}</span>
                        </div>
                      </td>

                      {/* Message we sent */}
                      <td className="px-3.5 py-3.5 align-top" style={{ maxWidth: 380 }}>
                        {msgSent ? (
                          <>
                            <p className="text-[12.5px] italic leading-relaxed text-secondary-foreground" style={{ textWrap: "pretty" } as any}>
                              "{msgSent}"
                            </p>
                            {channels.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {channels.map((c) => (
                                  <span
                                    key={c}
                                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground"
                                  >
                                    {c === "Email" ? (
                                      <Mail className="h-2.5 w-2.5" />
                                    ) : (
                                      <MessageCircle className="h-2.5 w-2.5" />
                                    )}
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[12px] italic text-muted-foreground">
                            <Ban className="h-3 w-3 shrink-0" />
                            No guest message sent
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-right text-xs text-muted-foreground">
        Showing {filtered.length} reservation{filtered.length === 1 ? "" : "s"}
      </p>
    </div>
  )
}
