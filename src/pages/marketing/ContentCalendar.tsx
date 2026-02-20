import { useEffect, useMemo, useState } from "react"
import { addDays, format, isSameDay, startOfMonth, startOfWeek } from "date-fns"
import { useLocation, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { useContentCalendar, type ContentPost } from "@/hooks/useContentCalendar"
import { useGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync"

type ViewMode = "monthly" | "weekly"
type PillarKey = "all" | "events_djs" | "atmosphere" | "drinks" | "community" | "reels" | "announcements" | "holidays"

const PILLARS: Record<Exclude<PillarKey, "all">, { label: string; color: string; dimBg: string; dimBorder: string }> = {
  events_djs: {
    label: "Events and DJs",
    color: "#c47c2a",
    dimBg: "rgba(196,124,42,0.10)",
    dimBorder: "rgba(196,124,42,0.20)",
  },
  atmosphere: {
    label: "Atmosphere & Rooftop Vibes",
    color: "#4a9e6b",
    dimBg: "rgba(74,158,107,0.10)",
    dimBorder: "rgba(74,158,107,0.20)",
  },
  drinks: {
    label: "Drinks, Shisha & Experience",
    color: "#e8b84b",
    dimBg: "rgba(232,184,75,0.12)",
    dimBorder: "rgba(232,184,75,0.25)",
  },
  community: {
    label: "Community & Guests",
    color: "#5b9bd5",
    dimBg: "rgba(91,155,213,0.10)",
    dimBorder: "rgba(91,155,213,0.20)",
  },
  reels: {
    label: "Reels/Trends",
    color: "#9b72cf",
    dimBg: "rgba(155,114,207,0.10)",
    dimBorder: "rgba(155,114,207,0.20)",
  },
  announcements: {
    label: "Announcements & Promos",
    color: "#7a4b2e",
    dimBg: "rgba(122,75,46,0.10)",
    dimBorder: "rgba(122,75,46,0.20)",
  },
  holidays: {
    label: "Vietnamese Holidays",
    color: "#c0392b",
    dimBg: "rgba(192,57,43,0.10)",
    dimBorder: "rgba(192,57,43,0.20)",
  },
}

const HOURS = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
] as const

function stripNoteField(notes: string | null | undefined, key: string) {
  const n = (notes || "").trim()
  if (!n) return ""
  const lines = n.split("\n")
  return lines.filter((l) => !l.toLowerCase().startsWith(`${key.toLowerCase()}:`)).join("\n").trim()
}

function getNoteField(notes: string | null | undefined, key: string) {
  const n = (notes || "").trim()
  if (!n) return ""
  const line = n
    .split("\n")
    .find((l) => l.toLowerCase().startsWith(`${key.toLowerCase()}:`))
  return line ? line.split(":").slice(1).join(":").trim() : ""
}

function upsertNoteField(notes: string | null | undefined, key: string, value: string) {
  const cleaned = stripNoteField(notes, key)
  const next = [`${key}:${value}`.trim(), cleaned].filter(Boolean).join("\n").trim()
  return next || null
}

function normalizeTime(time: string | null) {
  if (!time) return ""
  // Accepts 'HH:mm' or 'HH:mm:ss'
  return time.slice(0, 5)
}

function toIsoDate(d: Date) {
  return format(d, "yyyy-MM-dd")
}

const PILLAR_KEYS = Object.keys(PILLARS) as Array<Exclude<PillarKey, "all">>

function pillarForPost(post: ContentPost): Exclude<PillarKey, "all"> {
  const fromNotes = getNoteField(post.notes, "pillar")?.trim().toLowerCase()
  if (fromNotes && PILLAR_KEYS.includes(fromNotes as any)) return fromNotes as Exclude<PillarKey, "all">
  return "events_djs"
}

function statusLabel(status: ContentPost["status"]) {
  if (status === "scheduled") return "Scheduled"
  if (status === "cancelled") return "Cancelled"
  if (status === "published") return "Approved"
  return "Pending"
}

function statusClass(status: ContentPost["status"]) {
  if (status === "scheduled") return "st-scheduled"
  if (status === "cancelled") return "st-cancelled"
  if (status === "published") return "st-approved"
  return "st-pending"
}

function channelsForPost(post: ContentPost): Array<"ig" | "fb" | "tiktok"> {
  if (post.platform === "all") return ["ig", "fb", "tiktok"]
  if (post.platform === "instagram") return ["ig"]
  if (post.platform === "facebook") return ["fb"]
  return ["tiktok"]
}


function postTitle(post: ContentPost) {
  const fromNotes = getNoteField(post.notes, "title")
  if (fromNotes) return fromNotes
  if (post.caption) return post.caption.split("\n")[0].slice(0, 48)
  return "New post"
}

function postThumb(post: ContentPost) {
  const t = (post.content_type || "post").toLowerCase()
  if (t === "story") return "📱"
  if (t === "reel") return "🎞️"
  if (t === "video") return "🎬"
  if (t === "carousel") return "🗂️"
  return "🖼️"
}

export default function ContentCalendar() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { posts, isLoading, createPost, updatePost, deletePost } = useContentCalendar()

  const [view, setView] = useState<ViewMode>("monthly")
  const [cursor, setCursor] = useState<Date>(() => new Date())
  const [pillarFilter, _setPillarFilter] = useState<PillarKey>("all")

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<ContentPost | null>(null)

  const [fTitle, setFTitle] = useState("")
  const [fScheduledDate, setFScheduledDate] = useState("")
  const [fScheduledTime, setFScheduledTime] = useState("18:00")
  const [fPillar, setFPillar] = useState<Exclude<PillarKey, "all">>("events_djs")
  const [fPlatform, setFPlatform] = useState<ContentPost["platform"]>("all")
  const [fContentType, setFContentType] = useState<NonNullable<ContentPost["content_type"]>>("post")
  const [fCaption, setFCaption] = useState("")
  const [fMediaUrl, setFMediaUrl] = useState("")
  const [fStatus, setFStatus] = useState<ContentPost["status"]>("draft")
  const [overviewTab, setOverviewTab] = useState<"kanban" | "list">("kanban")

  // ── List filters ──────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus]   = useState<"all" | ContentPost["status"]>("all")
  const [filterMonth, setFilterMonth]     = useState<"all" | string>("all")
  const [filterPillar, setFilterPillar]   = useState<PillarKey>("all")
  const [filterFormat, setFilterFormat]   = useState<"all" | string>("all")

  const today = useMemo(() => new Date(), [])

  // ── Google Sheets sync ──────────────────────────────────────────────────────
  const { sync, isSyncing, lastSynced, lastResult, error: syncError } = useGoogleSheetsSync()
  const [syncBannerDismissed, setSyncBannerDismissed] = useState(false)

  // Auto-sync once on mount; cancelled flag guards against StrictMode double-invoke
  useEffect(() => {
    let cancelled = false
    sync().then(() => {
      if (!cancelled) queryClient.invalidateQueries({ queryKey: ["content_calendar"] })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (pillarFilter !== "all" && pillarForPost(p) !== pillarFilter) return false
      if (filterStatus !== "all" && p.status !== filterStatus) return false
      if (filterMonth !== "all" && !p.scheduled_date.startsWith(filterMonth)) return false
      if (filterPillar !== "all" && pillarForPost(p) !== filterPillar) return false
      if (filterFormat !== "all" && (p.content_type || "post") !== filterFormat) return false
      return true
    })
  }, [posts, pillarFilter, filterStatus, filterMonth, filterPillar, filterFormat])

  const postsByDate = useMemo(() => {
    const grouped = new Map<string, ContentPost[]>()
    for (const p of filteredPosts) {
      const key = p.scheduled_date
      const existing = grouped.get(key) || []
      existing.push(p)
      grouped.set(key, existing)
    }
    // stable sort inside date
    for (const [k, arr] of grouped) {
      arr.sort((a, b) => normalizeTime(a.scheduled_time).localeCompare(normalizeTime(b.scheduled_time)))
      grouped.set(k, arr)
    }
    return grouped
  }, [filteredPosts])

  const openPostModal = (post?: ContentPost, date?: Date) => {
    if (post) {
      setEditingPost(post)
      setFTitle(getNoteField(post.notes, "title") || postTitle(post))
      setFScheduledDate(post.scheduled_date)
      setFScheduledTime(normalizeTime(post.scheduled_time) || "18:00")
      setFPillar(pillarForPost(post))
      setFPlatform(post.platform)
      setFContentType((post.content_type || "post") as any)
      setFCaption(post.caption || "")
      setFMediaUrl(post.media_url || "")
      setFStatus(post.status)
    } else {
      setEditingPost(null)
      setFTitle("")
      setFScheduledDate(date ? toIsoDate(date) : "")
      setFScheduledTime("18:00")
      setFPillar("events_djs")
      setFPlatform("all")
      setFContentType("post")
      setFCaption("")
      setFMediaUrl("")
      setFStatus("draft")
    }
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!fScheduledDate) return

    const baseNotes = editingPost?.notes ?? null
    const withPillar = upsertNoteField(baseNotes, "pillar", fPillar)
    const withTitle = upsertNoteField(withPillar, "title", fTitle.trim() || "New post")

    const payload: Partial<ContentPost> = {
      scheduled_date: fScheduledDate,
      scheduled_time: fScheduledTime ? `${fScheduledTime}:00` : null,
      platform: fPlatform,
      content_type: fContentType,
      caption: fCaption.trim() || null,
      media_url: fMediaUrl.trim() || null,
      status: fStatus,
      notes: withTitle,
    }

    if (editingPost) {
      await updatePost.mutateAsync({ id: editingPost.id, ...payload })
    } else {
      await createPost.mutateAsync(payload)
    }

    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (!editingPost) return
    if (!confirm("Delete this post?")) return
    await deletePost.mutateAsync(editingPost.id)
    setModalOpen(false)
  }

  const isActive = (path: string) => location.pathname === path

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor])
  const monthGridStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 1 }), [monthStart])
  const monthDays = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i)), [monthGridStart])

  const weekStart = useMemo(() => startOfWeek(cursor, { weekStartsOn: 1 }), [cursor])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Post overview grouping (matches screenshot columns)
  const postOverview = useMemo(() => {
    const isoToday = toIsoDate(new Date())
    const toBeApproved = filteredPosts.filter((p) => p.status === "draft")
    const approved = filteredPosts.filter((p) => p.status === "published" && p.scheduled_date >= isoToday)
    const scheduled = filteredPosts.filter((p) => p.status === "scheduled")
    const posted = filteredPosts.filter((p) => p.status === "published" && p.scheduled_date < isoToday)
    return { toBeApproved, approved, scheduled, posted }
  }, [filteredPosts])

  const awaitingCount = postOverview.toBeApproved.length

  return (
    <div className="w-full rounded-card overflow-hidden border border-border bg-background shadow-card">
      {/* HEADER (inside page, like reference) */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/97 backdrop-blur-[12px] shadow-card">
        <div className="px-4 md:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="leading-none">
              <div className="font-display text-[18px] tracking-[4px] text-primary uppercase">The Roof</div>
              <div className="text-sm tracking-wider text-secondary-foreground mt-[1px]">
                Da Nang · Club &amp; Lounge
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-secondary-foreground tracking-[1px]">
              <button
                type="button"
                className="hover:text-primary transition-colors"
                onClick={() => navigate("/owner/dashboard")}
              >
                ← Executive
              </button>
              <span className="text-border/80">/</span>
              <button
                type="button"
                className="hover:text-primary transition-colors"
                onClick={() => navigate("/marketing/dashboard")}
              >
                Marketing
              </button>
              <span className="text-border/80">/</span>
              <span className="text-foreground">Content Calendar</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/owner/dashboard")}
              className={cn(
                "text-xs tracking-wider uppercase px-3.5 py-[5px] rounded-sm border border-border text-secondary-foreground transition-colors",
                "hover:border-border/80 hover:text-foreground",
                isActive("/owner/dashboard") && "bg-primary/10 border-primary/25 text-primary",
              )}
            >
              Executive
            </button>
            <button
              type="button"
              onClick={() => navigate("/marketing/dashboard")}
              className={cn(
                "text-xs tracking-wider uppercase px-3.5 py-[5px] rounded-sm border border-border text-secondary-foreground transition-colors",
                "hover:border-border/80 hover:text-foreground",
              )}
            >
              Marketing
            </button>
            <button
              type="button"
              className={cn(
                "text-xs tracking-wider uppercase px-3.5 py-[5px] rounded-sm border transition-colors",
                "bg-primary/10 border-primary/25 text-primary",
              )}
            >
              Content
            </button>
            <button
              type="button"
              className="text-xs tracking-wider uppercase px-3.5 py-[5px] rounded-sm border border-border text-secondary-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              Operations
            </button>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="border-t border-border bg-card">
          <div className="px-4 md:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* period nav */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCursor((d) => (view === "monthly" ? addDays(d, -30) : addDays(d, -7)))}
                  className="w-7 h-7 rounded-sm border border-border bg-transparent text-secondary-foreground text-sm hover:text-primary hover:border-border/80 transition-colors"
                >
                  ←
                </button>
                <div className="font-subheading text-[20px] font-light italic text-foreground min-w-[180px]">
                  {view === "monthly"
                    ? format(cursor, "MMMM yyyy")
                    : `${format(weekStart, "MMMM d")} – ${format(addDays(weekStart, 6), "d, yyyy")}`}
                </div>
                <button
                  type="button"
                  onClick={() => setCursor((d) => (view === "monthly" ? addDays(d, 30) : addDays(d, 7)))}
                  className="w-7 h-7 rounded-sm border border-border bg-transparent text-secondary-foreground text-sm hover:text-primary hover:border-border/80 transition-colors"
                >
                  →
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCursor(new Date())}
                className="text-xs tracking-wider uppercase px-3 py-[5px] rounded-sm border border-border bg-transparent text-secondary-foreground hover:text-foreground hover:border-border/80 transition-colors"
              >
                Today
              </button>

            </div>

            <div className="flex items-center gap-2.5">
              {/* Sync status badge */}
              {lastSynced && !isSyncing && (
                <div className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-sm border border-success/25 bg-success/8 text-[10px] text-success tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                  Synced {format(lastSynced, "HH:mm")}
                  {lastResult && ` · ${lastResult.upserted} rows`}
                </div>
              )}
              {isSyncing && (
                <div className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-sm border border-warning/25 bg-warning/8 text-[10px] text-warning tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 animate-pulse" />
                  Syncing…
                </div>
              )}

              {/* Sync button */}
              <button
                type="button"
                onClick={() => { setSyncBannerDismissed(false); sync().then(() => queryClient.invalidateQueries({ queryKey: ["content_calendar"] })) }}
                disabled={isSyncing}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-[5px] rounded-sm border text-xs tracking-wider uppercase transition-colors",
                  isSyncing
                    ? "border-border text-muted-foreground cursor-not-allowed"
                    : "border-border text-secondary-foreground hover:text-foreground hover:border-border/80",
                )}
                title="Sync from Google Sheets"
              >
                <svg className={cn("w-3 h-3", isSyncing && "animate-spin")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13.5 2.5A6.5 6.5 0 1 1 8 1.5" strokeLinecap="round"/>
                  <path d="M13.5 2.5V6h-3.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sync Sheets
              </button>

              {/* view toggle */}
              <div className="flex overflow-hidden rounded-sm border border-border bg-secondary">
                <button
                  type="button"
                  onClick={() => setView("monthly")}
                  className={cn(
                    "px-3.5 py-[5px] text-xs tracking-wider uppercase",
                    view === "monthly" ? "bg-card text-primary shadow-card" : "text-muted-foreground",
                  )}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setView("weekly")}
                  className={cn(
                    "px-3.5 py-[5px] text-xs tracking-wider uppercase",
                    view === "weekly" ? "bg-card text-primary shadow-card" : "text-muted-foreground",
                  )}
                >
                  Week
                </button>
              </div>

              <button
                type="button"
                onClick={() => openPostModal()}
                className="px-4 py-[7px] rounded-sm bg-primary text-card text-xs tracking-wider uppercase hover:brightness-95 transition-all"
              >
                + Create post
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sync error banner */}
      {syncError && !syncBannerDismissed && (
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-2.5 bg-error/8 border-b border-error/20 text-xs text-error">
          <span>
            <strong>Google Sheets sync failed:</strong> {syncError}
          </span>
          <button
            type="button"
            onClick={() => setSyncBannerDismissed(true)}
            className="shrink-0 text-error/60 hover:text-error transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sync partial errors (some rows failed) */}
      {lastResult && lastResult.errors.length > 0 && !syncBannerDismissed && (
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-2 bg-warning/8 border-b border-warning/20 text-xs text-warning">
          <span>
            Sync completed with {lastResult.errors.length} row error(s). {lastResult.upserted} rows imported successfully.
          </span>
          <button type="button" onClick={() => setSyncBannerDismissed(true)} className="shrink-0 text-warning/60 hover:text-warning">✕</button>
        </div>
      )}

      {/* MAIN */}
      <div className="flex flex-col">
        {/* Calendar views */}
        <div className="min-h-[400px] overflow-x-auto">
          {isLoading ? (
            <div className="py-16 text-center text-xs tracking-wider text-muted-foreground uppercase">
              Loading…
            </div>
          ) : null}
          {view === "monthly" ? (
            <div className="flex flex-col min-w-[600px]">
              {/* Month header row */}
              <div className="grid grid-cols-7 border-b border-border bg-secondary">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div
                    key={d}
                    className="py-2 px-3 text-center text-xs tracking-widest text-muted-foreground uppercase border-r border-border last:border-r-0"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Month body */}
              <div className="grid grid-rows-6">
                {Array.from({ length: 6 }, (_, w) => (
                  <div key={w} className="grid grid-cols-7 border-b border-border last:border-b-0">
                    {monthDays.slice(w * 7, w * 7 + 7).map((day) => {
                      const iso = toIsoDate(day)
                      const inMonth = day.getMonth() === monthStart.getMonth()
                      const isToday = isSameDay(day, today)
                      const dayPosts = postsByDate.get(iso) || []
                      const show = dayPosts.slice(0, 3)
                      const more = dayPosts.length - show.length

                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => openPostModal(undefined, day)}
                          className={cn(
                            "text-left border-r border-border last:border-r-0 p-2 min-h-[120px] relative overflow-hidden",
                            "hover:bg-primary/[0.02] transition-colors",
                            !inMonth && "bg-foreground/[0.015]",
                            isToday && "bg-primary/[0.04]",
                          )}
                        >
                          <div
                            className={cn(
                              "font-display text-base leading-none mb-1.5 inline-flex",
                              inMonth ? "text-muted-foreground" : "text-border/80",
                              isToday && "text-primary bg-primary/10 w-6 h-6 rounded-full items-center justify-center text-[13px]",
                            )}
                          >
                            {format(day, "d")}
                          </div>

                          {show.map((p) => {
                            const pillar = pillarForPost(p)
                            const time = normalizeTime(p.scheduled_time) || "—"
                            return (
                              <div
                                key={p.id}
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  openPostModal(p)
                                }}
                                className="flex items-center gap-1.5 px-1.5 py-1 rounded-sm mb-[3px] border"
                                style={{
                                  background: PILLARS[pillar].dimBg,
                                  color: PILLARS[pillar].color,
                                  borderColor: PILLARS[pillar].dimBorder,
                                }}
                              >
                                <span
                                  className="w-[5px] h-[5px] rounded-full shrink-0"
                                  style={{ background: PILLARS[pillar].color }}
                                />
                                <span className="text-xs text-muted-foreground shrink-0">{time}</span>
                                <span className="text-xs truncate">{postTitle(p)}</span>
                              </div>
                            )
                          })}
                          {more > 0 ? (
                            <div className="text-xs tracking-wide text-muted-foreground hover:text-primary">
                              +{more} more
                            </div>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col min-w-[700px]">
              {/* Week header row */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border bg-secondary">
                <div className="border-r border-border" />
                {weekDays.map((d) => {
                  const isToday = isSameDay(d, today)
                  return (
                    <div
                      key={toIsoDate(d)}
                      className={cn("py-2.5 px-3 text-center border-r border-border last:border-r-0", isToday && "bg-primary/[0.03]")}
                    >
                      <div className="text-xs tracking-widest text-muted-foreground uppercase">{format(d, "EEE")}</div>
                      <div className={cn("font-display text-[22px] leading-none mt-0.5", isToday ? "text-primary" : "text-foreground")}>
                        {format(d, "d")}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* All-day strip */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border bg-secondary/40">
                <div className="border-r border-border px-2 py-1.5 flex items-center justify-end">
                  <span className="text-[9px] tracking-widest text-muted-foreground uppercase">All day</span>
                </div>
                {weekDays.map((d) => {
                  const iso = toIsoDate(d)
                  const allDay = (postsByDate.get(iso) || []).filter((p) => !normalizeTime(p.scheduled_time))
                  return (
                    <div key={iso} className="border-r border-border last:border-r-0 p-1 min-h-[36px] flex flex-col gap-0.5">
                      {allDay.map((p) => {
                        const pillar = pillarForPost(p)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => openPostModal(p)}
                            className="w-full text-left rounded-sm px-1.5 py-0.5 text-[10px] truncate border transition-colors hover:brightness-95"
                            style={{ background: PILLARS[pillar].dimBg, borderColor: PILLARS[pillar].dimBorder, color: PILLARS[pillar].color }}
                          >
                            {postTitle(p)}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Week body */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
                {/* time gutter */}
                <div className="border-r border-border">
                  {HOURS.map((h) => (
                    <div key={h} className="h-14 px-2 py-1 border-b border-border flex items-start justify-end">
                      <span className="text-[10px] tracking-wide text-muted-foreground">{h}</span>
                    </div>
                  ))}
                </div>

                {/* day columns */}
                {weekDays.map((d) => {
                  const iso = toIsoDate(d)
                  const timedPosts = (postsByDate.get(iso) || []).filter((p) => normalizeTime(p.scheduled_time))
                  return (
                    <div key={iso} className="relative border-r border-border last:border-r-0">
                      {HOURS.map((h) => (
                        <div key={h} className="h-14 border-b border-border hover:bg-primary/[0.015] transition-colors" />
                      ))}

                      {timedPosts.map((p) => {
                        const t = normalizeTime(p.scheduled_time)
                        const [hh, mm] = t.split(":").map((x) => Number(x))
                        const hourIndex = HOURS.findIndex((x) => Number(x.slice(0, 2)) === hh)
                        const top = hourIndex * 56 + (mm / 60) * 56 + 2

                        const pillar = pillarForPost(p)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => openPostModal(p)}
                            className="absolute left-1 right-1 rounded-sm border px-1.5 py-1 text-left transition-all hover:brightness-95 overflow-hidden"
                            style={{
                              top,
                              minHeight: 60,
                              background: PILLARS[pillar].dimBg,
                              borderColor: PILLARS[pillar].dimBorder,
                            }}
                          >
                            {/* Time + status */}
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[10px] font-mono text-muted-foreground leading-none">{t}</span>
                              <span className={cn("text-[9px] tracking-wide uppercase px-1 py-px rounded-sm border leading-none shrink-0", statusClass(p.status))}>
                                {statusLabel(p.status)}
                              </span>
                            </div>
                            {/* Pillar */}
                            <div className="text-[9px] tracking-widest uppercase font-medium leading-none mb-0.5" style={{ color: PILLARS[pillar].color }}>
                              {PILLARS[pillar].label}
                            </div>
                            {/* Title */}
                            <div className="text-[11px] text-foreground leading-snug line-clamp-2">{postTitle(p)}</div>
                            {/* Platforms */}
                            <div className="mt-0.5 flex gap-[2px]">
                              {channelsForPost(p).includes("ig") && <span className="text-[9px]">📸</span>}
                              {channelsForPost(p).includes("tiktok") && <span className="text-[9px]">🎵</span>}
                              {channelsForPost(p).includes("fb") && <span className="text-[9px]">📘</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* POST OVERVIEW */}
        <div className="px-4 md:px-6 py-6 bg-background border-t border-border">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-subheading text-[18px] font-light italic text-foreground">Post Overview</div>
              <div className="text-sm tracking-wide text-muted-foreground mt-1">
                {filteredPosts.length} posts · {awaitingCount} awaiting approval
              </div>
            </div>
            <div className="flex overflow-hidden rounded-sm border border-border bg-secondary">
              <button
                type="button"
                onClick={() => setOverviewTab("kanban")}
                className={cn(
                  "px-3 py-1 text-xs tracking-wider uppercase transition-colors",
                  overviewTab === "kanban" ? "bg-card text-primary shadow-card" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setOverviewTab("list")}
                className={cn(
                  "px-3 py-1 text-xs tracking-wider uppercase transition-colors",
                  overviewTab === "list" ? "bg-card text-primary shadow-card" : "text-muted-foreground hover:text-foreground",
                )}
              >
                List
              </button>
            </div>
          </div>

          {overviewTab === "kanban" ? (
            <div className="grid grid-cols-4 gap-3">
              {[
                { key: "toBeApproved", label: "TO BE APPROVED", dot: "#a06820", items: postOverview.toBeApproved },
                { key: "approved", label: "APPROVED", dot: "#2e7a52", items: postOverview.approved },
                { key: "scheduled", label: "SCHEDULED", dot: "#2c5f9e", items: postOverview.scheduled },
                { key: "posted", label: "POSTED", dot: "#6b6256", items: postOverview.posted },
              ].map((col) => (
                <div key={col.key} className="rounded-card border border-border bg-card shadow-card p-3.5 min-h-[220px]">
                  <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-[5px] w-[5px] rounded-full" style={{ background: col.dot }} />
                      <div className="text-xs tracking-[2px] text-foreground uppercase">{col.label}</div>
                    </div>
                    <div className="rounded-lg bg-secondary px-1.5 py-0.5 text-sm text-muted-foreground">{col.items.length}</div>
                  </div>
                  <div className="space-y-2">
                    {col.items.slice(0, 6).map((p) => {
                      const pillar = pillarForPost(p)
                      const t = normalizeTime(p.scheduled_time)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => openPostModal(p)}
                          className="w-full rounded-sm border border-border bg-background p-3 text-left transition-all hover:shadow-card hover:-translate-y-px"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm text-foreground leading-snug truncate">{postTitle(p)}</div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="rounded-sm border px-1.5 py-0.5 text-xs tracking-wide uppercase" style={{ color: PILLARS[pillar].color, borderColor: PILLARS[pillar].dimBorder, background: PILLARS[pillar].dimBg }}>
                                  {(p.content_type || "post").toUpperCase()}
                                </span>
                                {t ? <span>{t}</span> : null}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">{p.scheduled_date ? format(new Date(p.scheduled_date + "T00:00:00"), "dd-MM-yy") : "—"}</div>
                            </div>
                            <div className="shrink-0 text-sm">{postThumb(p)}</div>
                          </div>
                        </button>
                      )
                    })}
                    {col.items.length === 0 ? <div className="text-xs text-muted-foreground">—</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="flex flex-col gap-3">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Month */}
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="text-xs border border-border rounded-sm bg-card px-2 py-1.5 text-foreground focus:outline-none"
              >
                <option value="all">All Months</option>
                {Array.from(new Set(posts.map((p) => p.scheduled_date.slice(0, 7)))).sort().map((m) => (
                  <option key={m} value={m}>{format(new Date(m + "-01"), "MMMM yyyy")}</option>
                ))}
              </select>
              {/* Status */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="text-xs border border-border rounded-sm bg-card px-2 py-1.5 text-foreground focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Approved</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {/* Pillar */}
              <select
                value={filterPillar}
                onChange={(e) => setFilterPillar(e.target.value as PillarKey)}
                className="text-xs border border-border rounded-sm bg-card px-2 py-1.5 text-foreground focus:outline-none"
              >
                <option value="all">All Pillars</option>
                {(Object.keys(PILLARS) as Array<Exclude<PillarKey, "all">>).map((k) => (
                  <option key={k} value={k}>{PILLARS[k].label}</option>
                ))}
              </select>
              {/* Format */}
              <select
                value={filterFormat}
                onChange={(e) => setFilterFormat(e.target.value)}
                className="text-xs border border-border rounded-sm bg-card px-2 py-1.5 text-foreground focus:outline-none"
              >
                <option value="all">All Formats</option>
                <option value="post">Poster</option>
                <option value="reel">Video / Reels</option>
                <option value="photo">Photos</option>
                <option value="story">Story</option>
              </select>
              {/* Clear */}
              {(filterMonth !== "all" || filterStatus !== "all" || filterPillar !== "all" || filterFormat !== "all") && (
                <button
                  type="button"
                  onClick={() => { setFilterMonth("all"); setFilterStatus("all"); setFilterPillar("all"); setFilterFormat("all") }}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-sm px-2 py-1.5 transition-colors"
                >
                  Clear filters
                </button>
              )}
              <div className="ml-auto text-xs text-muted-foreground">{filteredPosts.length} posts</div>
            </div>

            <div className="rounded-card border border-border overflow-hidden">
              {/* Table header */}
              <div className="grid bg-secondary border-b border-border text-xs tracking-widest text-muted-foreground uppercase" style={{ gridTemplateColumns: "100px 160px 110px 140px 1.4fr 60px 110px" }}>
                <div className="px-3 py-2.5 border-r border-border">Date</div>
                <div className="px-3 py-2.5 border-r border-border">Pillar</div>
                <div className="px-3 py-2.5 border-r border-border">Format</div>
                <div className="px-3 py-2.5 border-r border-border">Platform</div>
                <div className="px-3 py-2.5 border-r border-border">Title / Ideas</div>
                <div className="px-3 py-2.5 border-r border-border">Link</div>
                <div className="px-3 py-2.5">Status</div>
              </div>

              {/* Rows sorted by date */}
              {filteredPosts.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground tracking-wider uppercase">No posts yet</div>
              ) : (
                [...filteredPosts]
                  .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
                  .map((p, idx) => {
                    const pillar = pillarForPost(p)
                    const mediaUrl = p.media_url || getNoteField(p.notes, "link_air") || getNoteField(p.notes, "brief")

                    const FORMAT_LABELS: Record<string, string> = {
                      post: "Poster",
                      reel: "Videos/Reels",
                      video: "Photos",
                      story: "Story",
                      carousel: "Carousel",
                    }
                    const PLATFORM_LABELS: Record<string, string> = {
                      all: "Facebook/Instagram",
                      instagram: "Instagram",
                      facebook: "Facebook",
                      tiktok: "TikTok",
                    }

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openPostModal(p)}
                        className={cn(
                          "w-full grid text-left transition-colors hover:bg-primary/[0.02]",
                          idx % 2 === 0 ? "bg-card" : "bg-background",
                          "border-b border-border last:border-b-0",
                        )}
                        style={{ gridTemplateColumns: "100px 160px 110px 140px 1.4fr 60px 110px" }}
                      >
                        {/* Date */}
                        <div className="px-3 py-3 border-r border-border text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {p.scheduled_date ? format(new Date(p.scheduled_date + "T00:00:00"), "dd-MM-yy") : "—"}
                        </div>

                        {/* Pillar */}
                        <div className="px-3 py-3 border-r border-border">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs"
                            style={{ color: PILLARS[pillar].color, background: PILLARS[pillar].dimBg, border: `1px solid ${PILLARS[pillar].dimBorder}` }}
                          >
                            {PILLARS[pillar].label}
                          </span>
                        </div>

                        {/* Format */}
                        <div className="px-3 py-3 border-r border-border">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-secondary border border-border text-foreground">
                            {FORMAT_LABELS[p.content_type ?? "post"] ?? (p.content_type || "—")}
                          </span>
                        </div>

                        {/* Platform */}
                        <div className="px-3 py-3 border-r border-border text-xs text-foreground">
                          {PLATFORM_LABELS[p.platform] ?? p.platform}
                        </div>

                        {/* Title / Ideas */}
                        <div className="px-3 py-3 border-r border-border min-w-0 overflow-hidden">
                          <div className="text-sm text-foreground font-medium leading-snug truncate">{postTitle(p)}</div>
                          {p.caption ? (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{p.caption}</div>
                          ) : null}
                        </div>

                        {/* Link */}
                        <div className="px-3 py-3 border-r border-border">
                          {mediaUrl ? (
                            <a
                              href={mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-info underline underline-offset-2 truncate block max-w-[120px] hover:text-info/80"
                            >
                              Open ↗
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="px-3 py-3 flex items-start">
                          <span className={cn("text-xs px-2 py-0.5 rounded-sm border", statusClass(p.status))}>
                            {statusLabel(p.status)}
                          </span>
                        </div>
                      </button>
                    )
                  })
              )}
            </div>
            </div>
          )}
        </div>

        {/* LEGEND (sticky bottom like reference) */}
        <div className="sticky bottom-0 z-20 border-t border-border bg-secondary px-4 md:px-6 py-2.5 flex flex-col gap-2">
          {/* Row 1 — Pillars */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs tracking-wider text-muted-foreground uppercase">Pillars</div>
            {(Object.keys(PILLARS) as Array<Exclude<PillarKey, "all">>).map((k) => (
              <div key={k} className="flex items-center gap-1.5 text-xs text-foreground">
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: PILLARS[k].color }} />
                {PILLARS[k].label}
              </div>
            ))}
          </div>
          {/* Row 2 — Status */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs tracking-wider text-muted-foreground uppercase">Status</div>
            <div className="flex items-center gap-1.5 text-xs text-foreground">
              <span className="w-[7px] h-[7px] rounded-full bg-success" />
              Approved
            </div>
            <div className="flex items-center gap-1.5 text-xs text-foreground">
              <span className="w-[7px] h-[7px] rounded-full bg-info" />
              Scheduled
            </div>
            <div className="flex items-center gap-1.5 text-xs text-foreground">
              <span className="w-[7px] h-[7px] rounded-full bg-warning" />
              Pending
            </div>
            <div className="flex items-center gap-1.5 text-xs text-foreground">
              <span className="w-[7px] h-[7px] rounded-full bg-error" />
              Cancelled
            </div>
          </div>
        </div>
      </div>

      {/* POST DETAIL MODAL (styled like reference) */}
      {modalOpen ? (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
          className="fixed inset-0 z-[500] bg-foreground/40 backdrop-blur-[4px] flex items-center justify-center p-8"
        >
          <div className="w-full max-w-[520px] rounded-lg border border-border bg-card shadow-[0_8px_32px_rgba(0,0,0,0.12),_0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* header */}
            <div className="p-5 pb-4 border-b border-border flex items-start justify-between gap-3">
              <div className="flex items-stretch gap-3 flex-1 min-w-0">
                <div className="w-[3px] rounded-sm" style={{ background: PILLARS[fPillar].color }} />
                <div className="min-w-0">
                  <div className="text-xs tracking-wider text-muted-foreground uppercase mb-1">{PILLARS[fPillar].label}</div>
                  <div className="font-subheading text-[20px] font-semibold text-foreground leading-tight truncate">
                    {fTitle.trim() || "Post Title"}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground text-base leading-none">
                ✕
              </button>
            </div>

            {/* body */}
            <div className="p-5 space-y-4">
              <div className="h-40 rounded-md border border-border bg-secondary flex items-center justify-center text-5xl">
                {postThumb(editingPost || ({ content_type: fContentType } as any))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs tracking-widest text-muted-foreground uppercase">Time to post</div>
                  <div className="text-sm text-foreground mt-1">{fScheduledTime || "—"}</div>
                </div>
                <div>
                  <div className="text-xs tracking-widest text-muted-foreground uppercase">Date</div>
                  <div className="text-sm text-foreground mt-1">{fScheduledDate || "—"}</div>
                </div>
                <div>
                  <div className="text-xs tracking-widest text-muted-foreground uppercase">Format</div>
                  <div className="text-sm text-foreground mt-1">{fContentType}</div>
                </div>
              </div>

              {/* editable fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs tracking-widest text-muted-foreground uppercase">Title</div>
                  <input
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    placeholder="Post title"
                    className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <div className="text-xs tracking-widest text-muted-foreground uppercase">Content pillar</div>
                  <div className="mt-1 flex gap-1.5 flex-wrap">
                    {(Object.keys(PILLARS) as Array<Exclude<PillarKey, "all">>).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setFPillar(k)}
                        className={cn("px-2.5 py-[3px] rounded-full border text-xs")}
                        style={{
                          color: PILLARS[k].color,
                          background: PILLARS[k].dimBg,
                          borderColor: PILLARS[k].dimBorder,
                          opacity: fPillar === k ? 1 : 0.85,
                        }}
                      >
                        {PILLARS[k].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs tracking-widest text-muted-foreground uppercase">Date</div>
                  <input
                    type="date"
                    value={fScheduledDate}
                    onChange={(e) => setFScheduledDate(e.target.value)}
                    className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <div className="text-xs tracking-widest text-muted-foreground uppercase">Time</div>
                  <input
                    type="time"
                    value={fScheduledTime}
                    onChange={(e) => setFScheduledTime(e.target.value)}
                    className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs tracking-widets text-muted-foreground uppercase mb-1.5">Platform</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { value: "all" as const, label: "Instagram / Facebook" },
                      { value: "tiktok" as const, label: "TikTok" },
                      { value: "instagram" as const, label: "Instagram only" },
                      { value: "facebook" as const, label: "Facebook only" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFPlatform(opt.value)}
                        className={cn(
                          "px-2.5 py-[3px] rounded-full border text-xs transition-colors",
                          fPlatform === opt.value
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-secondary border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs tracking-widets text-muted-foreground uppercase mb-1.5">Format</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { value: "post" as const, label: "Poster" },
                      { value: "reel" as const, label: "Video / Reels" },
                      { value: "video" as const, label: "Photos" },
                      { value: "story" as const, label: "Story" },
                      { value: "carousel" as const, label: "Carousel" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFContentType(opt.value)}
                        className={cn(
                          "px-2.5 py-[3px] rounded-full border text-xs transition-colors",
                          fContentType === opt.value
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-secondary border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs tracking-widest text-muted-foreground uppercase">Caption</div>
                <textarea
                  value={fCaption}
                  onChange={(e) => setFCaption(e.target.value)}
                  placeholder="Write your caption..."
                  className="mt-1 w-full min-h-[90px] rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground leading-relaxed"
                />
              </div>

              <div>
                <div className="text-xs tracking-widest text-muted-foreground uppercase">Link / Photo / Video</div>
                <div className="mt-1 flex gap-2 items-center">
                  <input
                    value={fMediaUrl}
                    onChange={(e) => setFMediaUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                  {fMediaUrl && (
                    <a
                      href={fMediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-3 py-2 rounded-sm border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs tracking-widest text-muted-foreground uppercase">Approval status</div>
                <div className="mt-1 flex gap-2">
                  {[
                    { label: "✓ Approved", value: "published" as const, cls: "selected-approved" },
                    { label: "◷ Scheduled", value: "scheduled" as const, cls: "selected-scheduled" },
                    { label: "⋯ Pending", value: "draft" as const, cls: "selected-pending" },
                    { label: "✕ Cancelled", value: "cancelled" as const, cls: "selected-cancelled" },
                  ].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setFStatus(s.value)}
                      className={cn(
                        "flex-1 rounded-sm border border-border bg-secondary px-2 py-2 text-xs tracking-wide uppercase text-muted-foreground transition-colors",
                        "hover:border-border/80",
                        fStatus === s.value && s.cls,
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="px-5 py-3 border-t border-border bg-secondary flex items-center justify-between">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-sm border border-border text-xs tracking-wider uppercase text-muted-foreground hover:text-secondary-foreground hover:border-border/80"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                {editingPost ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-2 rounded-sm border border-border text-xs tracking-wider uppercase text-error hover:border-border/80"
                  >
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!fScheduledDate}
                  className={cn(
                    "px-4 py-2 rounded-sm text-xs tracking-wider uppercase",
                    "bg-success text-white hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  {fStatus === "published" ? "✓ Approved" : "Approve post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* tiny status styles for week cards to match reference */}
      <style>{`
        .st-approved { color: rgb(var(--success)); border-color: rgba(46,122,82,0.25); background: rgba(46,122,82,0.08); }
        .st-scheduled { color: rgb(var(--info)); border-color: rgba(44,95,158,0.25); background: rgba(44,95,158,0.08); }
        .st-pending { color: rgb(var(--warning)); border-color: rgba(160,104,32,0.25); background: rgba(160,104,32,0.08); }
        .st-cancelled { color: rgb(var(--error)); border-color: rgba(184,50,50,0.25); background: rgba(184,50,50,0.08); }
        .selected-approved { background: rgba(46,122,82,0.08); border-color: rgba(46,122,82,0.3); color: rgb(var(--success)); }
        .selected-scheduled { background: rgba(44,95,158,0.08); border-color: rgba(44,95,158,0.3); color: rgb(var(--info)); }
        .selected-pending { background: rgba(160,104,32,0.08); border-color: rgba(160,104,32,0.3); color: rgb(var(--warning)); }
        .selected-cancelled { background: rgba(184,50,50,0.08); border-color: rgba(184,50,50,0.3); color: rgb(var(--error)); }
      `}</style>
    </div>
  )
}

