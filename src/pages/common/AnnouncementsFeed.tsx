import { useState, useEffect, useRef, useMemo } from "react"
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
  useMarkAnnouncementRead,
  useCreateAnnouncementReply,
  useAnnouncementReplies,
  useAnnouncement,
} from "@/hooks/useAnnouncements"
import { useAuthStore } from "@/stores/authStore
import type { Announcement, AnnouncementAudience, CreateAnnouncementInput } from "@/types"
import { useChatMessages, useSendChatMessage } from "@/hooks/useChatMessages"
import { useStaffList } from "@/hooks/useShifts"

// ─── Constants ─────────────────────────────────────────────────────────────────

type TagKey = "ops" | "event" | "team" | "urgent" | "info"

const TAG_CONFIG: Record<TagKey, { label: string; cls: string }> = {
  ops:    { label: "Operations", cls: "bg-amber-50 text-amber-800 border border-amber-200" },
  event:  { label: "Event",      cls: "bg-yellow-50 text-yellow-800 border border-yellow-200" },
  team:   { label: "Team",       cls: "bg-blue-50 text-blue-800 border border-blue-200" },
  urgent: { label: "Urgent",     cls: "bg-red-50 text-red-800 border border-red-200" },
  info:   { label: "Info",       cls: "bg-green-50 text-green-800 border border-green-200" },
}

// Map audience → tag for display
function tagFromAnnouncement(a: Announcement): TagKey {
  if (a.audience === "managers") return "team"
  // Use title keywords to infer a tag when no explicit tag stored
  const t = a.title.toLowerCase()
  if (t.includes("urgent") || t.includes("action required") || t.includes("protocol")) return "urgent"
  if (t.includes("event") || t.includes("night out") || t.includes("dj") || t.includes("night")) return "event"
  if (t.includes("roster") || t.includes("team") || t.includes("staff") || t.includes("schedule")) return "team"
  if (t.includes("feedback") || t.includes("review") || t.includes("guest")) return "info"
  return "ops"
}

const AVATAR_COLORS = [
  "#5C6BC0", "#2E7D52", "#8B6914", "#1565C0", "#00695C",
  "#8B3030", "#1B5E20", "#6A1B9A", "#00838F", "#4E342E",
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
}

function formatRelTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 2) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`

  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString()
  const msgDate = date.toDateString()

  if (msgDate === today) return `Today, ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
  if (msgDate === yesterday) return `Yesterday, ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ─── Post Announcement Modal ───────────────────────────────────────────────────

function PostAnnouncementModal({
  open,
  onClose,
  editAnnouncement,
}: {
  open: boolean
  onClose: () => void
  editAnnouncement?: Announcement | null
}) {
  const createAnn = useCreateAnnouncement()
  const updateAnn = useUpdateAnnouncement()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [tag, setTag] = useState<TagKey>("ops")
  const [audience, setAudience] = useState<AnnouncementAudience>("all")
  const [pin, setPin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editAnnouncement) {
      setTitle(editAnnouncement.title)
      setBody(editAnnouncement.body)
      setTag(tagFromAnnouncement(editAnnouncement))
      setAudience(editAnnouncement.audience as AnnouncementAudience)
      setPin(editAnnouncement.isPinned)
    } else {
      setTitle(""); setBody(""); setTag("ops"); setAudience("all"); setPin(false)
    }
    setError(null)
  }, [open, editAnnouncement])

  const isPending = createAnn.isPending || updateAnn.isPending

  async function handleSubmit() {
    if (!title.trim()) { setError("Title is required"); return }
    if (!body.trim()) { setError("Message is required"); return }
    setError(null)
    try {
      const input: CreateAnnouncementInput = { title, body, audience, isPinned: pin, allowReplies: true }
      if (editAnnouncement) {
        await updateAnn.mutateAsync({ id: editAnnouncement.id, ...input })
      } else {
        await createAnn.mutateAsync(input)
      }
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to save")
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[560px] max-w-[95vw] rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-foreground mb-5">
          {editAnnouncement ? "Edit Announcement" : "Post Announcement"}
        </h2>

        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] tracking-widest font-semibold text-muted-foreground uppercase">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Saturday prep briefing"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] tracking-widest font-semibold text-muted-foreground uppercase">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement…"
              rows={4}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-widest font-semibold text-muted-foreground uppercase">Category</label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as TagKey)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="ops">Operations</option>
                <option value="event">Event</option>
                <option value="team">Team</option>
                <option value="urgent">Urgent</option>
                <option value="info">Info / Feedback</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-widest font-semibold text-muted-foreground uppercase">Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="all">Everyone</option>
                <option value="managers">Managers Only</option>
                <option value="bartenders">Bar Team</option>
                <option value="service">Floor Team</option>
                <option value="hosts">Hosts</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-widest font-semibold text-muted-foreground uppercase">Pin this?</label>
              <select
                value={pin ? "yes" : "no"}
                onChange={(e) => setPin(e.target.value === "yes")}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="no">No</option>
                <option value="yes">Yes — pin to top</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-widest font-semibold text-muted-foreground uppercase">Notify via?</label>
              <select className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                <option>In-app only</option>
                <option>In-app + Push</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">⚠️ {error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPending ? "Saving…" : editAnnouncement ? "Save Changes" : "Post Announcement"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Announcement Card ─────────────────────────────────────────────────────────

// Seed reactions from replyCount & readCount so cards feel alive
const SEED_REACTIONS: Record<string, Array<{ emoji: string; count: number }>> = {}

function AnnouncementCard({
  announcement,
  canManage,
  onEdit,
}: {
  announcement: Announcement
  canManage: boolean
  onEdit: (a: Announcement) => void
}) {
  const deleteAnn = useDeleteAnnouncement()
  const updateAnn = useUpdateAnnouncement()
  const markRead = useMarkAnnouncementRead()
  const [expanded, setExpanded] = useState(false)
  // reactions: emoji → count
  const [reactions, setReactions] = useState<Record<string, number>>(() => {
    const seed = SEED_REACTIONS[announcement.id]
    if (seed) return Object.fromEntries(seed.map((r) => [r.emoji, r.count]))
    return {}
  })
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set())
  const [showRxnPicker, setShowRxnPicker] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const tag = tagFromAnnouncement(announcement)
  const tagCfg = TAG_CONFIG[tag]
  const authorName = announcement.author?.fullName || "Unknown"
  const avatarBg = avatarColor(authorName)
  const avi = initials(authorName)

  // Derive a display role label from the author's profile
  const roleLabel = (() => {
    const r = announcement.author?.role
    const j = announcement.author?.jobRole
    if (r === "owner") return "Owner"
    if (r === "manager") {
      if (j === "general_manager") return "General Manager"
      if (j === "bar_manager") return "Bar Manager"
      if (j === "floor_manager") return "Floor Manager"
      return "Manager"
    }
    if (j === "bartender" || j === "head_bartender") return "Head Bartender"
    if (j === "waiter" || j === "supervisor") return "Supervisor"
    return "Staff"
  })()

  function handleToggleRxn(emoji: string) {
    setMyReactions((prev) => {
      const next = new Set(prev)
      const had = next.has(emoji)
      had ? next.delete(emoji) : next.add(emoji)
      setReactions((r) => ({ ...r, [emoji]: Math.max(0, (r[emoji] || 0) + (had ? -1 : 1)) }))
      return next
    })
    setShowRxnPicker(false)
  }

  function handleCardClick() {
    setExpanded((p) => !p)
    if (!announcement.isRead) markRead.mutate(announcement.id)
  }

  const allEmojis = ["👍", "🔥", "✅", "🙏", "❤️", "👀"]
  // Only show emojis that have at least 1 reaction
  const activeReactions = allEmojis.filter((e) => (reactions[e] || 0) > 0)

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-all",
        announcement.isPinned ? "border-l-[3px] border-l-primary border-border" : "border-border",
        !announcement.isRead && "shadow-sm",
      )}
    >
      {/* Card body — clickable to expand */}
      <div className="p-5 cursor-pointer" onClick={handleCardClick}>
        {/* Author row */}
        <div className="flex items-start gap-3">
          {/* Unread dot */}
          <div className="w-2 shrink-0 flex justify-center pt-2">
            {!announcement.isRead && <span className="h-1.5 w-1.5 rounded-full bg-primary block" />}
          </div>

          {/* Avatar */}
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: avatarBg }}
          >
            {avi}
          </div>

          {/* Meta */}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-foreground leading-tight">
              {authorName}{" "}
              <span className="font-normal text-muted-foreground text-xs">· {roleLabel}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Posted to: {announcement.audience === "all" ? "Everyone"
                : announcement.audience === "managers" ? "Managers"
                : announcement.audience === "bartenders" ? "Bar Team"
                : announcement.audience === "service" ? "Floor Team"
                : "Everyone"}
            </div>
          </div>

          <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
            {formatRelTime(announcement.publishedAt)}
          </span>
        </div>

        {/* Title */}
        <div className="mt-3 ml-5 text-[13.5px] font-semibold text-foreground leading-snug">
          {announcement.title}
        </div>

        {/* Body */}
        <div className={cn("mt-1.5 ml-5 text-[12.5px] text-foreground/75 leading-relaxed", !expanded && "line-clamp-3")}>
          {announcement.body}
        </div>
        {announcement.body.length > 220 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p) }}
            className="ml-5 mt-1 text-[11px] text-primary hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-2 px-5 pb-3.5 flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Category tag */}
        <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase", tagCfg.cls)}>
          {tagCfg.label}
        </span>

        {/* Active reactions */}
        {activeReactions.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleToggleRxn(emoji)}
            className={cn(
              "flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors",
              myReactions.has(emoji)
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80",
            )}
          >
            {emoji} <span className="text-[11px] font-medium">{reactions[emoji]}</span>
          </button>
        ))}

        {/* React picker */}
        <div className="relative">
          <button
            onClick={() => setShowRxnPicker((p) => !p)}
            className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary/80 transition-colors"
          >
            😊 <span className="text-[10px]">React</span>
          </button>
          {showRxnPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowRxnPicker(false)} />
              <div className="absolute bottom-full mb-1 left-0 z-20 flex gap-1 bg-card border border-border rounded-lg p-1.5 shadow-lg">
                {allEmojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => handleToggleRxn(e)}
                    className={cn(
                      "text-base w-8 h-8 rounded hover:bg-secondary transition-colors",
                      myReactions.has(e) && "bg-primary/10",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Comment button */}
        <button
          onClick={() => setShowReply((p) => !p)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {announcement.replyCount || 0} {(announcement.replyCount || 0) === 1 ? "comment" : "comments"}
        </button>

        {/* Pinned badge */}
        {announcement.isPinned && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
            </svg>
            Pinned
          </span>
        )}

        {/* Owner actions — only visible for author */}
        {canManage && (
          <div className={cn("flex items-center gap-1.5", !announcement.isPinned && "ml-auto")}>
            <button
              onClick={() => updateAnn.mutate({ id: announcement.id, isPinned: !announcement.isPinned })}
              className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary transition-colors"
            >
              {announcement.isPinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={() => onEdit(announcement)}
              className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary transition-colors"
            >
              Edit
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-red-400 hover:text-red-500 transition-colors"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => deleteAnn.mutate(announcement.id)}
                  className="rounded border border-red-400 bg-red-500 text-white px-2 py-0.5 text-[10px] hover:bg-red-600 transition-colors"
                >
                  Sure?
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] text-muted-foreground underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline replies */}
      {showReply && (
        <div onClick={(e) => e.stopPropagation()}>
          <ReplySection announcementId={announcement.id} />
        </div>
      )}
    </div>
  )
}

// ─── Reply Section ─────────────────────────────────────────────────────────────

function ReplySection({ announcementId }: { announcementId: string }) {
  const { data: replies, isLoading } = useAnnouncementReplies(announcementId)
  const createReply = useCreateAnnouncementReply()
  const [text, setText] = useState("")

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await createReply.mutateAsync({ announcementId, body: text })
    setText("")
  }

  return (
    <div className="border-t border-border px-5 py-4 space-y-3 bg-secondary/30">
      {(isLoading || isError) ? (
        <div className="text-xs text-muted-foreground italic">Loading…</div>
      ) : replies && replies.length > 0 ? (
        <div className="space-y-3">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-2.5">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: avatarColor(r.author?.fullName || "?") }}
              >
                {initials(r.author?.fullName || "?")}
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground">{r.author?.fullName || "Unknown"} </span>
                <span className="text-[10px] text-muted-foreground">{formatRelTime(r.createdAt)}</span>
                <div className="text-xs text-foreground/80 mt-0.5">{r.body}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">No comments yet.</div>
      )}

      <form onSubmit={handleReply} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!text.trim() || createReply.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {createReply.isPending ? "…" : "Post"}
        </button>
      </form>
    </div>
  )
}

// ─── Chat Panel ────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string
  av: string
  color: string
  name: string
  time: string
  text: string
  reactions?: Array<{ emoji: string; count: number; mine?: boolean }>
  attachmentName?: string
}

interface ChannelDef {
  id: string
  icon: string
  name: string
  displayName: string
  desc: string
  unread?: number
  lastMessage: string
  lastTime: string
  isDm?: boolean
  dmStatus?: "online" | "away" | "offline"
  dmColor?: string
}

const CHANNELS: ChannelDef[] = [
  { id: "#general",    icon: "💬", name: "# general",    displayName: "#general",    desc: "All staff · 12 members",   unread: 3, lastMessage: "John: Roster confirmed for Sat",       lastTime: "17:28" },
  { id: "#operations", icon: "🔧", name: "# operations", displayName: "#operations", desc: "Ops team · 6 members",      unread: 1, lastMessage: "Tiny: Covers are set ✓",              lastTime: "16:50" },
  { id: "#bar-team",   icon: "🍹", name: "# bar-team",   displayName: "#bar-team",   desc: "Bar staff · 5 members",     lastMessage: "Phu: New Tet menu is live",                 lastTime: "14:30" },
  { id: "#events",     icon: "🎶", name: "# events",     displayName: "#events",     desc: "Event planning · 4 members",unread: 1, lastMessage: "Charlie: DJ brief for tonight",       lastTime: "13:00" },
  { id: "#marketing",  icon: "📣", name: "# marketing",  displayName: "#marketing",  desc: "Marketing team",            lastMessage: "Content calendar updated",                 lastTime: "Yesterday" },
]


function ChatPanel({ profile }: { profile: any }) {
  const [activeChannel, setActiveChannel] = useState<string>("#general")
  const [text, setText] = useState("")
  const [search, setSearch] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: staffList = [] } = useStaffList()
  const { data: rawMessages = [], isLoading: messagesLoading } = useChatMessages(activeChannel)
  const sendMutation = useSendChatMessage()

  // Build DM channel list from real staff, excluding the current user
  const dmChannels: ChannelDef[] = useMemo(() => {
    return staffList
      .filter((s) => s.id !== profile?.id)
      .map((s) => ({
        id: `@${s.id}`,
        icon: initials(s.full_name || "?"),
        name: s.full_name || "Unknown",
        displayName: `@${(s.full_name || "unknown").split(" ")[0].toLowerCase()}`,
        desc: s.job_role || s.role || "",
        isDm: true,
        dmStatus: "offline" as const,
        dmColor: avatarColor(s.full_name || "?"),
        lastMessage: "",
        lastTime: "",
      }))
  }, [staffList, profile?.id])

  // Map DB messages to the ChatMsg shape used by the render
  const currentMessages: ChatMsg[] = useMemo(() => {
    return rawMessages.map((m) => {
      const authorName = m.author?.full_name || "Unknown"
      return {
        id: m.id,
        av: initials(authorName),
        color: avatarColor(authorName),
        name: authorName,
        time: new Date(m.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        text: m.body,
      }
    })
  }, [rawMessages])

  const currentChannelDef = [...CHANNELS, ...dmChannels].find((c) => c.id === activeChannel)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeChannel, currentMessages])

  function sendMessage() {
    const trimmed = text.trim()
    if (!trimmed || !profile?.id) return
    sendMutation.mutate({
      channel_id: activeChannel,
      author_id: profile.id,
      body: trimmed,
    })
    setText("")
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const filteredChannels = CHANNELS.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredDms = dmChannels.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Channel sidebar ── */}
      <div className="w-60 shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold text-foreground mb-2">Messages</div>
          <div className="flex items-center gap-2 bg-secondary border border-border rounded-md px-2 py-1.5">
            <svg className="h-3 w-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="bg-transparent text-xs text-foreground outline-none w-full placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden py-2 px-2">
          {/* Channels — fixed, no scroll needed (small list) */}
          <div className="shrink-0">
            <div className="text-[9px] tracking-widest font-semibold text-muted-foreground uppercase px-2 py-2">Channels</div>
            {filteredChannels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                  activeChannel === ch.id ? "bg-secondary" : "hover:bg-secondary/60",
                )}
              >
                <div className={cn("h-7 w-7 rounded-md flex items-center justify-center text-sm shrink-0", activeChannel === ch.id ? "bg-primary/10" : "bg-secondary")}>
                  {ch.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-foreground truncate">{ch.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{ch.lastMessage}</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="text-[10px] text-muted-foreground">{ch.lastTime}</div>
                  {ch.unread && <span className="rounded-full bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 min-w-[16px] text-center">{ch.unread}</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Direct Messages — scrollable so many users don't break the layout */}
          <div className="flex flex-col min-h-0 mt-2">
            <div className="text-[9px] tracking-widest font-semibold text-muted-foreground uppercase px-2 py-2 shrink-0">Direct Messages</div>
            <div className="overflow-y-auto flex-1">
              {filteredDms.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => setActiveChannel(dm.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                    activeChannel === dm.id ? "bg-secondary" : "hover:bg-secondary/60",
                  )}
                >
                  <div className="relative shrink-0">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: dm.dmColor }}>
                      {dm.icon}
                    </div>
                    <span className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                      dm.dmStatus === "online" ? "bg-green-500" : dm.dmStatus === "away" ? "bg-amber-400" : "bg-muted-foreground",
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-foreground truncate">{dm.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{dm.desc}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">{dm.lastTime}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
          {currentChannelDef?.isDm ? (
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: currentChannelDef.dmColor }}>
              {currentChannelDef.icon}
            </div>
          ) : (
            <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-lg shrink-0">
              {currentChannelDef?.icon}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-foreground">{currentChannelDef?.name}</div>
            <div className="text-xs text-muted-foreground">{currentChannelDef?.desc}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {[
              <svg key="s" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
              <svg key="u" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
              <svg key="m" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
            ].map((icon, i) => (
              <button key={i} className="h-7 w-7 rounded-md border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {messagesLoading && (
            <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">Loading messages…</div>
          )}
          {!messagesLoading && currentMessages.length === 0 && (
            <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">No messages yet. Be the first to say something!</div>
          )}
          {currentMessages.map((msg, idx) => {
            const isFirst = idx === 0 || currentMessages[idx - 1].name !== msg.name
            return (
              <div
                key={msg.id}
                className={cn(
                  "group flex gap-2.5 rounded-md px-2 py-1 -mx-2 hover:bg-secondary/50 transition-colors",
                  isFirst ? "mt-3" : "mt-0.5",
                )}
              >
                <div className="w-8 shrink-0">
                  {isFirst ? (
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: msg.color }}>
                      {msg.av}
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {isFirst && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground">{msg.name}</span>
                      <span className="text-[10.5px] text-muted-foreground">{msg.time}</span>
                    </div>
                  )}
                  <div className="text-[13px] text-foreground/80 leading-relaxed">{msg.text}</div>
                  {msg.attachmentName && (
                    <div className="mt-2 inline-flex items-center gap-2 bg-secondary border border-border rounded-md px-3 py-2 cursor-pointer hover:border-border/80 transition-colors max-w-[280px]">
                      <div className="h-7 w-7 rounded bg-blue-50 flex items-center justify-center shrink-0">
                        <svg className="h-3.5 w-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-foreground truncate">{msg.attachmentName}</div>
                        <div className="text-[10.5px] text-muted-foreground">PDF</div>
                      </div>
                    </div>
                  )}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {msg.reactions.map((r) => (
                        <button
                          key={r.emoji}
                          className={cn(
                            "flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-colors",
                            r.mine ? "bg-primary/10 border-primary/30" : "bg-secondary border-border hover:bg-primary/10",
                          )}
                        >
                          {r.emoji} <span className="text-[11px] font-medium text-foreground/70">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Compose */}
        <div className="px-5 py-3 border-t border-border bg-card shrink-0">
          <div className={cn("border rounded-lg overflow-hidden transition-colors", text ? "border-primary" : "border-border")}>
            <div className="px-3 pt-2 pb-1">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${currentChannelDef?.name || "…"}`}
                rows={1}
                className="w-full bg-transparent text-sm text-foreground outline-none resize-none leading-relaxed placeholder:text-muted-foreground min-h-[36px] max-h-[120px]"
              />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-border">
              {[
                { title: "Emoji", icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> },
                { title: "Attach", icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> },
                { title: "Mention", icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/></svg> },
              ].map((t) => (
                <button key={t.title} title={t.title} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  {t.icon}
                </button>
              ))}
              <button
                onClick={sendMessage}
                disabled={!text.trim()}
                className="ml-auto flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Send
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function AnnouncementsFeed() {
  const profile = useAuthStore((s) => s.profile)
  const { data: announcements, isLoading, isError } = useAnnouncements()
  const [searchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<"ann" | "chat">(() =>
    searchParams.get("tab") === "chat" ? "chat" : "ann"
  )
  const [filterTag, setFilterTag] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editAnnouncement, setEditAnnouncement] = useState<Announcement | null>(null)

  const canManage = profile?.role === "owner" || profile?.role === "manager"

  const pinned = announcements?.filter((a) => a.isPinned) || []
  const unpinned = announcements?.filter((a) => !a.isPinned) || []
  const unreadCount = announcements?.filter((a) => !a.isRead).length || 0

  function filterAnnouncements(list: Announcement[]) {
    return list.filter((a) => {
      if (filterTag !== "all" && tagFromAnnouncement(a) !== filterTag) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!a.title.toLowerCase().includes(q) && !a.body.toLowerCase().includes(q)) return false
      }
      return true
    })
  }

  function handleEdit(a: Announcement) {
    setEditAnnouncement(a)
    setModalOpen(true)
  }

  function openCreate() {
    setEditAnnouncement(null)
    setModalOpen(true)
  }

  const userInitials = initials(profile?.fullName || "Me")
  const userColor = avatarColor(profile?.fullName || "Me")

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-card px-5 shrink-0">
        {([
          {
            id: "ann", label: "Announcements", badge: unreadCount,
            icon: (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 11l19-9-9 19-2-8-8-2z"/>
              </svg>
            ),
          },
          {
            id: "chat", label: "Chat", badge: 5,
            icon: (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            ),
          },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3.5 text-[14px] font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-[#78350F] text-[#1F2937]"
                : "border-transparent text-[#6B7280] hover:text-[#1F2937]",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge > 0 && (
              <span className="rounded-full bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 min-w-[16px] text-center leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Announcements panel ── */}
      {activeTab === "ann" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-4">
            {/* Page header */}
            <div>
              <h1 className="text-[28px] font-bold leading-tight text-foreground">Announcements</h1>
              <p className="mt-1 text-sm text-muted-foreground">Stay updated with team news and updates</p>
            </div>

            {/* Compose strip */}
            <div
              onClick={openCreate}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 cursor-pointer hover:shadow-sm transition-all"
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: userColor }}
              >
                {userInitials}
              </div>
              <span className="flex-1 min-w-[120px] text-sm text-muted-foreground">Share something with the team…</span>
              {canManage && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openCreate() }}
                  className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap shrink-0"
                >
                  <span className="hidden sm:inline">+ Post Announcement</span>
                  <span className="sm:hidden">+ Post</span>
                </button>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Filter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["all", "ops", "event", "team", "urgent"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterTag(f)}
                    className={cn(
                      "rounded-full px-[14px] py-[6px] text-[13px] font-medium transition-all",
                      filterTag === f
                        ? "bg-[#78350F] text-white"
                        : "bg-white border border-[#D1D5DB] text-[#6B7280] hover:border-[#9CA3AF]",
                    )}
                  >
                    {f === "all" ? "All"
                      : f === "ops" ? "Operations"
                      : f === "event" ? "Events"
                      : f === "team" ? "Team"
                      : "Urgent"}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5 ml-auto">
                <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search announcements…"
                  className="bg-transparent text-xs text-foreground outline-none w-44 placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Pinned banner */}
            {pinned.length > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-[12.5px]">
                <svg className="h-4 w-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z"/>
                </svg>
                <strong className="text-amber-900">{pinned.length} pinned {pinned.length === 1 ? "announcement" : "announcements"}</strong>
                {pinned[0] && <span className="text-amber-700/80">— {pinned[0].title}</span>}
                <button
                  onClick={() => setFilterTag("all")}
                  className="ml-auto flex items-center gap-1 text-xs text-amber-700 font-medium hover:underline"
                >
                  View <span>↓</span>
                </button>
              </div>
            )}

            {/* List */}
            {(isLoading || isError) ? (
              <div className="py-12 text-center text-sm text-muted-foreground">{isError ? "⚠️ Unable to load announcements. Please refresh." : "Loading announcements…"}</div>
            ) : (
              <div className="space-y-3">
                {filterAnnouncements([...pinned, ...unpinned]).map((a) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    canManage={canManage && a.authorId === profile?.id}
                    onEdit={handleEdit}
                  />
                ))}
                {filterAnnouncements([...pinned, ...unpinned]).length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground italic">No announcements match this filter.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chat panel ── */}
      {activeTab === "chat" && <ChatPanel profile={profile} />}

      {/* Modal */}
      <PostAnnouncementModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAnnouncement(null) }}
        editAnnouncement={editAnnouncement}
      />
    </div>
  )
}

// ─── Detail view (keep for /announcements/:id route) ──────────────────────────

export function AnnouncementDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: announcement, isLoading } = useAnnouncement(id || null)
  const markRead = useMarkAnnouncementRead()

  useEffect(() => {
    if (id && announcement && !announcement.isRead) markRead.mutate(id)
  }, [id, announcement?.isRead])

  if (isLoading) return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>
  if (!announcement) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Announcement not found</p>
      <Link to="/announcements" className="text-primary hover:underline mt-2 inline-block text-sm">Back to announcements</Link>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground mb-3">{announcement.title}</h1>
        <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">{announcement.body}</p>
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
          <span>By {announcement.author?.fullName || "Unknown"}</span>
          <span>{formatRelTime(announcement.publishedAt)}</span>
          <span>{announcement.readCount || 0} read</span>
        </div>
      </div>
      {announcement.allowReplies && <ReplySection announcementId={announcement.id} />}
    </div>
  )
}
