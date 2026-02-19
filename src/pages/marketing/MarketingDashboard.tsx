import { useMemo, useState, useRef, useEffect } from "react"
import { addDays, format, isSameDay, startOfWeek, differenceInDays } from "date-fns"
import { cn } from "@/lib/utils"
import { useNavigate, useLocation } from "react-router-dom"
import { SectionTitle } from "@/components/ui/section-title"
import { useContentCalendar } from "@/hooks/useContentCalendar"
import { useGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync"
import { useUpcomingEvents, useUpdateEvent } from "@/hooks/useEvents"
import { useRoofCalendarWeekData } from "@/hooks/useWeekAtGlanceCsv"
import type { CalendarEvent, EventChecklistItem, EventMarketingStatus } from "@/types"

/* ────────────────────────────────────────────────────────────
   Static data
   ──────────────────────────────────────────────────────────── */

const CHANNELS = [
  {
    key: "ig",
    name: "Instagram",
    icon: "📸",
    health: "Growing" as const,
    followers: "4,820",
    followersLabel: "Followers",
    gradient: "from-[#c13584] via-[#e1306c] via-[#f77737] to-transparent",
    stats: [
      { label: "Engagement", value: "6.2%", delta: "↑", dir: "up" as const },
      { label: "Reach", value: "12.4K", delta: "+18%", dir: "up" as const },
      { label: "New Followers", value: "+142", delta: "↑", dir: "up" as const },
      { label: "Profile Visits", value: "840", delta: "", dir: "flat" as const },
    ],
    linkClicks: "420",
    spark: [40, 55, 45, 70, 60, 80, 100],
  },
  {
    key: "tiktok",
    name: "TikTok",
    icon: "🎵",
    health: "Growing" as const,
    followers: "2,310",
    followersLabel: "Followers",
    gradient: "from-[#2a7a6e] via-[#69c9d0] to-transparent",
    stats: [
      { label: "Avg Views", value: "3.8K", delta: "+32%", dir: "up" as const },
      { label: "Engagement", value: "8.4%", delta: "↑", dir: "up" as const },
      { label: "New Followers", value: "+54", delta: "↑", dir: "up" as const },
      { label: "Videos Posted", value: "3", delta: "", dir: "flat" as const },
    ],
    linkClicks: "180",
    spark: [30, 50, 90, 40, 65, 55, 85],
  },
  {
    key: "fb",
    name: "Facebook",
    icon: "📘",
    health: "Flat" as const,
    followers: "3,640",
    followersLabel: "Page Likes",
    gradient: "from-[#1877f2] to-transparent",
    stats: [
      { label: "Reach", value: "4.2K", delta: "→", dir: "flat" as const },
      { label: "Engagement", value: "2.1%", delta: "↓", dir: "down" as const },
      { label: "New Likes", value: "+14", delta: "", dir: "flat" as const },
      { label: "Posts", value: "5", delta: "", dir: "flat" as const },
    ],
    linkClicks: "380",
    spark: [60, 55, 50, 58, 45, 52, 48],
  },
  {
    key: "google",
    name: "Google",
    icon: "🔍",
    health: "Needs Attn" as const,
    followers: "4.7",
    followersLabel: "★ Star Rating · 142 Reviews",
    gradient: "from-[#4285f4] via-[#34a853] via-[#fbbc05] via-[#ea4335] to-transparent",
    stats: [
      { label: "New Reviews", value: "2", delta: "!", dir: "alert" as const },
      { label: "Unanswered", value: "2", delta: "", dir: "alert" as const },
      { label: "Searches", value: "1.8K", delta: "", dir: "flat" as const },
      { label: "Direction Reqs", value: "94", delta: "", dir: "flat" as const },
    ],
    linkClicks: "260",
    spark: [],
  },
]

const CALENDAR_DAYS = [
  {
    name: "Mon", date: "16",
    posts: [
      { type: "events", text: "🎧 Tết DJ Lineup", platforms: "IG · FB", pub: true },
      { type: "promos", text: "📣 Tết Combo Remind", platforms: "IG · FB", pub: true },
    ],
    gap: null, today: false,
  },
  {
    name: "Tue", date: "17",
    posts: [{ type: "atmosphere", text: "🌅 Girl Night Out", platforms: "IG · FB", pub: true }],
    gap: null, today: false,
  },
  {
    name: "Wed", date: "18",
    posts: [{ type: "atmosphere", text: "📸 Moments & Atmosphere", platforms: "IG · FB", pub: true }],
    gap: null, today: false,
  },
  {
    name: "Thu", date: "19",
    posts: [{ type: "events", text: "🎭 Tết Night Recap", platforms: "IG · TT", pub: false }],
    gap: "⚠ No reel scheduled", today: true,
  },
  {
    name: "Fri", date: "20",
    posts: [],
    gap: "⚠ High traffic night", today: false,
  },
  {
    name: "Sat", date: "21",
    posts: [],
    gap: "⚠ Private event night", today: false,
  },
  {
    name: "Sun", date: "22",
    posts: [{ type: "atmosphere", text: "🌅 Sunday Sunset Reel", platforms: "IG · TT", pub: false }],
    gap: null, today: false,
  },
]

const POST_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  events:     { bg: "bg-[#f5edd8]", border: "border-l-[#c9a84c]", text: "text-[#7a5a10]" },
  atmosphere: { bg: "bg-[#f0ece6]", border: "border-l-[#8a7a6a]", text: "text-[#5a4a3a]" },
  drinks:     { bg: "bg-[#fdf3e7]", border: "border-l-[#b5620a]", text: "text-[#b5620a]" },
  community:  { bg: "bg-success/8",  border: "border-l-success",   text: "text-success" },
  promos:     { bg: "bg-info/8",     border: "border-l-info",      text: "text-info" },
  vn:         { bg: "bg-error/8",    border: "border-l-error",     text: "text-error" },
}

const GAPS = [
  { severity: "red" as const,   text: "No content Thu–Sat — your 3 highest-traffic nights", action: "→ Brief marketing team today" },
  { severity: "red" as const,   text: "2 unanswered Google reviews — rating risk after 48h", action: "→ Assign to Thuy now" },
  { severity: "amber" as const, text: "TikTok only 3 posts this week — algorithm favors 5+", action: "→ Add 2 behind-the-scenes clips" },
  { severity: "amber" as const, text: "Facebook engagement declining — consider boosting Saturday", action: "→ Set 200K VND boost" },
  { severity: "green" as const, text: "Instagram performing well — maintain 1 reel + 2 stories daily", action: null },
]

type PartnerStatus = "Active" | "Negotiating" | "Follow Up" | "Inactive"
type InfluencerStatusType = "visited" | "scheduled" | "prospect"

interface Partner {
  id: string
  name: string
  type: string
  status: PartnerStatus
  pax: string
  converting: string
}

interface Influencer {
  id: string
  name: string
  handle: string
  reach: string
  status: string
  statusType: InfluencerStatusType
}

const INITIAL_PARTNERS: Partner[] = [
  { id: "1", name: "East West Brewing",     type: "Venue · Cross-promo",       status: "Active",      pax: "+45", converting: "✓ Strong"   },
  { id: "2", name: "Da Nang Expat Group",   type: "Community · Facebook",       status: "Active",      pax: "+22", converting: "✓ Good"     },
  { id: "3", name: "Mango Hostel",          type: "Hospitality · Referral",     status: "Negotiating", pax: "—",   converting: "Pending"    },
  { id: "4", name: "Shisha Supplier",       type: "Product · Co-marketing",     status: "Follow Up",   pax: "+3",  converting: "✗ Low ROI"  },
  { id: "5", name: "Vietnam Nightlife Blog",type: "Media · Editorial",           status: "Inactive",    pax: "+0",  converting: "✗ Dormant"  },
]

