import { useMemo, useState, useRef, useEffect } from "react"
import { addDays, format, isSameDay, startOfWeek, differenceInDays } from "date-fns"
import { cn } from "@/lib/utils"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — lucide deprecated brand icons still ship
import { Facebook, Instagram, Music2 } from "lucide-react"
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ExternalLink, Link2, Minus, RefreshCcw, Search, TrendingDown, TrendingUp, Upload } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { SectionTitle } from "@/components/ui/section-title"
import { useContentCalendar } from "@/hooks/useContentCalendar"
import { useGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync"
import { useUpcomingEvents, useUpdateEvent } from "@/hooks/useEvents"
import { useRoofCalendarWeekData, type RoofCalendarEvent } from "@/hooks/useWeekAtGlanceCsv"
import { useAdsCampaignPerformance, useMarketingIntegrations } from "@/hooks/useAdsIntegrations"
import { useLatestMarketingSocialMonthlyReport } from "@/hooks/useMarketingSocialMonthly"
import { type SocialMonthlyPayload, type SocialPlatformKey } from "@/lib/marketingSocialCsvParser"
import {
  getEventAttachmentSignedUrl,
  useDeleteEventAttachment,
  useEventAttachments,
  useUploadEventAttachment,
} from "@/hooks/useEventAttachments"
import { BrandKitLibrary } from "@/components/marketing/BrandKitLibrary"
import type { CalendarEvent, EventChecklistItem, EventMarketingStatus } from "@/types"

/* ────────────────────────────────────────────────────────────
   Static data
   ──────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────
   Shared SocialCard types & data
   ──────────────────────────────────────────────────────────── */

type HealthStatus = "Growing" | "Flat" | "Needs Attn"
type StatDir = "up" | "down" | "flat" | "alert"

interface ChannelStat {
  label: string
  value: string
  delta?: string
  dir: StatDir
}

interface ChannelAction {
  message: string
  href: string
  label: string
}

interface Channel {
  key: string
  name: string
  Icon: React.ElementType
  health: HealthStatus
  /** Primary metric value, e.g. "4,820" */
  primaryValue: string
  /** Label under primary metric, e.g. "Followers" */
  primaryLabel: string
  gradient: string
  /** 2–4 secondary stats rendered in a 2-col grid */
  stats: ChannelStat[]
  /** Bottom-row link-clicks count */
  linkClicks: string
  /** 7-bar sparkline data (0–100). Empty = no sparkline. */
  spark: number[]
  /** Optional CTA shown when health === "Needs Attn" or any alert state */
  action?: ChannelAction
}

function healthClass(h: HealthStatus) {
  if (h === "Growing")    return "border-success/25 bg-success/10 text-success"
  if (h === "Flat")       return "border-warning/25 bg-warning/10 text-warning"
  return "border-error/25 bg-error/10 text-error"
}

const DEFAULT_CHANNELS: Channel[] = [
  {
    key: "ig",
    name: "Instagram",
    Icon: Instagram,
    health: "Growing",
    primaryValue: "4,820",
    primaryLabel: "Followers",
    gradient: "from-[#c13584] via-[#e1306c] via-[#f77737] to-transparent",
    stats: [
      { label: "Engagement",    value: "6.2%",  dir: "up"   },
      { label: "Reach",         value: "12.4K", delta: "+18%", dir: "up"   },
      { label: "New Followers", value: "+142",  dir: "up"   },
      { label: "Profile Visits",value: "840",   dir: "flat" },
    ],
    linkClicks: "420",
    spark: [40, 55, 45, 70, 60, 80, 100],
  },
  {
    key: "tiktok",
    name: "TikTok",
    Icon: Music2,
    health: "Growing",
    primaryValue: "2,310",
    primaryLabel: "Followers",
    gradient: "from-[#2a7a6e] via-[#69c9d0] to-transparent",
    stats: [
      { label: "Avg Views",     value: "3.8K", delta: "+32%", dir: "up"   },
      { label: "Engagement",    value: "8.4%",  dir: "up"   },
      { label: "New Followers", value: "+54",   dir: "up"   },
      { label: "Videos Posted", value: "3",     dir: "flat" },
    ],
    linkClicks: "180",
    spark: [30, 50, 90, 40, 65, 55, 85],
  },
  {
    key: "fb",
    name: "Facebook",
    Icon: Facebook,
    health: "Flat",
    primaryValue: "3,640",
    primaryLabel: "Page Likes",
    gradient: "from-[#1877f2] to-transparent",
    stats: [
      { label: "Reach",       value: "4.2K", dir: "flat" },
      { label: "Engagement",  value: "2.1%", dir: "down" },
      { label: "New Likes",   value: "+14",  dir: "flat" },
      { label: "Posts",       value: "5",    dir: "flat" },
    ],
    linkClicks: "380",
    spark: [60, 55, 50, 58, 45, 52, 48],
  },
  {
    key: "google",
    name: "Google",
    Icon: Search,
    health: "Needs Attn",
    primaryValue: "4.7 ★",
    primaryLabel: "Star Rating · 142 Reviews",
    gradient: "from-[#4285f4] via-[#34a853] via-[#fbbc05] via-[#ea4335] to-transparent",
    stats: [
      { label: "New Reviews",   value: "2",    delta: "!", dir: "alert" },
      { label: "Unanswered",    value: "2",    dir: "alert" },
      { label: "Searches",      value: "1.8K", dir: "flat"  },
      { label: "Direction Reqs",value: "94",   dir: "flat"  },
    ],
    linkClicks: "260",
    spark: [72, 68, 75, 70, 65, 71, 69],
    action: {
      message: "2 unanswered reviews need a reply",
      href: "https://business.google.com/reviews",
      label: "Open Google Business",
    },
  },
]

type MissingMetricField = {
  key: string
  platform: SocialPlatformKey
  label: string
  valueType: "number" | "percent" | "rating"
}

const REQUIRED_SOCIAL_FIELDS: MissingMetricField[] = [
  { key: "instagram.reach", platform: "instagram", label: "Instagram Reach", valueType: "number" },
  { key: "instagram.engagement_rate", platform: "instagram", label: "Instagram Engagement %", valueType: "percent" },
  { key: "instagram.new_followers", platform: "instagram", label: "Instagram New Followers", valueType: "number" },
  { key: "instagram.profile_visits", platform: "instagram", label: "Instagram Page/Profile Visits", valueType: "number" },
  { key: "instagram.link_clicks", platform: "instagram", label: "Instagram Link Clicks", valueType: "number" },
  { key: "facebook.reach", platform: "facebook", label: "Facebook Reach", valueType: "number" },
  { key: "facebook.engagement_rate", platform: "facebook", label: "Facebook Engagement %", valueType: "percent" },
  { key: "facebook.new_likes", platform: "facebook", label: "Facebook New Likes", valueType: "number" },
  { key: "facebook.profile_visits", platform: "facebook", label: "Facebook Page Visits", valueType: "number" },
  { key: "facebook.link_clicks", platform: "facebook", label: "Facebook Link Clicks", valueType: "number" },
  { key: "tiktok.avg_views", platform: "tiktok", label: "TikTok Avg Views", valueType: "number" },
  { key: "tiktok.new_followers", platform: "tiktok", label: "TikTok New Followers", valueType: "number" },
  { key: "tiktok.profile_visits", platform: "tiktok", label: "TikTok Page Visits", valueType: "number" },
  { key: "google.star_rating", platform: "google", label: "Google Star Rating", valueType: "rating" },
  { key: "google.total_reviews", platform: "google", label: "Google Total Reviews", valueType: "number" },
  { key: "google.new_reviews", platform: "google", label: "Google New Reviews", valueType: "number" },
  { key: "google.unanswered_reviews", platform: "google", label: "Google Unanswered Reviews", valueType: "number" },
  { key: "google.searches", platform: "google", label: "Google Searches", valueType: "number" },
  { key: "google.direction_requests", platform: "google", label: "Google Direction Requests", valueType: "number" },
]

function numberFmt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—"
  return new Intl.NumberFormat("en-US").format(v)
}

