import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useWebFormReservations } from "@/hooks/useWebFormReservations"
import { useReservationsCsv, type CsvReservation } from "@/hooks/useReservationsCsv"
import { Search, Crown, Users, Loader2, UserPlus } from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  ["+86",  "🇨🇳", "China"],
]

function flagFromPhone(phone: string | null): { flag: string; country: string } | null {
  if (!phone) return null
  for (const [prefix, flag, country] of PHONE_FLAGS) {
    if (phone.startsWith(prefix)) return { flag, country }
  }
  return null
}

const AVATAR_COLORS = [
  "#4A1F1C", "#6B4226", "#7C5C42", "#5C4033", "#8B5A2B",
  "#9E6B4A", "#3D2B1F", "#6B3A2A", "#A0522D", "#8B4513",
]
function avatarColor(name: string): string {
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2)
}

// ─── Tag definitions ──────────────────────────────────────────────────────────

interface Tag {
  label: string
  icon: string
  cls: string
}

const TAG_DEFS: Record<string, Tag> = {
  vip:          { label: "VIP",          icon: "👑", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  birthday:     { label: "Birthday",     icon: "🎂", cls: "border-pink-200 bg-pink-50 text-pink-700" },
  anniversary:  { label: "Anniversary",  icon: "💍", cls: "border-rose-200 bg-rose-50 text-rose-700" },
  shisha:       { label: "Shisha",       icon: "✦",  cls: "border-blue-200 bg-blue-50 text-blue-700" },
  repeat:       { label: "Repeat Guest", icon: "⟳",  cls: "border-green-200 bg-green-50 text-green-700" },
  high_spender: { label: "High Spender", icon: "$",  cls: "border-yellow-200 bg-yellow-50 text-yellow-800" },
  window:       { label: "Window Seat",  icon: "🪟",  cls: "border-teal-200 bg-teal-50 text-teal-700" },
  noshow_risk:  { label: "No-Show Risk", icon: "⚠",  cls: "border-red-200 bg-red-50 text-red-600" },
}

// ─── Guest profile ─────────────────────────────────────────────────────────────

interface GuestProfile {
  id: string             // phone-based
  displayId: string      // C-XXXX
  name: string
  phone: string | null
  email: string | null
  flag: string
  visits: number         // accepted reservations
  totalPax: number
  noShow: number
  avgGroup: number
  lastVisit: string | null
  tags: string[]
}

function buildGuestProfiles(reservations: CsvReservation[]): GuestProfile[] {
  const byPhone: Record<string, CsvReservation[]> = {}

  for (const r of reservations) {
    const key = r.phone ?? (r.name ?? "unknown").toLowerCase().replace(/\s+/g, "_")
    if (!byPhone[key]) byPhone[key] = []
    byPhone[key].push(r)
  }

  let idCounter = 1042

  return Object.entries(byPhone).map(([key, rows]) => {
    const latest = [...rows].sort((a, b) =>
      (b.dateOfReservation ?? "").localeCompare(a.dateOfReservation ?? "")
    )
    const name = latest[0]?.name ?? "Unknown Guest"
    const phone = latest[0]?.phone ?? null
    const email = latest[0]?.email ?? null

    const accepted = rows.filter((r) => r.bookingStatus === "accepted")
    const noShow   = rows.filter((r) => r.bookingStatus === "noshow")
    const totalPax = accepted.reduce((a, r) => a + r.numberOfGuests, 0)
    const avgGroup = accepted.length > 0 ? +(totalPax / accepted.length).toFixed(1) : 0
    const lastVisit = accepted.length > 0
      ? accepted.sort((a, b) => (b.dateOfReservation ?? "").localeCompare(a.dateOfReservation ?? ""))[0]?.dateOfReservation ?? null
      : null

    const phi = flagFromPhone(phone)

    // Derive tags
    const tags: string[] = []
    if (accepted.length >= 8)   tags.push("vip")
    if (accepted.length >= 3)   tags.push("repeat")
    if (avgGroup >= 6)          tags.push("high_spender")
    if (noShow.length >= 1)     tags.push("noshow_risk")

    const allNotes = rows.map((r) => (r.specialRequests ?? "").toLowerCase()).join(" ")
    if (/birthday/i.test(allNotes))   tags.push("birthday")
    if (/anniversary/i.test(allNotes)) tags.push("anniversary")
    if (/shisha/i.test(allNotes))     tags.push("shisha")
    if (/window/i.test(allNotes))     tags.push("window")

    return {
      id: key,
      displayId: `C-${idCounter++}`,
      name,
      phone,
      email,
      flag: phi?.flag ?? "",
      visits: accepted.length,
      totalPax,
      noShow: noShow.length,
      avgGroup,
      lastVisit,
      tags,
    }
  }).sort((a, b) => b.visits - a.visits || b.totalPax - a.totalPax)
}

// ─── Tag badge ────────────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag: string }) {
  const def = TAG_DEFS[tag]
  if (!def) return null
  return (
    <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", def.cls)}>
      <span className="text-[10px]">{def.icon}</span>
      {def.label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GuestCRM() {
  const { data: webReservations = [], isLoading: webLoading } = useWebFormReservations()
  const { data: csvReservations = [], isLoading: csvLoading } = useReservationsCsv()
  const [search, setSearch] = useState("")

  const allReservations = useMemo(() => {
    // Merge, deduplication not needed for building profiles (we group by phone)
    return [...webReservations, ...csvReservations]
  }, [webReservations, csvReservations])

  const guests = useMemo(() => buildGuestProfiles(allReservations), [allReservations])

  const filtered = useMemo(() => {
    if (!search.trim()) return guests
    const q = search.toLowerCase()
    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.phone?.includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.tags.some((t) => TAG_DEFS[t]?.label.toLowerCase().includes(q))
    )
  }, [guests, search])

  if (webLoading || csvLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading guest profiles…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-foreground">Guest CRM</h2>
          <p className="text-[13px] text-muted-foreground">Customer profiles auto-built from reservations</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          Add customer
        </button>
      </div>

      {/* Search + count */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search guests, tags, nationality…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-[13.5px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <span className="text-[12.5px] text-muted-foreground">
          {filtered.length} of {guests.length} guests
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.6fr_0.5fr_0.5fr_0.6fr_0.7fr_0.8fr_1.6fr] gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5">
          {["GUEST", "CONTACT", "VISITS", "TOTAL", "NO-SHOW", "AVG GROUP", "LAST VISIT", "TAGS"].map((h) => (
            <span key={h} className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Users className="h-8 w-8 opacity-20" />
            <p className="text-[13px]">No guests found</p>
          </div>
        ) : (
          filtered.map((g) => (
            <div
              key={g.id}
              className="grid grid-cols-[2fr_1.6fr_0.5fr_0.5fr_0.6fr_0.7fr_0.8fr_1.6fr] gap-3 items-center border-b border-border/40 px-4 py-3 last:border-0 hover:bg-muted/20 transition-colors"
            >
              {/* Guest */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: avatarColor(g.name) }}
                >
                  {initials(g.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="truncate text-[13.5px] font-semibold text-foreground">{g.name}</span>
                    <span className="text-[14px]">{g.flag}</span>
                    {g.tags.includes("vip") && <Crown className="h-3.5 w-3.5 text-amber-600" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{g.displayId}</span>
                </div>
              </div>

              {/* Contact */}
              <div className="min-w-0">
                {g.phone && (
                  <p className="truncate text-[12px] text-muted-foreground">{g.phone}</p>
                )}
                {g.email && (
                  <p className="truncate text-[12px] text-muted-foreground">{g.email}</p>
                )}
              </div>

              {/* Visits */}
              <span className="text-[13.5px] font-bold text-foreground">{g.visits}</span>

              {/* Total pax */}
              <span className="text-[13.5px] font-bold text-foreground">{g.totalPax}</span>

              {/* No-show */}
              <span className={cn(
                "text-[13.5px] font-bold",
                g.noShow > 0 ? "text-red-600" : "text-foreground",
              )}>
                {g.noShow}
              </span>

              {/* Avg group */}
              <span className="text-[13.5px] text-muted-foreground">{g.avgGroup || "—"}</span>

              {/* Last visit */}
              <span className="text-[12.5px] text-muted-foreground">
                {g.lastVisit
                  ? new Date(g.lastVisit + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })
                  : "—"}
              </span>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {g.tags.slice(0, 2).map((tag) => <TagBadge key={tag} tag={tag} />)}
                {g.tags.length > 2 && (
                  <span className="flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                    +{g.tags.length - 2}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