const INITIAL_INFLUENCERS: Influencer[] = [
  { id: "1", name: "Sarah Lin",     handle: "@sarahlin.travels · Travel",    reach: "48K",  status: "✓ Visited Feb 10",    statusType: "visited"   },
  { id: "2", name: "Marcus Bui",    handle: "@marcusindanang · Lifestyle",   reach: "92K",  status: "Scheduled Feb 22",    statusType: "scheduled" },
  { id: "3", name: "Anya Kowalski", handle: "@anyainvietnam · Expat life",   reach: "24K",  status: "Prospect — DM sent",  statusType: "prospect"  },
  { id: "4", name: "Jake Thompson", handle: "@jakeinasia · Nightlife",       reach: "156K", status: "Prospect — No reply", statusType: "prospect"  },
]

const CONTENT_PILLARS = [
  { icon: "🎧", name: "Events & DJs", desc: "Create anticipation. Drive attendance. Position The Roof as a trusted curator of sound.", tone: "Energetic · Confident · Music-first" },
  { icon: "🌅", name: "Atmosphere & Rooftop Vibes", desc: "Sell the feeling. Make people want to be there before they even know what's happening.", tone: "Cinematic · Sensual · Calm-but-magnetic" },
  { icon: "🍸", name: "Drinks, Shisha & Experience", desc: "Build desire and ritual around cocktails and shisha. Experiences, not products.", tone: "Indulgent · Sensory · Slightly seductive" },
  { icon: "🤝", name: "Community & Guests", desc: "Show that The Roof is a melting pot of culture. Make guests feel seen and part of something.", tone: "Warm · Inclusive · Human · Authentic" },
  { icon: "📣", name: "Announcements & Promos", desc: "Communicate offers and logistics without losing aesthetic quality.", tone: "Clear · Confident · Polished" },
]

const TARGET_AUDIENCE = [
  {
    type: "International Travelers",
    desc: "Ages 23–45 · Experience-driven",
    tags: ["North America", "Oceania", "Europe", "Instagram/TikTok driven"],
    insight: '"Dislike loud, chaotic music and overly crowded venues. Prefer spaces where Western travelers gather to connect."',
  },
  {
    type: "Expats in Da Nang",
    desc: "Ages 26–45 · Long-term residents",
    tags: ["3 months–several years", "Refined taste", "Work or unwind"],
    insight: '"Enjoy comfortable bars where they can also work or unwind. High standards, no pretence."',
  },
  {
    type: "Domestic Tourists",
    desc: "Ages 22–35 · Groups & couples from HN/HCM",
    tags: ["TikTok reviews", "KOL recommendations", "Check-in culture"],
    insight: '"Choose destinations based on TikTok, Instagram, Google Reviews. Love beautiful views for content creation."',
  },
  {
    type: "Urban Youth",
    desc: "Ages 22–35 · Local Da Nang creatives",
    tags: ["Freelancers", "Lifestyle-driven", "Social"],
    insight: '"Look for places to meet, talk casually, and visit trending venues widely talked about on social media."',
  },
]

const USPS = [
  { icon: "🏖", name: "The View", desc: "Panoramic views of Mỹ Khê Beach. Da Nang's only rooftop bar directly on the beachfront." },
  { icon: "🌊", name: "Atmosphere", desc: "Laidback, relaxing, genuine. Music enhances the moment, never dominates it." },
  { icon: "🎧", name: "Music Curation", desc: "Carefully curated DJs who understand mood-building — not just playing tracks." },
  { icon: "💨", name: "Premium Shisha", desc: "Carefully selected shisha enhancing relaxation. In-house connoisseur. Unmatched in Da Nang." },
  { icon: "🌍", name: "International Community", desc: "An open, international crowd where east meets west. Easy to connect, talk, and belong." },
]

/* ────────────────────────────────────────────────────────────
   Main component
   ──────────────────────────────────────────────────────────── */