function compactFmt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—"
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`
  return numberFmt(v)
}

function percentFmt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v.toFixed(1)}%`
}

function readSocialValue(payload: SocialMonthlyPayload, key: string): number | null {
  const [platform, field] = key.split(".")
  const p = payload[platform as SocialPlatformKey] as Record<string, number | null | undefined>
  const value = p?.[field]
  return value == null || !Number.isFinite(value) ? null : Number(value)
}

function missingSocialFields(payload: SocialMonthlyPayload): MissingMetricField[] {
  return REQUIRED_SOCIAL_FIELDS.filter((field) => readSocialValue(payload, field.key) == null)
}

function deriveHealthFromPayload(payload: SocialMonthlyPayload, platform: SocialPlatformKey): HealthStatus {
  if (missingSocialFields(payload).some((x) => x.platform === platform)) return "Needs Attn"
  const p = payload[platform]
  if ((p.engagement_rate || 0) >= 5) return "Growing"
  if ((p.engagement_rate || 0) >= 2) return "Flat"
  return "Needs Attn"
}

function buildSocialChannels(payload: SocialMonthlyPayload | null): Channel[] {
  if (!payload) return DEFAULT_CHANNELS
  return [
    {
      key: "ig",
      name: "Instagram",
      Icon: Instagram,
      health: deriveHealthFromPayload(payload, "instagram"),
      primaryValue: payload.instagram.followers_total != null
        ? numberFmt(payload.instagram.followers_total)
        : payload.instagram.new_followers != null
        ? `+${numberFmt(payload.instagram.new_followers)}`
        : "—",
      primaryLabel: payload.instagram.followers_total != null ? "Followers" : "New Followers (month)",
      gradient: "from-[#c13584] via-[#e1306c] via-[#f77737] to-transparent",
      stats: [
        { label: "Engagement", value: percentFmt(payload.instagram.engagement_rate), dir: "up" },
        { label: "Reach", value: compactFmt(payload.instagram.reach), dir: "flat" },
        { label: "New Followers", value: payload.instagram.new_followers != null ? `+${numberFmt(payload.instagram.new_followers)}` : "—", dir: "up" },
        { label: "Profile Visits", value: numberFmt(payload.instagram.profile_visits), dir: "flat" },
      ],
      linkClicks: numberFmt(payload.instagram.link_clicks),
      spark: [36, 45, 56, 52, 61, 74, 82],
    },
    {
      key: "tiktok",
      name: "TikTok",
      Icon: Music2,
      health: deriveHealthFromPayload(payload, "tiktok"),
      primaryValue: payload.tiktok.followers_total != null
        ? numberFmt(payload.tiktok.followers_total)
        : payload.tiktok.new_followers != null
        ? `+${numberFmt(payload.tiktok.new_followers)}`
        : "—",
      primaryLabel: payload.tiktok.followers_total != null ? "Followers" : "New Followers (month)",
      gradient: "from-[#2a7a6e] via-[#69c9d0] to-transparent",
      stats: [
        { label: "Avg Views", value: compactFmt(payload.tiktok.avg_views), dir: "flat" },
        { label: "Engagement", value: percentFmt(payload.tiktok.engagement_rate), dir: "up" },
        { label: "New Followers", value: payload.tiktok.new_followers != null ? `+${numberFmt(payload.tiktok.new_followers)}` : "—", dir: "up" },
        { label: "Videos Posted", value: numberFmt(payload.tiktok.videos_posted), dir: "flat" },
      ],
      linkClicks: numberFmt(payload.tiktok.link_clicks),
      spark: [30, 48, 60, 44, 52, 66, 78],
    },
    {
      key: "fb",
      name: "Facebook",
      Icon: Facebook,
      health: deriveHealthFromPayload(payload, "facebook"),
      primaryValue: payload.facebook.page_likes_total != null
        ? numberFmt(payload.facebook.page_likes_total)
        : payload.facebook.new_likes != null
        ? `+${numberFmt(payload.facebook.new_likes)}`
        : "—",
      primaryLabel: payload.facebook.page_likes_total != null ? "Page Likes" : "New Likes (month)",
      gradient: "from-[#1877f2] to-transparent",
      stats: [
        { label: "Reach", value: compactFmt(payload.facebook.reach), dir: "flat" },
        { label: "Engagement", value: percentFmt(payload.facebook.engagement_rate), dir: "flat" },
        { label: "New Likes", value: payload.facebook.new_likes != null ? `+${numberFmt(payload.facebook.new_likes)}` : "—", dir: "flat" },
        { label: "Posts", value: numberFmt(payload.facebook.posts), dir: "flat" },
      ],
      linkClicks: numberFmt(payload.facebook.link_clicks),
      spark: [56, 58, 52, 50, 54, 53, 51],
    },
    {
      key: "google",
      name: "Google",
      Icon: Search,
      health: deriveHealthFromPayload(payload, "google"),
      primaryValue: payload.google.star_rating != null ? `${payload.google.star_rating.toFixed(1)} ★` : "—",
      primaryLabel: payload.google.total_reviews != null ? `Star Rating · ${numberFmt(payload.google.total_reviews)} Reviews` : "Star Rating",
      gradient: "from-[#4285f4] via-[#34a853] via-[#fbbc05] via-[#ea4335] to-transparent",
      stats: [
        { label: "New Reviews", value: numberFmt(payload.google.new_reviews), dir: "alert" },
        { label: "Unanswered", value: numberFmt(payload.google.unanswered_reviews), dir: "alert" },
        { label: "Searches", value: compactFmt(payload.google.searches), dir: "flat" },
        { label: "Direction Reqs", value: numberFmt(payload.google.direction_requests), dir: "flat" },
      ],
      linkClicks: numberFmt(payload.google.link_clicks),
      spark: [65, 66, 64, 62, 63, 64, 66],
      action: payload.google.unanswered_reviews && payload.google.unanswered_reviews > 0
        ? {
            message: `${numberFmt(payload.google.unanswered_reviews)} unanswered reviews need a reply`,
            href: "https://business.google.com/reviews",
            label: "Open Google Business",
          }
        : undefined,
    },
  ]
}

/* ────────────────────────────────────────────────────────────
   SocialCard — shared component
   ──────────────────────────────────────────────────────────── */

function StatCell({ stat }: { stat: ChannelStat }) {
  const valueColor =
    stat.dir === "alert" ? "text-error" :
    stat.dir === "up"    ? "text-success" :
    stat.dir === "down"  ? "text-error" :
    "text-foreground"

  return (
    <div className="rounded-sm bg-secondary/60 px-2 py-1.5">
      <div className="text-[9px] tracking-wider text-muted-foreground uppercase mb-0.5 truncate">{stat.label}</div>
      <div className="flex items-center gap-1 text-xs font-semibold">
        <span className={valueColor}>{stat.value}</span>
        {stat.dir === "alert" && stat.delta && (
          <AlertTriangle className="h-3 w-3 text-error animate-pulse" />
        )}
        {stat.dir !== "alert" && stat.delta && (
          <span className={cn("text-[10px]", stat.dir === "up" ? "text-success" : stat.dir === "down" ? "text-error" : "text-muted-foreground")}>
            {stat.delta}
          </span>
        )}
        {stat.dir !== "alert" && !stat.delta && stat.dir === "up" && (
          <TrendingUp className="h-3 w-3 text-success" />
        )}
        {stat.dir !== "alert" && !stat.delta && stat.dir === "down" && (
          <TrendingDown className="h-3 w-3 text-error" />
        )}
      </div>
    </div>
  )
}