export default function MarketingDashboard() {
  const navigate = useNavigate()
  const location = useLocation()

  // ── Live events ─────────────────────────────────────────────────────────
  const { data: upcomingEvents = [] } = useUpcomingEvents(12)
  const updateEvent = useUpdateEvent()
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // ── Partnerships & Influencers (editable local state) ────────────────────
  const [partners, setPartners] = useState<Partner[]>(INITIAL_PARTNERS)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [showAddPartner, setShowAddPartner] = useState(false)
  const [newPartner, setNewPartner] = useState<Omit<Partner, "id">>({ name: "", type: "", status: "Active", pax: "", converting: "" })

  const [influencers, setInfluencers] = useState<Influencer[]>(INITIAL_INFLUENCERS)
  const [editingInfluencer, setEditingInfluencer] = useState<Influencer | null>(null)
  const [showAddInfluencer, setShowAddInfluencer] = useState(false)
  const [newInfluencer, setNewInfluencer] = useState<Omit<Influencer, "id">>({ name: "", handle: "", reach: "", status: "", statusType: "prospect" })

  // ── Pipeline (this week's DJ schedule CSV) → event cards ─────────────────
  const { data: roofCalendar } = useRoofCalendarWeekData()
  const roofEvents = roofCalendar?.events ?? []

  const todayIsoMkt = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const pipelineCards = useMemo(() => {
    const [y, m, d] = todayIsoMkt.split("-").map(Number)
    const anchor = new Date(Date.UTC(y, m - 1, d))
    const dowMon0 = (anchor.getUTCDay() + 6) % 7
    const start = new Date(Date.UTC(y, m - 1, d - dowMon0))
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(start)
      dt.setUTCDate(start.getUTCDate() + i)
      const iso = dt.toISOString().slice(0, 10)
      const dayEvents = roofEvents.filter(e => e.dateIso === iso && e.eventName)
      const first = dayEvents[0]
      return { iso, first: first ?? null, extra: Math.max(0, dayEvents.length - 1) }
    }).filter(r => r.first) // only days with an actual event
  }, [roofEvents, todayIsoMkt])

  // ── Live content calendar ────────────────────────────────────────────────
  const { posts } = useContentCalendar()
  const { isSyncing, lastSynced } = useGoogleSheetsSync()
  const [weekCursor, setWeekCursor] = useState<Date>(() => new Date())
  const weekStart = useMemo(() => startOfWeek(weekCursor, { weekStartsOn: 1 }), [weekCursor])
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const postsByDate = useMemo(() => {
    const map = new Map<string, typeof posts>()
    for (const p of posts) {
      const key = p.scheduled_date
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return map
  }, [posts])

  const PILLAR_STYLE: Record<string, { bg: string; border: string; text: string }> = {
    events_djs:    { bg: "bg-[#f5edd8]", border: "border-l-[#c9a84c]", text: "text-[#7a5a10]" },
    atmosphere:    { bg: "bg-[#f0ece6]", border: "border-l-[#8a7a6a]", text: "text-[#5a4a3a]" },
    drinks:        { bg: "bg-[#fdf3e7]", border: "border-l-[#b5620a]", text: "text-[#b5620a]" },
    community:     { bg: "bg-success/8",  border: "border-l-success",   text: "text-success"  },
    announcements: { bg: "bg-info/8",     border: "border-l-info",      text: "text-info"     },
    holidays:      { bg: "bg-error/8",    border: "border-l-error",     text: "text-error"    },
    reels:         { bg: "bg-[#ede8f5]",  border: "border-l-[#9b72cf]", text: "text-[#5a3a8a]"},
  }

  function pillarFromNotes(notes: string | null | undefined) {
    const line = (notes ?? "").split("\n").find(l => l.startsWith("pillar:"))
    return line ? line.replace("pillar:", "").trim() : "events_djs"
  }

  function platformLabel(platform: string) {
    if (platform === "instagram") return "IG"
    if (platform === "facebook")  return "FB"
    if (platform === "tiktok")    return "TT"
    if (platform === "all")       return "IG · FB · TT"
    return platform.toUpperCase()
  }

  const healthClass = (h: string) => {
    switch (h) {
      case "Growing":    return "border-success/25 bg-success/8 text-success"
      case "Flat":       return "border-warning/25 bg-warning/8 text-warning"
      default:           return "border-error/25 bg-error/8 text-error"
    }
  }

  const statusClass = (s: string) => {
    switch (s) {
      case "Active":      return "border-success/25 bg-success/8 text-success"
      case "Negotiating": return "border-warning/25 bg-warning/8 text-warning"
      case "Follow Up":   return "border-error/25 bg-error/8 text-error"
      default:            return "border-border bg-secondary text-muted-foreground"
    }
  }

  const infStatusClass = (s: string) => {
    switch (s) {
      case "visited":   return "border-success/25 bg-success/8 text-success"
      case "scheduled": return "border-primary/25 bg-primary/8 text-primary"
      default:          return "border-info/25 bg-info/8 text-info"
    }
  }

  const mktStatusConfig: Record<EventMarketingStatus, { label: string; cls: string }> = {
    not_started: { label: "Not Started", cls: "border-border bg-secondary text-muted-foreground" },
    planning:    { label: "Planning",    cls: "border-warning/25 bg-warning/8 text-warning" },
    urgent:      { label: "Urgent",      cls: "border-error/25 bg-error/8 text-error" },
    confirmed:   { label: "Confirmed",   cls: "border-success/25 bg-success/8 text-success" },
    past:        { label: "Past",        cls: "border-border bg-secondary text-muted-foreground" },
  }

  const sevColor: Record<string, string> = {
    red: "bg-error", amber: "bg-warning", green: "bg-success",
  }

  const isActive = (path: string) => location.pathname.endsWith(path)

  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-xl tracking-[4px] text-primary uppercase">The Roof</div>
          <div className="text-xs tracking-widest text-muted-foreground">Da Nang · Club &amp; Lounge</div>
        </div>
        <div className="text-center">
          <div className="text-xs tracking-widest text-muted-foreground uppercase mb-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
          <div className="font-subheading text-lg font-normal italic text-foreground">Marketing Overview — Brand Command Center</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/owner/dashboard")}
            className={cn(
              "px-3.5 py-[5px] text-xs tracking-wider uppercase rounded-sm border",
              isActive("/owner/dashboard")
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-border hover:text-secondary-foreground",
            )}
          >
            ← Executive
          </button>
          <button type="button" className="px-3.5 py-[5px] text-xs tracking-wider uppercase rounded-sm border border-primary/25 bg-primary/10 text-primary">
            Marketing
          </button>
          <button type="button" className="px-3.5 py-[5px] text-xs tracking-wider uppercase rounded-sm border border-border text-muted-foreground hover:text-secondary-foreground">
            Operations
          </button>
          <div className="ml-2 flex items-center gap-1.5 px-3 py-1 rounded-sm border border-border text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Club Night
          </div>
        </div>
      </div>

      {/* ── 1. BRAND IDENTITY HERO ── */}
      <div className="grid grid-cols-[1fr_1px_1fr_1px_1fr] rounded-card overflow-hidden border border-border shadow-card" style={{ background: "#1a1714" }}>
        {/* Mission */}
        <div className="p-7">
          <div className="text-[9px] font-semibold tracking-[0.12em] uppercase text-white/35 mb-2">Mission</div>
          <div className="font-subheading text-[15px] font-medium text-white/90 leading-snug mb-2">
            The Roof brings <em className="not-italic" style={{ color: "#c9a84c" }}>like-minded souls</em> together
          </div>
          <div className="text-[12px] text-white/50 leading-relaxed">
            Creating unhurried moments above the city, where emotions are shaped by the sea breeze, music, and every thoughtfully crafted cocktail.
          </div>
        </div>

        {/* divider */}
        <div style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Big Idea */}
        <div className="p-7">
          <div className="text-[9px] font-semibold tracking-[0.12em] uppercase text-white/35 mb-2">Big Idea</div>
          <div className="font-subheading text-[20px] font-medium leading-snug mb-2" style={{ color: "#c9a84c", fontStyle: "italic" }}>
            Nốt nhịp tắng không
          </div>
          <div className="text-[12px] text-white/50 leading-relaxed mb-3">
            A beachside rooftop defined by slow moments, refined atmosphere, and genuine connection. The emotional pause above the city.
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["Fun & Positive", "Down to Earth", "Care"].map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-sm" style={{ background: "rgba(201,168,76,0.15)", color: "#c9a84c", border: "1px solid rgba(201,168,76,0.3)" }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* divider */}
        <div style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Niche */}
        <div className="p-7">
          <div className="text-[9px] font-semibold tracking-[0.12em] uppercase text-white/35 mb-2">Niche</div>
          <div className="font-subheading text-[15px] font-medium text-white/90 leading-snug mb-2">
            International rooftop lounge —{" "}
            <em className="not-italic" style={{ color: "#c9a84c" }}>Da Nang's only beachfront</em>
          </div>
          <div className="text-[12px] text-white/50 leading-relaxed mb-3">
            Not a club. Not a restaurant. The only rooftop directly on Mỹ Khê Beach. Where east meets west, sunset to late night.
          </div>
          <div className="text-[11px] text-white/30 italic">"Do one thing and do it better than anyone."</div>
        </div>
      </div>

      {/* ── 2. SOCIAL PERFORMANCE ── */}
      <div className="space-y-3">
        <SectionTitle label="Social Media Performance — Week of Feb 11–17" />
        <div className="grid grid-cols-4 gap-3.5">
          {CHANNELS.map((ch) => (
            <div
              key={ch.key}
              className="group relative overflow-hidden rounded-card border border-border bg-card p-[18px_20px] shadow-card transition-all hover:shadow-card-hover"
            >
              <div className={cn("absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r", ch.gradient)} />
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ch.icon}</span>
                  <span className="text-sm tracking-wider text-foreground uppercase">{ch.name}</span>
                </div>
                <span className={cn("rounded-sm border px-[7px] py-[2px] text-[10px] tracking-wide uppercase", healthClass(ch.health))}>
                  {ch.health}
                </span>
              </div>
              <div className="font-display text-[38px] leading-none tracking-[2px] text-foreground">{ch.followers}</div>
              <div className="text-xs tracking-wide text-muted-foreground mt-0.5 mb-3">{ch.followersLabel}</div>
              <div className="grid grid-cols-2 gap-2">
                {ch.stats.map((s) => (
                  <div key={s.label} className="rounded-sm bg-secondary/50 px-2 py-1.5">
                    <div className="text-[9px] tracking-wider text-muted-foreground uppercase mb-0.5">{s.label}</div>
                    <div className="flex items-center gap-[5px] text-xs font-semibold">
                      {s.dir === "alert" ? (
                        <span className="text-error">{s.value} {s.delta && <span className="animate-pulse">!</span>}</span>
                      ) : (
                        <>
                          <span className={cn(s.dir === "up" ? "text-success" : s.dir === "down" ? "text-error" : "text-foreground")}>{s.value}</span>
                          {s.delta && (
                            <span className={cn("text-[10px]", s.dir === "up" ? "text-success" : s.dir === "down" ? "text-error" : "text-muted-foreground")}>
                              {s.delta}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {ch.key === "google" && (
                <div className="mt-2.5 flex items-center justify-between rounded-sm border border-error/15 bg-error/[0.07] px-2.5 py-[7px]">
                  <span className="text-xs text-error">⚠ Respond to 2 reviews now</span>
                  <span className="text-xs text-error cursor-pointer">→ Open</span>
                </div>
              )}
              <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-[11px] text-muted-foreground">🔗 Link clicks this week</span>
                <span className="text-[12px] font-semibold text-foreground tabular-nums">{ch.linkClicks}</span>
              </div>
              {ch.spark.length > 0 && (
                <div className="mt-2 flex items-end gap-[2px] h-[18px]">
                  {ch.spark.map((h, i) => (
                    <div
                      key={i}
                      className={cn("flex-1 rounded-[1px]", i === ch.spark.length - 1 ? "bg-primary" : "bg-primary/15")}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. USP BAND ── */}
      <div className="rounded-card border border-border overflow-hidden shadow-card" style={{ background: "#f5edd8", borderColor: "#e8d9b0" }}>
        <div className="px-6 pt-5 pb-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-4" style={{ color: "#b5620a" }}>Our 5 Unique Selling Points</div>
          <div className="grid grid-cols-5">
            {USPS.map((u, i) => (
              <div key={u.name} className={cn("pb-5 px-4", i === 0 ? "pl-0" : "", i === USPS.length - 1 ? "pr-0" : "", i < USPS.length - 1 ? "border-r" : "")} style={{ borderColor: "#e8d9b0" }}>
                <div className="text-xl mb-2">{u.icon}</div>
                <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#b5620a" }}>{u.name}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: "#6b6560" }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT CALENDAR ── */}
      <div className="space-y-3">
        <SectionTitle label={`Content Calendar — Week of ${format(weekStart, "MMM d")}–${format(addDays(weekStart, 6), "d")}`} />
        <div className="flex flex-col gap-3.5">
          {/* Calendar */}
          <div className="rounded-card border border-border bg-card p-5 shadow-card">
            {/* toolbar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1">
                <button type="button" onClick={() => setWeekCursor(d => addDays(d, -7))} className="w-[26px] h-[26px] rounded-sm border border-border text-muted-foreground text-sm flex items-center justify-center hover:bg-secondary">‹</button>
                <button type="button" onClick={() => setWeekCursor(d => addDays(d, 7))}  className="w-[26px] h-[26px] rounded-sm border border-border text-muted-foreground text-sm flex items-center justify-center hover:bg-secondary">›</button>
              </div>
              <div className="text-sm font-semibold text-foreground">
                Week of {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
              </div>
              {isSyncing ? (
                <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-sm border border-warning/25 bg-warning/8 text-[11px] text-warning">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                  Syncing…
                </div>
              ) : lastSynced ? (
                <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-sm border border-success/25 bg-success/8 text-[11px] text-success">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Synced · {format(lastSynced, "HH:mm")}
                </div>
              ) : (
                <div className="ml-auto" />
              )}
              <button
                type="button"
                onClick={() => navigate("/marketing/calendar")}
                className="px-3 py-1 rounded-sm border border-border text-xs text-muted-foreground hover:bg-secondary"
              >
                Open Calendar
              </button>
            </div>

            {/* grid */}
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const iso = format(day, "yyyy-MM-dd")
                const dayPosts = postsByDate.get(iso) ?? []
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={iso}
                    className={cn(
                      "rounded-md border overflow-hidden min-h-[130px]",
                      isToday ? "border-primary" : "border-border bg-secondary/30",
                    )}
                  >
                    {/* day header */}
                    <div className={cn("px-2.5 pt-2 pb-1.5 border-b border-border", isToday ? "bg-primary" : "")}>
                      <div className={cn("text-[9px] font-semibold uppercase tracking-wider", isToday ? "text-primary-foreground/80" : "text-muted-foreground")}>{format(day, "EEE")}</div>
                      <div className={cn("font-display text-[16px] leading-none", isToday ? "text-primary-foreground" : "text-foreground")}>{format(day, "d")}</div>
                    </div>

                    {/* posts */}
                    <div className="p-1.5 flex flex-col gap-1">
                      {dayPosts.length === 0 && (
                        <div className="text-[10px] text-muted-foreground italic text-center py-2">No posts planned</div>
                      )}
                      {dayPosts.map((p) => {
                        const pillar = pillarFromNotes(p.notes)
                        const ps = PILLAR_STYLE[pillar] ?? PILLAR_STYLE.events_djs
                        const title = (p.notes ?? "").split("\n").find(l => l.startsWith("title:"))?.replace("title:", "").trim() || p.caption?.split("\n")[0]?.slice(0, 30) || "Post"
                        return (
                          <div key={p.id} className={cn("rounded-[3px] px-1.5 py-1 text-[10px] font-medium border-l-2", ps.bg, ps.border, ps.text)}>
                            {title}
                            <div className="text-[9px] opacity-60 mt-0.5 flex items-center gap-1">
                              {platformLabel(p.platform)}
                              <span className={cn("w-1.5 h-1.5 rounded-full inline-block", p.status === "published" ? "bg-success" : "bg-warning")} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── UPCOMING EVENTS ── */}
      <div className="space-y-3">
        <SectionTitle label="Upcoming Events" />

        {/* Pipeline cards (from DJ schedule CSV) */}
        {pipelineCards.length > 0 && (
          <div className="grid grid-cols-3 gap-3.5">
            {pipelineCards.map(({ iso, first, extra }) => {
              const dt = new Date(iso + 'T00:00:00')
              const daysUntil = differenceInDays(dt, new Date())
              const isToday = daysUntil === 0
              const isPast = daysUntil < 0
              const djs = [first!.dj1, first!.dj2].filter(Boolean).join(' · ') || '—'
              return (
                <div
                  key={iso}
                  className={cn(
                    "relative overflow-hidden rounded-card border border-border bg-card p-[18px_20px] shadow-card",
                    isPast && "opacity-60",
                    !isPast && "before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-gradient-to-r before:from-chart-2 before:to-transparent",
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("rounded-sm border px-2.5 py-1.5 text-center min-w-[44px]", isToday ? "border-primary bg-primary/8" : "border-border bg-secondary")}>
                      <div className="text-[10px] tracking-wider text-muted-foreground uppercase">{format(dt, 'MMM')}</div>
                      <div className={cn("font-display text-[22px] leading-none", isToday ? "text-primary" : "text-foreground")}>{format(dt, 'd')}</div>
                    </div>
                    <span className={cn(
                      "rounded-sm border px-[7px] py-[2px] text-[10px] tracking-wide uppercase",
                      isPast  ? "border-border bg-secondary text-muted-foreground"
                      : isToday ? "border-primary/30 bg-primary/8 text-primary"
                      : daysUntil <= 2 ? "border-warning/25 bg-warning/8 text-warning"
                      : "border-success/25 bg-success/8 text-success"
                    )}>
                      {isPast ? 'Past' : isToday ? 'Tonight' : daysUntil <= 2 ? 'Soon' : 'Upcoming'}
                    </span>
                  </div>

                  <div className="font-subheading text-base font-semibold text-foreground mb-0.5 truncate">
                    {first!.eventName}{extra > 0 ? ` +${extra} more` : ''}
                  </div>
                  <div className="text-xs tracking-wider text-muted-foreground uppercase mb-3">
                    {first!.startTime && first!.endTime ? `${first!.startTime} – ${first!.endTime}` : format(dt, 'EEEE')}
                  </div>

                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-10 shrink-0 tracking-wide uppercase text-[10px]">DJs</span>
                      <span className="text-foreground truncate">{djs}</span>
                    </div>
                    {first!.genre && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-10 shrink-0 tracking-wide uppercase text-[10px]">Genre</span>
                        <span className="text-foreground truncate">{first!.genre}</span>
                      </div>
                    )}
                    {first!.promotion && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-10 shrink-0 tracking-wide uppercase text-[10px]">Promo</span>
                        <span className="text-foreground truncate">{first!.promotion}</span>
                      </div>
                    )}
                  </div>

                  {!isPast && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isToday ? "bg-primary" : daysUntil <= 2 ? "bg-warning" : "bg-success")} />
                      {isToday ? 'Happening tonight' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days away`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Supabase events (if any) */}
        {upcomingEvents.length > 0 && (
          <div className="grid grid-cols-3 gap-3.5">
            {upcomingEvents.map((ev) => {
              const status = ev.marketingStatus ?? 'not_started'
              const isPast = status === 'past'
              const checklist = ev.checklist ?? []
              const doneCount = checklist.filter(c => c.done).length
              const totalCount = checklist.length
              const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
              const daysUntil = differenceInDays(new Date(ev.startDate + 'T00:00:00'), new Date())
              const mStatusCfg = mktStatusConfig[status]
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedEvent(ev)}
                  className={cn(
                    "relative overflow-hidden rounded-card border border-border bg-card p-[18px_20px] shadow-card transition-shadow hover:shadow-card-hover text-left w-full",
                    isPast && "opacity-60",
                    !isPast && "before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-gradient-to-r before:from-chart-2 before:to-transparent",
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="rounded-sm border border-border bg-secondary px-2.5 py-1.5 text-center min-w-[44px]">
                      <div className="text-[10px] tracking-wider text-muted-foreground uppercase">{format(new Date(ev.startDate + 'T00:00:00'), 'MMM')}</div>
                      <div className="font-display text-[22px] leading-none text-primary">{format(new Date(ev.startDate + 'T00:00:00'), 'd')}</div>
                    </div>
                    <span className={cn("rounded-sm border px-[7px] py-[2px] text-[10px] tracking-wide uppercase", mStatusCfg.cls)}>
                      {mStatusCfg.label}
                    </span>
                  </div>
                  <div className="font-subheading text-base font-semibold text-foreground mb-0.5 truncate">{ev.title}</div>
                  <div className="text-xs tracking-wider text-muted-foreground uppercase mb-3 truncate">{ev.eventType.replace(/_/g, ' ')}</div>
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{totalCount > 0 ? `${doneCount}/${totalCount} tasks done` : 'No tasks yet'}</span>
                      {!isPast && daysUntil >= 0 && (
                        <span className={cn(daysUntil <= 3 ? "text-error" : daysUntil <= 7 ? "text-warning" : "text-muted-foreground")}>
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d away`}
                        </span>
                      )}
                    </div>
                    <div className="h-[2px] bg-accent rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm bg-gradient-to-r from-primary to-chart-2 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  {ev.location && <div className="text-xs text-muted-foreground truncate">📍 {ev.location}</div>}
                  <div className="mt-2 text-xs text-primary/70 tracking-wide">Click to manage →</div>
                </button>
              )
            })}
          </div>
        )}

        {pipelineCards.length === 0 && upcomingEvents.length === 0 && (
          <div className="rounded-card border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            No upcoming events found.
          </div>
        )}
      </div>

      {/* ── THIS WEEK'S PROMOTIONS ── */}
      {(() => {
        const fixedPromos = [
          { dayKey: "MON", name: "Up in Smoke Mondays",        hours: "18:00 – 20:00", deal: "Free signature cocktail with any premium / special shisha purchase" },
          { dayKey: "TUE", name: "Date Night Tuesdays",        hours: "18:00 – 20:00", deal: "Free fruit platter (250K) with date night combo — 1 Pizza & 2 cocktails for 675K" },
          { dayKey: "WED", name: "Chill & Flow Wednesdays",    hours: "18:00 – 20:00", deal: "Free premium tea with any special shisha + 30% off your second shisha" },
          { dayKey: "THU", name: "Lovers & Friends Thursdays", hours: "18:00 – 20:00", deal: "Free premium shisha with a spend over 2,000,000 VND" },
          { dayKey: "FRI", name: "We Outside Fridays",         hours: "18:00 – 20:00", deal: "Free cocktail jug with a spend over 1,500,000 VND" },
          { dayKey: "SAT", name: "Good Vibes Only Saturdays",  hours: "18:00 – 20:00", deal: "Free special shisha with a spend over 3,000,000 VND" },
          { dayKey: "SUN", name: "Sunset & Slow Down Sundays", hours: "18:00 – 20:00", deal: "20% off all signature cocktails" },
        ]
        const DAY_FULL: Record<string, string> = {
          MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
          FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
        }
        const happyHourItems = [
          { icon: "🍹", label: "Buy 1 Get 1",      sub: "Happy hour menu" },
          { icon: "🍵", label: "Free Tea",          sub: "With any special shisha" },
          { icon: "🍸", label: "Cocktail Set",      sub: "6 best-sellers — 399K" },
          { icon: "🌧",  label: "20% Off Shisha",   sub: "Rainy day special" },
        ]
        // Build week dates aligned with pipelineCards (Mon–Sun)
        const [y, m, d] = todayIsoMkt.split("-").map(Number)
        const anchor = new Date(Date.UTC(y, m - 1, d))
        const dowMon0 = (anchor.getUTCDay() + 6) % 7
        const start = new Date(Date.UTC(y, m - 1, d - dowMon0))
        const dayKeys = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        const weekIsos = dayKeys.map((_, i) => {
          const dt = new Date(start)
          dt.setUTCDate(start.getUTCDate() + i)
          return dt.toISOString().slice(0, 10)
        })
        const promoRows = fixedPromos.map((p, i) => ({ ...p, iso: weekIsos[i], isToday: weekIsos[i] === todayIsoMkt }))

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase whitespace-nowrap">
                This Week's Promotions
              </div>
              <span className="rounded-sm px-2 py-0.5 text-xs tracking-wide bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                8 active
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Daily Happy Hour hero */}
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] shadow-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-primary/15">
                <div className="text-sm font-semibold text-foreground">Daily Happy Hour</div>
                <span className="rounded-sm border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] tracking-widest text-primary uppercase">Every day</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">14:00 – 18:00</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-primary/10">
                {happyHourItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 px-5 py-4">
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-foreground leading-tight">{item.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Day-specific promos */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {promoRows.map((p) => (
                <div
                  key={p.dayKey}
                  className={cn(
                    "rounded-lg border bg-card shadow-card flex flex-col p-4",
                    p.isToday ? "border-primary bg-gradient-to-b from-primary/[0.06] to-card" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn("text-[10px] tracking-widest font-semibold uppercase", p.isToday ? "text-primary" : "text-muted-foreground")}>
                      {DAY_FULL[p.dayKey]}
                    </div>
                    {p.isToday && (
                      <span className="rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] tracking-[1.5px] text-primary uppercase leading-none">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-foreground leading-snug mb-3 flex-1">{p.name}</div>
                  <div className={cn(
                    "rounded-md border px-2.5 py-2 text-xs text-secondary-foreground leading-snug mb-3",
                    p.isToday ? "border-primary/20 bg-primary/[0.05]" : "border-primary/15 bg-primary/[0.04]",
                  )}>
                    {p.deal}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{p.hours}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── EVENT DETAIL PANEL ── */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdate={(updated) => {
            updateEvent.mutate({ id: selectedEvent.id, ...updated })
            setSelectedEvent(prev => prev ? { ...prev, ...updated } : null)
          }}
        />
      )}

      {/* ── 4. PARTNERSHIPS & INFLUENCERS ── */}
      <div className="space-y-3">
        <SectionTitle label="Partnerships & Influencers" />
        <div className="grid grid-cols-2 gap-3.5">

          {/* ── Partnership Tracker ── */}
          <div className="rounded-card border border-border bg-card shadow-card flex flex-col" style={{ height: 380 }}>
            <div className="flex items-center justify-between px-[18px] pt-4 pb-3 border-b border-border shrink-0">
              <div className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                <span className="text-primary">◈</span> Partnership Tracker — Pax Conversion
              </div>
              <button
                onClick={() => { setShowAddPartner(true); setEditingPartner(null) }}
                className="text-[11px] text-primary hover:text-primary/70 transition-colors"
              >
                + Add
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {showAddPartner && (
                <div className="px-[18px] py-3 border-b border-border bg-secondary/30 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Partner name" value={newPartner.name} onChange={(e) => setNewPartner(p => ({ ...p, name: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary w-full" />
                    <input placeholder="Type (e.g. Venue · Cross-promo)" value={newPartner.type} onChange={(e) => setNewPartner(p => ({ ...p, type: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary w-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={newPartner.status} onChange={(e) => setNewPartner(p => ({ ...p, status: e.target.value as PartnerStatus }))} className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary">
                      {(["Active","Negotiating","Follow Up","Inactive"] as PartnerStatus[]).map(s => <option key={s}>{s}</option>)}
                    </select>
                    <input placeholder="Pax / week" value={newPartner.pax} onChange={(e) => setNewPartner(p => ({ ...p, pax: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary" />
                    <input placeholder="Converting" value={newPartner.converting} onChange={(e) => setNewPartner(p => ({ ...p, converting: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowAddPartner(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
                    <button onClick={() => { if (!newPartner.name.trim()) return; setPartners(ps => [...ps, { ...newPartner, id: Date.now().toString() }]); setNewPartner({ name: "", type: "", status: "Active", pax: "", converting: "" }); setShowAddPartner(false) }} className="text-[11px] text-primary font-semibold hover:text-primary/70">Save</button>
                  </div>
                </div>
              )}

              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    {["Partner", "Status", "Pax / Wk", "Converting", ""].map((h) => (
                      <th key={h} className="text-[10px] tracking-widest text-muted-foreground uppercase text-left py-1.5 px-2 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-b-0 group hover:bg-secondary/40">
                      {editingPartner?.id === p.id ? (
                        <>
                          <td className="py-2 px-2" colSpan={4}>
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-2 gap-1.5">
                                <input value={editingPartner.name} onChange={(e) => setEditingPartner(ep => ep && ({ ...ep, name: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                                <input value={editingPartner.type} onChange={(e) => setEditingPartner(ep => ep && ({ ...ep, type: e.target.value }))} placeholder="Type" className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                <select value={editingPartner.status} onChange={(e) => setEditingPartner(ep => ep && ({ ...ep, status: e.target.value as PartnerStatus }))} className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary">
                                  {(["Active","Negotiating","Follow Up","Inactive"] as PartnerStatus[]).map(s => <option key={s}>{s}</option>)}
                                </select>
                                <input value={editingPartner.pax} onChange={(e) => setEditingPartner(ep => ep && ({ ...ep, pax: e.target.value }))} placeholder="Pax" className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                                <input value={editingPartner.converting} onChange={(e) => setEditingPartner(ep => ep && ({ ...ep, converting: e.target.value }))} placeholder="Converting" className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right align-top whitespace-nowrap">
                            <button onClick={() => { setPartners(ps => ps.map(x => x.id === editingPartner.id ? editingPartner : x)); setEditingPartner(null) }} className="text-[11px] text-primary font-semibold mr-2">Save</button>
                            <button onClick={() => setEditingPartner(null)} className="text-[11px] text-muted-foreground">✕</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-[9px] px-2">
                            <div className="text-sm text-foreground">{p.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{p.type}</div>
                          </td>
                          <td className="py-[9px] px-2">
                            <span className={cn("rounded-sm border px-[6px] py-[2px] text-[10px] tracking-wide uppercase whitespace-nowrap", statusClass(p.status))}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-[9px] px-2 text-sm text-foreground">{p.pax}</td>
                          <td className="py-[9px] px-2 text-sm text-foreground">{p.converting}</td>
                          <td className="py-[9px] px-2 text-right opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            <button onClick={() => setEditingPartner({ ...p })} className="text-[11px] text-muted-foreground hover:text-primary mr-2">Edit</button>
                            <button onClick={() => setPartners(ps => ps.filter(x => x.id !== p.id))} className="text-[11px] text-muted-foreground hover:text-error">✕</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Influencer Visits ── */}
          <div className="rounded-card border border-border bg-card shadow-card flex flex-col" style={{ height: 380 }}>
            <div className="flex items-center justify-between px-[18px] pt-4 pb-3 border-b border-border shrink-0">
              <div className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                <span className="text-primary">★</span> Influencer Visits
              </div>
              <button onClick={() => { setShowAddInfluencer(true); setEditingInfluencer(null) }} className="text-[11px] text-primary hover:text-primary/70 transition-colors">
                + Add
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-[18px]">
              {showAddInfluencer && (
                <div className="py-3 border-b border-border space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Name" value={newInfluencer.name} onChange={(e) => setNewInfluencer(i => ({ ...i, name: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                    <input placeholder="@handle · Niche" value={newInfluencer.handle} onChange={(e) => setNewInfluencer(i => ({ ...i, handle: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="Reach (e.g. 48K)" value={newInfluencer.reach} onChange={(e) => setNewInfluencer(i => ({ ...i, reach: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                    <select value={newInfluencer.statusType} onChange={(e) => setNewInfluencer(i => ({ ...i, statusType: e.target.value as InfluencerStatusType }))} className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary">
                      <option value="visited">Visited</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="prospect">Prospect</option>
                    </select>
                    <input placeholder="Status label" value={newInfluencer.status} onChange={(e) => setNewInfluencer(i => ({ ...i, status: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowAddInfluencer(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
                    <button onClick={() => { if (!newInfluencer.name.trim()) return; setInfluencers(list => [...list, { ...newInfluencer, id: Date.now().toString() }]); setNewInfluencer({ name: "", handle: "", reach: "", status: "", statusType: "prospect" }); setShowAddInfluencer(false) }} className="text-[11px] text-primary font-semibold hover:text-primary/70">Save</button>
                  </div>
                </div>
              )}

              {influencers.map((inf) => (
                <div key={inf.id} className="group flex items-center gap-3 py-2.5 border-b border-border last:border-b-0">
                  {editingInfluencer?.id === inf.id ? (
                    <div className="flex-1 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <input value={editingInfluencer.name} onChange={(e) => setEditingInfluencer(ei => ei && ({ ...ei, name: e.target.value }))} className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                        <input value={editingInfluencer.handle} onChange={(e) => setEditingInfluencer(ei => ei && ({ ...ei, handle: e.target.value }))} placeholder="@handle · Niche" className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <input value={editingInfluencer.reach} onChange={(e) => setEditingInfluencer(ei => ei && ({ ...ei, reach: e.target.value }))} placeholder="Reach" className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                        <select value={editingInfluencer.statusType} onChange={(e) => setEditingInfluencer(ei => ei && ({ ...ei, statusType: e.target.value as InfluencerStatusType }))} className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary">
                          <option value="visited">Visited</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="prospect">Prospect</option>
                        </select>
                        <input value={editingInfluencer.status} onChange={(e) => setEditingInfluencer(ei => ei && ({ ...ei, status: e.target.value }))} placeholder="Status label" className="rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setInfluencers(list => list.map(x => x.id === editingInfluencer.id ? editingInfluencer : x)); setEditingInfluencer(null) }} className="text-[11px] text-primary font-semibold">Save</button>
                        <button onClick={() => setEditingInfluencer(null)} className="text-[11px] text-muted-foreground">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-subheading text-sm font-semibold shrink-0 border border-border bg-primary/10 text-primary">
                        {inf.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground">{inf.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{inf.handle}</div>
                        <span className={cn("inline-block mt-1 rounded-sm border px-[6px] py-[2px] text-[10px] tracking-wide uppercase", infStatusClass(inf.statusType))}>
                          {inf.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="text-sm text-foreground">{inf.reach}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Followers</div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5">
                          <button onClick={() => setEditingInfluencer({ ...inf })} className="text-[11px] text-muted-foreground hover:text-primary leading-none">Edit</button>
                          <button onClick={() => setInfluencers(list => list.filter(x => x.id !== inf.id))} className="text-[11px] text-muted-foreground hover:text-error leading-none">✕</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── 5. TARGET AUDIENCE ── */}
      <div className="space-y-3">
        <SectionTitle label="Target Audience" />
        <div className="grid grid-cols-2 gap-3">
          {TARGET_AUDIENCE.map((a) => (
            <div key={a.type} className="rounded-card border border-border bg-secondary/30 shadow-card px-4 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#b5620a" }}>{a.type}</div>
              <div className="text-[11px] font-semibold text-foreground mb-2">{a.desc}</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {a.tags.map((tag) => (
                  <span key={tag} className="rounded-sm border border-border bg-card px-2 py-0.5 text-[9.5px] text-muted-foreground">{tag}</span>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground italic leading-snug">{a.insight}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. CONTENT PILLARS + BRAND VOICE ── */}
      <div className="space-y-3">
        <SectionTitle label="Content Pillars & Brand Voice" />
        <div className="grid grid-cols-2 gap-4">
          {/* Content Pillars */}
          <div className="rounded-card border border-border bg-card shadow-card p-5">
            <div className="text-xs font-semibold tracking-widest text-foreground uppercase flex items-center gap-2 mb-4">
              <span>🏛</span> Content Pillars
            </div>
            <div className="space-y-2">
              {CONTENT_PILLARS.map((p) => (
                <div key={p.name} className="flex gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2.5">
                  <span className="text-base shrink-0 mt-0.5">{p.icon}</span>
                  <div>
                    <div className="text-[12px] font-semibold text-foreground mb-0.5">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug">{p.desc}</div>
                    <div className="mt-1.5 inline-flex px-2 py-0.5 rounded-sm text-[9px] font-semibold border" style={{ background: "#fdf3e7", color: "#b5620a", borderColor: "#f5d4ba" }}>
                      {p.tone}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column: Brand Voice + Posting Rhythm */}
          <div className="flex flex-col gap-4">
            {/* Brand Voice & Tone */}
            <div className="rounded-card border border-border bg-card shadow-card p-5">
              <div className="text-xs font-semibold tracking-widest text-foreground uppercase flex items-center gap-2 mb-3">
                <span>🎙</span> Brand Voice &amp; Tone
              </div>
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-foreground mb-2">Brand Personalities</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: "The Soulful Friend", desc: "Friendly, warm, emotional, calm, rich imagery" },
                    { name: "The Sophisticated Minimalist", desc: "Free, professional, quality-focused, no hard sell" },
                  ].map((bp) => (
                    <div key={bp.name} className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                      <div className="text-[11px] font-semibold text-foreground">{bp.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{bp.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                {[
                  { ctx: "Daily Content", tone: "Light, evocative, emotional. Touch feelings, don't sell." },
                  { ctx: "Events / DJs", tone: "Confident, energetic. Music is the centrepiece." },
                  { ctx: "Vietnamese Holidays", tone: "Respectful, warm, not performative. Culturally real." },
                  { ctx: "Language", tone: "Primary: English. Short, story-driven, soft CTA. Max 3 posts/week feed." },
                ].map((row, i, arr) => (
                  <div key={row.ctx} className={cn("grid grid-cols-[100px_1fr] gap-3 py-2", i < arr.length - 1 ? "border-b border-border" : "")}>
                    <div className="text-[11px] font-semibold text-foreground">{row.ctx}</div>
                    <div className="text-[11px] text-muted-foreground">{row.tone}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-md bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
                <strong className="text-foreground">Hashtags:</strong> #TheRoofdanang #bardanang #cocktaildanang #listeningbar
              </div>
            </div>

            {/* Posting Rhythm */}
            <div className="rounded-card border border-border bg-card shadow-card p-5">
              <div className="text-xs font-semibold tracking-widest text-foreground uppercase flex items-center gap-2 mb-3">
                <span>📅</span> Posting Rhythm Target
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { val: "3", label: "Feed posts / week" },
                  { val: "3", label: "Reels / week" },
                  { val: "90", label: "Stories / month" },
                ].map((r) => (
                  <div key={r.label} className="rounded-md border border-border bg-secondary/30 px-3 py-2.5 text-center">
                    <div className="font-display text-[22px] leading-none tracking-[2px] text-foreground">{r.val}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{r.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 9. PAID ADS ── */}
      <div className="space-y-3">
        <SectionTitle label="Paid Ads — This Week" />
        <div className="grid grid-cols-4 gap-3.5">
          <div className="col-span-2 relative overflow-hidden rounded-card border border-border bg-card p-[18px_20px] shadow-card">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#1877f2] to-transparent" />
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                <span className="text-primary">◑</span> Facebook &amp; Instagram Ads
              </div>
              <div className="text-xs text-muted-foreground">Budget: 2,000,000 VND / week</div>
            </div>
            <div className="h-[2px] bg-accent rounded-sm overflow-hidden mb-1">
              <div className="h-full rounded-sm bg-gradient-to-r from-[#1877f2] to-[#4285f4]" style={{ width: "68%" }} />
            </div>
            <div className="text-xs text-muted-foreground mb-4">1,360,000 VND spent · 640,000 remaining · 68%</div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { val: "18,400", label: "Reach", delta: "↑ +22%", dc: "text-success" },
                { val: "420", label: "Link Clicks", delta: "↑ +15%", dc: "text-success" },
                { val: "3,240", label: "VND / Click", delta: "↓ Good", dc: "text-success" },
                { val: "2.3%", label: "CTR", delta: "→ Avg", dc: "text-warning" },
              ].map((k) => (
                <div key={k.label} className="text-center">
                  <div className="font-display text-[26px] leading-none tracking-[2px] text-foreground">{k.val}</div>
                  <div className="text-[10px] tracking-wide text-muted-foreground uppercase mt-0.5">{k.label}</div>
                  <div className={cn("text-xs mt-[3px]", k.dc)}>{k.delta}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card border border-border bg-card p-[18px_20px] shadow-card">
            <div className="text-xs tracking-widests text-muted-foreground uppercase flex items-center gap-1.5 mb-2">
              <span className="text-primary">◎</span> Top Performing Ad
            </div>
            <div className="font-subheading text-[15px] text-primary mb-2">Saturday Club Night</div>
            {[
              { label: "Clicks", value: "248", color: "text-success" },
              { label: "CTR", value: "3.1%", color: "" },
              { label: "Spend", value: "640K VND", color: "" },
              { label: "Cost/click", value: "2,580 VND", color: "text-success" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0">
                <span className="text-xs text-secondary-foreground">{s.label}</span>
                <span className={cn("text-sm", s.color || "text-foreground")}>{s.value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-card border border-border bg-card p-[18px_20px] shadow-card">
            <div className="text-xs tracking-widests text-muted-foreground uppercase flex items-center gap-1.5 mb-2">
              <span className="text-primary">△</span> Recommendations
            </div>
            {[
              { num: "01", color: "text-primary", text: "Increase Saturday budget — best CPC this week" },
              { num: "02", color: "text-warning", text: "Start Women's Day ad now — 19 days out" },
              { num: "03", color: "text-muted-foreground", text: "Pause FB general awareness — low ROI" },
            ].map((r) => (
              <div key={r.num} className="flex items-baseline gap-2 py-[5px] border-b border-border last:border-b-0">
                <span className={cn("text-xs", r.color)}>{r.num}</span>
                <span className="text-xs text-secondary-foreground leading-relaxed">{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   EventDetailPanel — slide-over for managing an event
   ──────────────────────────────────────────────────────────── */

interface EventDetailPanelProps {
  event: CalendarEvent
  onClose: () => void
  onUpdate: (patch: Partial<CalendarEvent>) => void
}

function EventDetailPanel({ event, onClose, onUpdate }: EventDetailPanelProps) {
  const [description, setDescription] = useState(event.description ?? "")
  const [checklist, setChecklist] = useState<EventChecklistItem[]>(event.checklist ?? [])
  const [newTask, setNewTask] = useState("")
  const [status, setStatus] = useState<EventMarketingStatus>(event.marketingStatus ?? "not_started")
  const newTaskRef = useRef<HTMLInputElement>(null)

  // Sync local state when event prop changes (e.g. after mutation)
  useEffect(() => {
    setDescription(event.description ?? "")
    setChecklist(event.checklist ?? [])
    setStatus(event.marketingStatus ?? "not_started")
  }, [event.id])

  const STATUS_OPTIONS: Array<{ value: EventMarketingStatus; label: string; cls: string }> = [
    { value: "not_started", label: "Not Started", cls: "text-muted-foreground" },
    { value: "planning",    label: "Planning",    cls: "text-warning" },
    { value: "urgent",      label: "Urgent",      cls: "text-error" },
    { value: "confirmed",   label: "Confirmed",   cls: "text-success" },
    { value: "past",        label: "Past",        cls: "text-muted-foreground" },
  ]

  function handleStatusChange(val: EventMarketingStatus) {
    setStatus(val)
    onUpdate({ marketingStatus: val })
  }

  function handleDescriptionBlur() {
    if (description !== (event.description ?? "")) {
      onUpdate({ description })
    }
  }

  function toggleItem(id: string) {
    const updated = checklist.map(c => c.id === id ? { ...c, done: !c.done } : c)
    setChecklist(updated)
    onUpdate({ checklist: updated })
  }

  function deleteItem(id: string) {
    const updated = checklist.filter(c => c.id !== id)
    setChecklist(updated)
    onUpdate({ checklist: updated })
  }

  function addItem() {
    const text = newTask.trim()
    if (!text) return
    const updated = [...checklist, { id: crypto.randomUUID(), text, done: false }]
    setChecklist(updated)
    onUpdate({ checklist: updated })
    setNewTask("")
    newTaskRef.current?.focus()
  }

  const doneCount = checklist.filter(c => c.done).length
  const progress = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0
  const daysUntil = differenceInDays(new Date(event.startDate + 'T00:00:00'), new Date())

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[400] bg-foreground/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-[401] w-full max-w-[440px] bg-card border-l border-border shadow-[−4px_0_24px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div className="flex-1 min-w-0 pr-4">
            <div className="font-subheading text-lg font-semibold text-foreground leading-snug truncate">{event.title}</div>
            <div className="text-xs tracking-wider text-muted-foreground uppercase mt-0.5">
              {format(new Date(event.startDate + 'T00:00:00'), 'EEEE, d MMMM yyyy')}
              {daysUntil > 0 && ` · ${daysUntil}d away`}
              {daysUntil === 0 && ' · Today'}
              {daysUntil < 0 && ' · Past'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Status + meta */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs tracking-wider text-muted-foreground uppercase w-20 shrink-0">Status</span>
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStatusChange(opt.value)}
                    className={cn(
                      "px-2.5 py-[3px] rounded-full border text-xs tracking-wide transition-colors",
                      status === opt.value
                        ? opt.value === "urgent"    ? "bg-error/10 border-error/40 text-error"
                        : opt.value === "confirmed" ? "bg-success/10 border-success/40 text-success"
                        : opt.value === "planning"  ? "bg-warning/10 border-warning/40 text-warning"
                        : "bg-secondary border-border text-foreground"
                        : "bg-transparent border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {event.location && (
              <div className="flex items-center gap-3">
                <span className="text-xs tracking-wider text-muted-foreground uppercase w-20 shrink-0">Location</span>
                <span className="text-sm text-foreground">{event.location}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs tracking-wider text-muted-foreground uppercase w-20 shrink-0">Type</span>
              <span className="text-sm text-foreground capitalize">{event.eventType.replace(/_/g, ' ')}</span>
            </div>
          </div>

          {/* Description / Notes */}
          <div>
            <div className="text-xs tracking-wider text-muted-foreground uppercase mb-2">Notes</div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add notes or description for this event..."
              rows={3}
              className="w-full rounded-sm border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs tracking-wider text-muted-foreground uppercase">Checklist</div>
              {checklist.length > 0 && (
                <div className="text-xs text-muted-foreground">{doneCount}/{checklist.length} · {progress}%</div>
              )}
            </div>

            {/* Progress bar */}
            {checklist.length > 0 && (
              <div className="h-[3px] bg-accent rounded-sm overflow-hidden mb-3">
                <div
                  className="h-full rounded-sm bg-gradient-to-r from-primary to-chart-2 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Items */}
            <div className="space-y-1.5">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2.5 group">
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className={cn(
                      "w-4 h-4 rounded-sm border shrink-0 flex items-center justify-center transition-colors",
                      item.done
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/50",
                    )}
                  >
                    {item.done && (
                      <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                  <span className={cn("flex-1 text-sm leading-snug", item.done && "line-through text-muted-foreground")}>
                    {item.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="shrink-0 text-muted-foreground/40 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}

              {checklist.length === 0 && (
                <div className="text-sm text-muted-foreground italic">No tasks yet. Add one below.</div>
              )}
            </div>

            {/* Add task input */}
            <div className="flex gap-2 mt-3">
              <input
                ref={newTaskRef}
                type="text"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addItem()}
                placeholder="Add a task..."
                className="flex-1 rounded-sm border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={addItem}
                disabled={!newTask.trim()}
                className="px-3 py-1.5 rounded-sm border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