function SocialCard({ ch }: { ch: Channel }) {
  const isAlert = ch.health === "Needs Attn"

  return (
    <div className={cn(
      "group relative flex flex-col overflow-hidden rounded-card border bg-card shadow-card transition-all hover:shadow-card-hover",
      isAlert ? "border-error/30" : "border-border",
    )}>
      {/* Top colour bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r", ch.gradient)} />

      <div className="flex flex-col flex-1 p-[18px_20px] pt-5 gap-3">

        {/* ① Header: icon + name + status badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              isAlert ? "bg-error/10 text-error" : "bg-secondary text-muted-foreground",
            )}>
              <ch.Icon className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-semibold tracking-widest text-foreground uppercase truncate">{ch.name}</span>
          </div>
          <span className={cn(
            "shrink-0 rounded-sm border px-1.5 py-[2px] text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap",
            healthClass(ch.health),
          )}>
            {ch.health}
          </span>
        </div>

        {/* ② Primary metric */}
        <div>
          <div className={cn(
            "font-display leading-none tracking-[2px]",
            isAlert ? "text-[32px] text-error" : "text-[38px] text-foreground",
          )}>
            {ch.primaryValue}
          </div>
          <div className="text-[11px] tracking-wide text-muted-foreground mt-1">{ch.primaryLabel}</div>
        </div>

        {/* ③ Secondary stats 2-col grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {ch.stats.map((s) => <StatCell key={s.label} stat={s} />)}
        </div>

        {/* ④ Sparkline */}
        {ch.spark.length > 0 && (
          <div className="flex items-end gap-[2px] h-[16px]">
            {ch.spark.map((h, i) => (
              <div
                key={i}
                className={cn("flex-1 rounded-[1px]", i === ch.spark.length - 1 ? "bg-primary" : "bg-primary/15")}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        )}

        {/* ⑤ Action CTA — only rendered when present */}
        {ch.action && (
          <div className="flex items-center justify-between gap-2 rounded-sm border border-error/20 bg-error/[0.06] px-2.5 py-[7px] -mx-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="h-3 w-3 text-error shrink-0" />
              <span className="text-[11px] text-error truncate">{ch.action.message}</span>
            </div>
            <a
              href={ch.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-error hover:text-error/80 transition-colors whitespace-nowrap"
            >
              {ch.action.label}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        )}

        {/* ⑥ Bottom row: link clicks */}
        <div className="flex items-center justify-between border-t border-border pt-2 mt-auto">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Link2 className="h-3 w-3 shrink-0" />
            Link clicks this month
          </div>
          <span className="text-[12px] font-semibold text-foreground tabular-nums">{ch.linkClicks}</span>
        </div>

      </div>
    </div>
  )
}


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
  const { data: latestSocialReport } = useLatestMarketingSocialMonthlyReport()
  const activeSocialPayload = latestSocialReport?.payload ?? null
  const socialChannels = useMemo(() => buildSocialChannels(activeSocialPayload), [activeSocialPayload])

  // ── Live events ─────────────────────────────────────────────────────────
  const { data: upcomingEvents = [] } = useUpcomingEvents(60)
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
    // Start from Monday of THIS week so we still show the current-week context,
    // but extend the horizon far enough to cover every future CSV row (roughly
    // the next ~90 days). Previously this was capped at 7 days, which is why
    // anything from Apr 29 onwards was falling back to Supabase-only rows with
    // no DJ/time info.
    const [y, m, d] = todayIsoMkt.split("-").map(Number)
    const anchor = new Date(Date.UTC(y, m - 1, d))
    const dowMon0 = (anchor.getUTCDay() + 6) % 7
    const start = new Date(Date.UTC(y, m - 1, d - dowMon0))
    const HORIZON_DAYS = 120

    // Bucket roof events by date so multi-DJ rows collapse into one card
    const byIso = new Map<string, typeof roofEvents>()
    for (const ev of roofEvents) {
      if (!ev.eventName) continue
      const list = byIso.get(ev.dateIso) || []
      list.push(ev)
      byIso.set(ev.dateIso, list)
    }

    const cards: { iso: string; first: (typeof roofEvents)[number]; extra: number }[] = []
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const dt = new Date(start)
      dt.setUTCDate(start.getUTCDate() + i)
      const iso = dt.toISOString().slice(0, 10)
      const dayEvents = byIso.get(iso)
      if (!dayEvents || dayEvents.length === 0) continue
      cards.push({
        iso,
        first: dayEvents[0],
        extra: Math.max(0, dayEvents.length - 1),
      })
    }
    return cards
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

  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-foreground">Marketing Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            {" · "}Brand Command Center
          </p>
        </div>
        <div className="flex items-center gap-2 self-start mt-1">
          <button
            type="button"
            onClick={() => navigate("/marketing/plans")}
            className="rounded-sm border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            Marketing Plans
          </button>
          <button
            type="button"
            onClick={() => navigate("/marketing/integrations")}
            className="rounded-sm border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            Integrations
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-sm border border-border text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Club Night
          </div>
        </div>
      </div>

      {/* ── 1. BRAND IDENTITY HERO ── */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1px_1fr_1px_1fr] rounded-card overflow-hidden border border-border shadow-card" style={{ background: "#1a1714" }}>
        {/* Mission */}
        <div className="p-7 border-b border-white/10 sm:border-b-0">
          <div className="text-[9px] font-semibold tracking-[0.12em] uppercase text-white/35 mb-2">Mission</div>
          <div className="font-subheading text-[15px] font-medium text-white/90 leading-snug mb-2">
            The Roof brings <em className="not-italic" style={{ color: "#c9a84c" }}>like-minded souls</em> together
          </div>
          <div className="text-[12px] text-white/50 leading-relaxed">
            Creating unhurried moments above the city, where emotions are shaped by the sea breeze, music, and every thoughtfully crafted cocktail.
          </div>
        </div>

        {/* divider */}
        <div className="hidden sm:block" style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Big Idea */}
        <div className="p-7 border-b border-white/10 sm:border-b-0">
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
        <div className="hidden sm:block" style={{ background: "rgba(255,255,255,0.1)" }} />

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

      {/* ── 1b. BRAND KIT & REFERENCE LIBRARY ── */}
      <BrandKitLibrary onOpenPlans={() => navigate("/marketing/plans")} />

      {/* ── 2. SOCIAL PERFORMANCE ── */}
      <div className="space-y-3">
        <SectionTitle label="Social Media Performance — Monthly Update" />
        <div className="rounded-card border border-border bg-card p-3 shadow-card space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Monthly source uploads now live in <strong>Integrations</strong>.
            </p>
            <button
              type="button"
              onClick={() => navigate("/marketing/integrations")}
              className="rounded-sm border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              Open Integrations
            </button>
          </div>
          {latestSocialReport?.report_month && (
            <div className="text-[11px] text-muted-foreground">
              Last saved month:{" "}
              <span className="text-foreground">{format(new Date(latestSocialReport.report_month), "MMM yyyy")}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {socialChannels.map((ch) => <SocialCard key={ch.key} ch={ch} />)}
        </div>
      </div>

      {/* ── 3. USP BAND ── */}
      <div className="rounded-card border border-border overflow-hidden shadow-card" style={{ background: "#f5edd8", borderColor: "#e8d9b0" }}>
        <div className="px-6 pt-5 pb-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-4" style={{ color: "#b5620a" }}>Our 5 Unique Selling Points</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-0">
            {USPS.map((u, i) => (
              <div key={u.name} className={cn("pb-5 sm:px-4", i === 0 ? "sm:pl-0" : "", i === USPS.length - 1 ? "sm:pr-0" : "", i < USPS.length - 1 ? "sm:border-r" : "")} style={{ borderColor: "#e8d9b0" }}>
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
                onClick={() => navigate("/marketing/content-calendar")}
                className="px-3 py-1 rounded-sm border border-border text-xs text-muted-foreground hover:bg-secondary"
              >
                Open Calendar
              </button>
            </div>

            {/* grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const iso = format(day, "yyyy-MM-dd")
                const dayPosts = postsByDate.get(iso) ?? []
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={iso}
                    className={cn(
                      "rounded-md border overflow-hidden min-h-[80px] md:min-h-[130px]",
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

      {/* ── UPCOMING EVENTS (TABLE) ── */}
      <UpcomingEventsTable
        pipelineCards={pipelineCards}
        upcomingEvents={upcomingEvents}
        onSelectEvent={setSelectedEvent}
        mktStatusConfig={mktStatusConfig}
      />

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  <div key={row.ctx} className={cn("grid grid-cols-[auto_1fr] gap-3 py-2", i < arr.length - 1 ? "border-b border-border" : "")}>
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

      {/* ── 9. PAID ADS (LIVE) ── */}
      <LivePaidAdsPanel onNavigate={navigate} />

    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   UpcomingEventsTable — unified table view of pipeline + CRM events
   ──────────────────────────────────────────────────────────── */

type PipelineCard = {
  iso: string
  first: RoofCalendarEvent | null
  extra: number
}

type MktStatusConfig = Record<EventMarketingStatus, { label: string; cls: string }>

function UpcomingEventsTable({
  pipelineCards,
  upcomingEvents,
  onSelectEvent,
  mktStatusConfig,
}: {
  pipelineCards: PipelineCard[]
  upcomingEvents: CalendarEvent[]
  onSelectEvent: (ev: CalendarEvent) => void
  mktStatusConfig: MktStatusConfig
}) {
  const rows = useMemo(() => {
    type Row = {
      iso: string
      csv: PipelineCard["first"]
      extra: number
      supa: CalendarEvent | null
    }
    const map = new Map<string, Row>()

    for (const card of pipelineCards) {
      map.set(card.iso, { iso: card.iso, csv: card.first, extra: card.extra, supa: null })
    }
    for (const ev of upcomingEvents) {
      const iso = ev.startDate
      const existing = map.get(iso)
      if (existing) {
        existing.supa = ev
      } else {
        map.set(iso, { iso, csv: null, extra: 0, supa: ev })
      }
    }

    return Array.from(map.values()).sort((a, b) => a.iso.localeCompare(b.iso))
  }, [pipelineCards, upcomingEvents])

  const [showPast, setShowPast] = useState(false)
  const [windowDays, setWindowDays] = useState<7 | 14 | 30 | 60 | 90>(30)
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const horizonIso = useMemo(() => {
    const [y, m, d] = todayIso.split("-").map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + windowDays)
    return dt.toISOString().slice(0, 10)
  }, [todayIso, windowDays])
  const visible = useMemo(() => {
    if (showPast) return rows
    return rows.filter((r) => r.iso >= todayIso && r.iso < horizonIso)
  }, [rows, showPast, todayIso, horizonIso])
  const pastCount = rows.filter((r) => r.iso < todayIso).length
  const beyondCount = rows.filter((r) => r.iso >= horizonIso).length

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <SectionTitle label="Upcoming Events" />
        <div className="rounded-card border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
          No upcoming events found.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase whitespace-nowrap">
          Upcoming Events
        </div>
        <span className="rounded-sm px-2 py-0.5 text-xs tracking-wide bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
          {visible.length} {visible.length === 1 ? "event" : "events"}
        </span>
        {!showPast && (
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            Next {windowDays} days
          </span>
        )}
        <div className="h-px flex-1 bg-border" />
        {!showPast && (
          <div className="inline-flex rounded-md border border-border bg-card overflow-hidden text-[11px]">
            {([7, 14, 30, 60, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                className={cn(
                  "px-2 py-1 transition-colors",
                  windowDays === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        )}
        {!showPast && beyondCount > 0 && (
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            +{beyondCount} beyond
          </span>
        )}
        {pastCount > 0 && (
          <button
            type="button"
            onClick={() => setShowPast((s) => !s)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            {showPast ? "Hide past" : `Show past (${pastCount})`}
          </button>
        )}
      </div>

      <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[720px]">
            <thead className="bg-secondary/40">
              <tr className="border-b border-border">
                {["Date", "Event", "Time", "DJs · Genre · Promo", "Status", "Prep", ""].map((h, i) => (
                  <th
                    key={h || `col-${i}`}
                    className={cn(
                      "text-[10px] tracking-widest text-muted-foreground uppercase text-left py-2.5 px-3 font-semibold",
                      i === 6 && "w-[40px]",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const dt = new Date(row.iso + "T00:00:00")
                const daysUntil = differenceInDays(dt, new Date())
                const isToday = daysUntil === 0
                const isTomorrow = daysUntil === 1
                const isPast = daysUntil < 0
                const isSoon = daysUntil > 0 && daysUntil <= 2

                const djs = row.csv ? [row.csv.dj1, row.csv.dj2].filter(Boolean).join(" · ") : ""
                const time =
                  row.csv?.startTime && row.csv?.endTime
                    ? `${row.csv.startTime} – ${row.csv.endTime}`
                    : ""

                const headline = row.csv?.eventName || row.supa?.title || "Untitled"
                const subline = row.supa
                  ? row.supa.eventType.replace(/_/g, " ")
                  : row.csv && row.extra > 0
                  ? `+${row.extra} more`
                  : ""

                const clickable = !!row.supa

                const statusLabel = row.supa
                  ? mktStatusConfig[row.supa.marketingStatus ?? "not_started"]?.label
                  : isPast
                  ? "Past"
                  : isToday
                  ? "Tonight"
                  : isTomorrow
                  ? "Tomorrow"
                  : isSoon
                  ? "Soon"
                  : "Upcoming"
                const statusCls = row.supa
                  ? mktStatusConfig[row.supa.marketingStatus ?? "not_started"]?.cls
                  : isPast
                  ? "border-border bg-secondary text-muted-foreground"
                  : isToday
                  ? "border-primary/30 bg-primary/8 text-primary"
                  : isSoon || isTomorrow
                  ? "border-warning/25 bg-warning/8 text-warning"
                  : "border-success/25 bg-success/8 text-success"

                const checklist = row.supa?.checklist ?? []
                const done = checklist.filter((c) => c.done).length
                const total = checklist.length
                const progress = total > 0 ? Math.round((done / total) * 100) : 0

                const detailBits: string[] = []
                if (djs) detailBits.push(djs)
                if (row.csv?.genre) detailBits.push(row.csv.genre)
                if (row.csv?.promotion) detailBits.push(`Promo: ${row.csv.promotion}`)
                const detailStr = detailBits.join(" · ") || "—"

                return (
                  <tr
                    key={row.iso + (row.supa?.id ?? "")}
                    onClick={clickable ? () => onSelectEvent(row.supa!) : undefined}
                    className={cn(
                      "border-b border-border last:border-b-0 transition-colors relative",
                      isPast && "opacity-55",
                      isToday && "bg-primary/[0.04]",
                      clickable && "cursor-pointer hover:bg-secondary/50",
                      !clickable && "hover:bg-secondary/30",
                    )}
                  >
                    <td className="py-2.5 px-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        {isToday && <span className="w-[3px] self-stretch rounded-full bg-primary" />}
                        <div
                          className={cn(
                            "rounded-sm border px-2 py-1 text-center min-w-[42px]",
                            isToday
                              ? "border-primary bg-primary/10"
                              : "border-border bg-secondary/60",
                          )}
                        >
                          <div className="text-[9px] tracking-wider text-muted-foreground uppercase leading-none">
                            {format(dt, "MMM")}
                          </div>
                          <div
                            className={cn(
                              "font-display text-[18px] leading-none tracking-wide mt-0.5",
                              isToday ? "text-primary" : "text-foreground",
                            )}
                          >
                            {format(dt, "d")}
                          </div>
                        </div>
                        <div className="hidden md:block text-[10px] tracking-wider text-muted-foreground uppercase">
                          {format(dt, "EEE")}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 align-middle min-w-[180px]">
                      <div className="font-subheading text-sm font-semibold text-foreground leading-snug truncate max-w-[260px]">
                        {headline}
                      </div>
                      {subline && (
                        <div className="text-[10px] tracking-wider text-muted-foreground uppercase mt-0.5 truncate max-w-[260px]">
                          {subline}
                        </div>
                      )}
                      {row.supa?.location && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[260px]">
                          📍 {row.supa.location}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 align-middle text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {time || "—"}
                    </td>
                    <td className="py-2.5 px-3 align-middle text-xs text-foreground max-w-[280px]">
                      <span className="line-clamp-2">{detailStr}</span>
                    </td>
                    <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-block rounded-sm border px-[7px] py-[2px] text-[10px] tracking-wide uppercase",
                          statusCls,
                        )}
                      >
                        {statusLabel}
                      </span>
                      {!isPast && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {isToday ? "Today" : isTomorrow ? "Tomorrow" : `${daysUntil}d away`}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 align-middle min-w-[120px]">
                      {row.supa ? (
                        total > 0 ? (
                          <div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                              <span className="tabular-nums">
                                {done}/{total}
                              </span>
                              <span className="tabular-nums">{progress}%</span>
                            </div>
                            <div className="h-[3px] bg-accent rounded-sm overflow-hidden">
                              <div
                                className="h-full rounded-sm bg-gradient-to-r from-primary to-chart-2"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">No tasks</span>
                        )
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Not in CRM</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 align-middle text-right">
                      {clickable ? (
                        <span className="text-[11px] text-primary font-semibold whitespace-nowrap">
                          Manage →
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   LivePaidAdsPanel — reads ads_campaigns_daily
   Owner-focused: monthly Google Ads ROI at a glance
   ──────────────────────────────────────────────────────────── */

const PLATFORM_DISPLAY: Record<string, { label: string; accent: string; bar: string }> = {
  google_ads: {
    label: "Google Ads",
    accent: "from-[#4285f4] via-[#34a853] via-[#fbbc05] via-[#ea4335] to-transparent",
    bar: "from-[#4285f4] to-[#34a853]",
  },
  facebook_ads: {
    label: "Meta (FB / IG)",
    accent: "from-[#1877f2] to-transparent",
    bar: "from-[#1877f2] to-[#4285f4]",
  },
  tiktok_ads: {
    label: "TikTok",
    accent: "from-[#2a7a6e] via-[#69c9d0] to-transparent",
    bar: "from-[#2a7a6e] to-[#69c9d0]",
  },
}

type WindowDays = 7 | 30 | 90

const WINDOW_LABEL: Record<WindowDays, string> = {
  7: "Last 7 Days",
  30: "Last 30 Days",
  90: "Last 90 Days",
}

function formatVnd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B ₫`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ₫`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K ₫`
  return `${Math.round(value).toLocaleString("en-US")} ₫`
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)))
}

type Totals = { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }
const EMPTY_TOTALS: Totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }

function sumRows(rows: Array<Record<string, unknown>>): Totals {
  const t: Totals = { ...EMPTY_TOTALS }
  for (const r of rows) {
    t.spend += Number(r.spend || 0)
    t.impressions += Number(r.impressions || 0)
    t.clicks += Number(r.clicks || 0)
    t.conversions += Number(r.conversions || 0)
    t.revenue += Number(r.revenue || 0)
  }
  return t
}

function deltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function DeltaChip({
  value,
  invert = false,
}: {
  value: number | null
  /** If true, a decrease is good (e.g. cost/conversion). */
  invert?: boolean
}) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" />
        no prior data
      </span>
    )
  }
  const isUp = value > 0.5
  const isDown = value < -0.5
  const good = invert ? isDown : isUp
  const bad = invert ? isUp : isDown
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus
  const cls = good
    ? "text-success"
    : bad
    ? "text-error"
    : "text-muted-foreground"
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums", cls)}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function LivePaidAdsPanel({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { data: campaigns = [], isLoading } = useAdsCampaignPerformance()
  const { data: integrations = [] } = useMarketingIntegrations()

  const [windowDays, setWindowDays] = useState<WindowDays>(30)

  const { currentRows, previousRows, cutoffIso, prevCutoffIso, lastSyncIso } = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setUTCDate(cutoff.getUTCDate() - windowDays)
    const prevCutoff = new Date(cutoff)
    prevCutoff.setUTCDate(prevCutoff.getUTCDate() - windowDays)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const prevStr = prevCutoff.toISOString().slice(0, 10)

    const rows = campaigns as Array<Record<string, unknown>>
    const cur: Array<Record<string, unknown>> = []
    const prev: Array<Record<string, unknown>> = []
    let latestSync: string | null = null
    for (const r of rows) {
      const md = String(r.metric_date || "")
      if (md >= cutoffStr) cur.push(r)
      else if (md >= prevStr) prev.push(r)
      const synced = String(r.synced_at || "")
      if (synced && (!latestSync || synced > latestSync)) latestSync = synced
    }
    return {
      currentRows: cur,
      previousRows: prev,
      cutoffIso: cutoffStr,
      prevCutoffIso: prevStr,
      lastSyncIso: latestSync,
    }
  }, [campaigns, windowDays])

  const perPlatform = useMemo(() => {
    const map = new Map<string, Totals>()
    for (const c of currentRows) {
      const p = String(c.platform || "")
      const agg = map.get(p) ?? { ...EMPTY_TOTALS }
      agg.spend += Number(c.spend || 0)
      agg.impressions += Number(c.impressions || 0)
      agg.clicks += Number(c.clicks || 0)
      agg.conversions += Number(c.conversions || 0)
      agg.revenue += Number(c.revenue || 0)
      map.set(p, agg)
    }
    return map
  }, [currentRows])

  const topCampaigns = useMemo(() => {
    type CampAgg = { name: string; platform: string } & Totals
    const byKey = new Map<string, CampAgg>()
    for (const c of currentRows) {
      const key = `${c.platform}:${c.campaign_id}`
      const existing = byKey.get(key) ?? {
        name: String(c.campaign_name || "Campaign"),
        platform: String(c.platform || ""),
        ...EMPTY_TOTALS,
      }
      existing.spend += Number(c.spend || 0)
      existing.clicks += Number(c.clicks || 0)
      existing.impressions += Number(c.impressions || 0)
      existing.conversions += Number(c.conversions || 0)
      existing.revenue += Number(c.revenue || 0)
      byKey.set(key, existing)
    }
    return Array.from(byKey.values())
      .filter((c) => c.spend > 0 || c.impressions > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
  }, [currentRows])

  const cur = useMemo(() => sumRows(currentRows), [currentRows])
  const prev = useMemo(() => sumRows(previousRows), [previousRows])

  const ctr = cur.impressions > 0 ? (cur.clicks / cur.impressions) * 100 : 0
  const prevCtr = prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0
  const cpc = cur.clicks > 0 ? cur.spend / cur.clicks : 0
  const costPerConv = cur.conversions > 0 ? cur.spend / cur.conversions : 0
  const prevCostPerConv = prev.conversions > 0 ? prev.spend / prev.conversions : 0
  const roas = cur.spend > 0 ? cur.revenue / cur.spend : 0
  const prevRoas = prev.spend > 0 ? prev.revenue / prev.spend : 0

  const missingToken = integrations.filter((x) => x.is_active && !x.has_refresh_token).length
  const activeIntegrations = integrations.filter((x) => x.is_active).length
  const hasAnyData = currentRows.length > 0
  const hasPriorData = previousRows.length > 0
  const hasRevenue = cur.revenue > 0 || prev.revenue > 0
  const hasConversions = cur.conversions > 0 || prev.conversions > 0

  const lastSyncDays = daysAgo(lastSyncIso)
  const syncTone =
    lastSyncDays == null ? "muted" : lastSyncDays <= 1 ? "fresh" : lastSyncDays <= 7 ? "ok" : "stale"
  const syncLabel =
    lastSyncDays == null
      ? "No data imported yet"
      : lastSyncDays === 0
      ? "Updated today"
      : lastSyncDays === 1
      ? "Updated yesterday"
      : `Updated ${lastSyncDays} days ago`
  const syncToneCls =
    syncTone === "fresh"
      ? "border-success/25 bg-success/8 text-success"
      : syncTone === "ok"
      ? "border-warning/25 bg-warning/8 text-warning"
      : syncTone === "stale"
      ? "border-error/25 bg-error/10 text-error"
      : "border-border bg-secondary text-muted-foreground"

  return (
    <div className="space-y-3">
      {/* Header row with window selector + refresh CTA */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase whitespace-nowrap">
          Paid Ads · Owner View
        </div>
        <span className="rounded-sm px-2 py-0.5 text-xs tracking-wide bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
          {WINDOW_LABEL[windowDays]}
        </span>
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-1 rounded-sm border border-border bg-card p-0.5">
          {([7, 30, 90] as WindowDays[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowDays(w)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-semibold tracking-wide rounded-[3px] transition-colors",
                windowDays === w
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              {w}d
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onNavigate("/marketing/integrations")}
          className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/15 flex items-center gap-1.5 whitespace-nowrap"
        >
          <Upload className="h-3.5 w-3.5" />
          Paste new 30-day export
        </button>
      </div>

      {!hasAnyData ? (
        <div className="rounded-card border border-border bg-card p-6 shadow-card space-y-3 text-sm">
          {isLoading ? (
            <div className="text-muted-foreground">Loading campaign metrics…</div>
          ) : activeIntegrations === 0 ? (
            <div className="space-y-2">
              <div className="font-semibold text-foreground">No ad platforms connected yet.</div>
              <p className="text-muted-foreground">
                Open Integrations, register a Google Ads account, then paste your last-30-days campaign CSV.
                Numbers land here instantly — no OAuth, no approvals, no fees.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("/marketing/integrations")}
                className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
              >
                Open Integrations →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="font-semibold text-foreground">
                No campaign data in the {WINDOW_LABEL[windowDays].toLowerCase()} yet.
              </div>
              <p className="text-muted-foreground">
                Paste your most recent 30-day Google Ads export from Integrations. This view is designed around a
                weekly-paste rhythm — drop the fresh CSV every Monday and this panel shows the full monthly picture.
              </p>
              {missingToken > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Note: {missingToken} account is missing a refresh token — that only blocks automated API sync, CSV
                  uploads still work.
                </p>
              )}
              <button
                type="button"
                onClick={() => onNavigate("/marketing/integrations")}
                className="rounded-sm border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground flex items-center gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Paste campaign CSV
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Hero KPI card: ROI at a glance */}
          <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
            {/* Top strip with freshness + context */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-border bg-secondary/30">
              <span className={cn("rounded-sm border px-2 py-0.5 text-[10px] tracking-wide uppercase font-semibold flex items-center gap-1", syncToneCls)}>
                <RefreshCcw className="h-3 w-3" />
                {syncLabel}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {cutoffIso} → today · {currentRows.length} campaign-day rows
              </span>
              {syncTone === "stale" && (
                <span className="text-[11px] text-error font-semibold">
                  Time to paste a fresh export
                </span>
              )}
              <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                vs prior {windowDays}d ({prevCutoffIso})
                {!hasPriorData && <span className="italic">no data yet</span>}
              </div>
            </div>

            {/* Hero KPIs */}
            <div
              className={cn(
                "grid grid-cols-2 divide-y divide-x divide-border",
                hasRevenue ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-3 lg:grid-cols-5",
              )}
            >
              <KpiCell
                label="Spend"
                hero={formatVnd(cur.spend)}
                delta={deltaPct(cur.spend, prev.spend)}
                invert
                sublabel={`${formatVnd(cur.spend / windowDays)} / day avg`}
              />
              {hasConversions ? (
                <>
                  <KpiCell
                    label="Conversions"
                    hero={formatNumber(cur.conversions)}
                    delta={deltaPct(cur.conversions, prev.conversions)}
                    sublabel={`${(cur.clicks > 0 ? (cur.conversions / cur.clicks) * 100 : 0).toFixed(2)}% conv. rate`}
                  />
                  <KpiCell
                    label="Cost / Conv."
                    hero={costPerConv > 0 ? formatVnd(costPerConv) : "—"}
                    delta={deltaPct(costPerConv, prevCostPerConv)}
                    invert
                    sublabel="Lower is better"
                  />
                </>
              ) : (
                <KpiCell
                  label="Conversions"
                  hero="0"
                  delta={null}
                  sublabel="Add conversions tracking in Ads"
                />
              )}
              <KpiCell
                label="Clicks"
                hero={formatNumber(cur.clicks)}
                delta={deltaPct(cur.clicks, prev.clicks)}
                sublabel={`${formatNumber(cur.impressions)} impressions`}
              />
              <KpiCell
                label="CTR"
                hero={`${ctr.toFixed(2)}%`}
                delta={deltaPct(ctr, prevCtr)}
                sublabel={`CPC ${cpc > 0 ? formatVnd(cpc) : "—"}`}
              />
              {hasRevenue && (
                <KpiCell
                  label="ROAS"
                  hero={roas > 0 ? `${roas.toFixed(2)}×` : "—"}
                  delta={deltaPct(roas, prevRoas)}
                  sublabel={`Revenue ${formatVnd(cur.revenue)}`}
                />
              )}
            </div>
          </div>

          {/* Per-platform breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {Array.from(perPlatform.entries()).map(([platformKey, agg]) => {
              const meta =
                PLATFORM_DISPLAY[platformKey] ?? {
                  label: platformKey,
                  accent: "from-primary to-transparent",
                  bar: "from-primary to-primary/60",
                }
              const platCtr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0
              const platCpc = agg.clicks > 0 ? agg.spend / agg.clicks : 0
              const platCostConv = agg.conversions > 0 ? agg.spend / agg.conversions : 0
              const shareWidth = cur.spend > 0 ? Math.round((agg.spend / cur.spend) * 100) : 0
              return (
                <div key={platformKey} className="relative overflow-hidden rounded-card border border-border bg-card p-[18px_20px] shadow-card">
                  <div className={cn("absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r", meta.accent)} />
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs tracking-widest text-foreground uppercase">{meta.label}</div>
                    <div className="text-[10px] text-muted-foreground">{shareWidth}% of spend</div>
                  </div>
                  <div className="h-[2px] bg-accent rounded-sm overflow-hidden mb-2">
                    <div className={cn("h-full rounded-sm bg-gradient-to-r", meta.bar)} style={{ width: `${shareWidth}%` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-3 mb-2">
                    <div>
                      <div className="text-[10px] tracking-wider text-muted-foreground uppercase">Spend</div>
                      <div className="text-sm font-semibold text-foreground tabular-nums">{formatVnd(agg.spend)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] tracking-wider text-muted-foreground uppercase">Cost / Conv.</div>
                      <div className="text-sm font-semibold text-foreground tabular-nums">
                        {platCostConv > 0 ? formatVnd(platCostConv) : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-border pt-2">
                    {[
                      { val: formatNumber(agg.clicks), label: "Clicks" },
                      { val: `${platCtr.toFixed(2)}%`, label: "CTR" },
                      { val: platCpc > 0 ? formatVnd(platCpc) : "—", label: "CPC" },
                    ].map((k) => (
                      <div key={k.label} className="text-center">
                        <div className="text-[13px] font-semibold text-foreground leading-none tabular-nums">{k.val}</div>
                        <div className="text-[9px] tracking-wide text-muted-foreground uppercase mt-1">{k.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Top campaigns */}
          {topCampaigns.length > 0 && (
            <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-[18px] py-3 border-b border-border bg-secondary/30">
                <div className="text-xs tracking-widest text-foreground uppercase">
                  Top Campaigns — {WINDOW_LABEL[windowDays]}
                </div>
                <div className="text-[10px] text-muted-foreground">Ranked by spend</div>
              </div>
              <div className="divide-y divide-border">
                {topCampaigns.map((c) => {
                  const campCtr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
                  const campCostConv = c.conversions > 0 ? c.spend / c.conversions : 0
                  const spendShare = cur.spend > 0 ? (c.spend / cur.spend) * 100 : 0
                  return (
                    <div key={`${c.platform}:${c.name}`} className="px-[18px] py-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{c.name || "Untitled campaign"}</div>
                          <div className="text-[10px] tracking-wider text-muted-foreground uppercase mt-0.5">
                            {PLATFORM_DISPLAY[c.platform]?.label ?? c.platform} · {spendShare.toFixed(0)}% of spend
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold text-foreground tabular-nums">{formatVnd(c.spend)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {c.conversions > 0 ? `${formatNumber(c.conversions)} conv.` : "0 conv."}
                          </div>
                        </div>
                      </div>
                      <div className="h-[2px] bg-accent rounded-sm overflow-hidden mb-2">
                        <div
                          className="h-full rounded-sm bg-gradient-to-r from-primary to-chart-2"
                          style={{ width: `${Math.min(100, spendShare)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { val: formatNumber(c.impressions), label: "Impr." },
                          { val: formatNumber(c.clicks), label: "Clicks" },
                          { val: `${campCtr.toFixed(2)}%`, label: "CTR" },
                          { val: campCostConv > 0 ? formatVnd(campCostConv) : "—", label: "Cost / Conv." },
                        ].map((k) => (
                          <div key={k.label}>
                            <div className="text-[11px] font-semibold text-foreground tabular-nums">{k.val}</div>
                            <div className="text-[9px] tracking-wide text-muted-foreground uppercase mt-0.5">{k.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KpiCell({
  label,
  hero,
  delta,
  sublabel,
  invert = false,
}: {
  label: string
  hero: string
  delta: number | null
  sublabel?: string
  invert?: boolean
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">{label}</div>
      <div className="font-display text-[26px] leading-none tracking-[1.5px] text-foreground mt-1.5 tabular-nums">
        {hero}
      </div>
      <div className="flex items-center gap-2 mt-1.5 min-h-[14px]">
        <DeltaChip value={delta} invert={invert} />
        {sublabel && <span className="text-[10px] text-muted-foreground truncate">{sublabel}</span>}
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

          {/* Attachments (EOFs, Partner Agreements, riders, menus, etc.) */}
          <EventAttachmentsSection eventId={event.id} />
        </div>
      </div>
    </>
  )
}

function EventAttachmentsSection({ eventId }: { eventId: string }) {
  const { data: attachments = [], isLoading } = useEventAttachments(eventId)
  const upload = useUploadEventAttachment(eventId)
  const remove = useDeleteEventAttachment(eventId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingLabel, setPendingLabel] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || !eventId) return
    setErrorMsg(null)
    const list = Array.from(files)
    for (const file of list) {
      try {
        await upload.mutateAsync({ file, label: pendingLabel || undefined })
      } catch (e: any) {
        const raw = e?.message || "Upload failed"
        const msg = /maximum allowed size/i.test(raw)
          ? `${file.name} exceeds the 100 MB per-file limit.`
          : raw
        setErrorMsg(msg)
        return
      }
    }
    setPendingLabel("")
  }

  async function openAttachment(path: string) {
    const { data, error } = await getEventAttachmentSignedUrl(path)
    if (error || !data?.signedUrl) {
      setErrorMsg("Couldn't open file. Please try again.")
      return
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  function bytesLabel(b: number | null) {
    if (!b) return ""
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
    return `${(b / 1024 / 1024).toFixed(1)} MB`
  }

  function fileTone(name: string, mime: string | null) {
    const lower = (mime || "").toLowerCase()
    const n = name.toLowerCase()
    if (lower.includes("pdf") || n.endsWith(".pdf")) {
      return { label: "PDF", tone: "text-[#b5620a]", bg: "bg-[#fdf3e7]", border: "border-[#f5d4ba]" }
    }
    if (lower.startsWith("image") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(n)) {
      return { label: "IMG", tone: "text-[#5a3a8a]", bg: "bg-[#ede8f5]", border: "border-[#d4c9e8]" }
    }
    if (/\.(docx?|pages)$/i.test(n)) {
      return { label: "DOC", tone: "text-info", bg: "bg-info/10", border: "border-info/25" }
    }
    if (/\.(xlsx?|numbers|csv)$/i.test(n)) {
      return { label: "XLS", tone: "text-success", bg: "bg-success/10", border: "border-success/25" }
    }
    return { label: "FILE", tone: "text-muted-foreground", bg: "bg-secondary/60", border: "border-border" }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs tracking-wider text-muted-foreground uppercase">
          Attachments <span className="text-muted-foreground/60">· EOFs, Partner Agreements, Riders</span>
        </div>
        {attachments.length > 0 && (
          <div className="text-xs text-muted-foreground">{attachments.length}</div>
        )}
      </div>

      {/* Dropzone / picker */}
      <div
        className={cn(
          "rounded-sm border-2 border-dashed p-3 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border bg-secondary/30",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={pendingLabel}
            onChange={(e) => setPendingLabel(e.target.value)}
            placeholder="Optional label (e.g. EOF, Partner Agreement, Rider)"
            className="w-full rounded-sm border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.csv,.pages,.numbers,.key,.pptx"
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
              className="flex-1 rounded-sm border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-60"
            >
              {upload.isPending ? "Uploading…" : "Choose file or drop PDF here"}
            </button>
          </div>
          <div className="text-[10px] text-muted-foreground">
            PDF, DOCX, images, slides. Up to 100&nbsp;MB per file. Only marketing managers + owners can see these.
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-2 rounded-sm border border-error/25 bg-error/8 px-3 py-1.5 text-[11px] text-error">
          {errorMsg}
        </div>
      )}

      {/* List */}
      <div className="mt-3 space-y-1.5">
        {isLoading && <div className="text-xs text-muted-foreground italic">Loading attachments…</div>}
        {!isLoading && attachments.length === 0 && (
          <div className="text-xs text-muted-foreground italic">
            No attachments yet. Drop the EOF or partner agreement above.
          </div>
        )}
        {attachments.map((a) => {
          const t = fileTone(a.file_name, a.mime_type)
          return (
            <div
              key={a.id}
              className="group flex items-center gap-2 rounded-sm border border-border bg-card px-2 py-1.5"
            >
              <div
                className={cn(
                  "shrink-0 w-8 h-8 rounded-sm border flex items-center justify-center text-[10px] font-bold tracking-wide",
                  t.bg,
                  t.border,
                  t.tone,
                )}
              >
                {t.label}
              </div>
              <button
                type="button"
                onClick={() => openAttachment(a.file_path)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {a.label ? `${a.label} — ${a.file_name}` : a.file_name}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {format(new Date(a.created_at), "MMM d, yyyy")}
                  {a.size_bytes ? ` · ${bytesLabel(a.size_bytes)}` : ""}
                </div>
              </button>
              <button
                type="button"
                onClick={() => openAttachment(a.file_path)}
                className="shrink-0 text-[10px] text-primary font-semibold px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove ${a.file_name}?`)) {
                    remove.mutate({ id: a.id, file_path: a.file_path })
                  }
                }}
                disabled={remove.isPending}
                className="shrink-0 text-[11px] text-muted-foreground hover:text-error px-1.5 py-0.5 leading-none opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
