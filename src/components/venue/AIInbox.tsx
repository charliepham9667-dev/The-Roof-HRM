import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  useConversations, useMessages, useGuestReservations,
  useSendInboxMessage, useResolveConversation,
  type Conversation, type Message,
} from "@/hooks/useInbox"
import {
  Send, CheckCircle, Loader2, Sparkles, CalendarPlus, Check,
} from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return "now"
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  })
}

const PHONE_META: [string, string, string, string][] = [
  ["+84",  "🇻🇳", "Vietnam",        "Vietnamese"],
  ["+44",  "🇬🇧", "United Kingdom", "English"],
  ["+1",   "🇺🇸", "United States",  "English"],
  ["+61",  "🇦🇺", "Australia",      "English"],
  ["+82",  "🇰🇷", "South Korea",    "Korean"],
  ["+886", "🇹🇼", "Taiwan",         "Mandarin"],
  ["+81",  "🇯🇵", "Japan",          "Japanese"],
  ["+33",  "🇫🇷", "France",         "French"],
  ["+49",  "🇩🇪", "Germany",        "German"],
  ["+353", "🇮🇪", "Ireland",        "English"],
  ["+65",  "🇸🇬", "Singapore",      "English"],
  ["+66",  "🇹🇭", "Thailand",       "Thai"],
]

function phoneMeta(phone: string | null): { flag: string; country: string; lang: string } | null {
  if (!phone) return null
  for (const [prefix, flag, country, lang] of PHONE_META) {
    if (phone.startsWith(prefix)) return { flag, country, lang }
  }
  return null
}

const AVATAR_COLORS = [
  "#4A1F1C", "#6B4226", "#7C5C42", "#5C4033", "#8B5A2B",
  "#9E6B4A", "#3D2B1F", "#6B3A2A", "#A0522D", "#2D4A3E",
]
function avatarColor(name: string): string {
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2)
}

function displayName(c: Conversation): string {
  return c.guest_name ?? c.phone ?? c.email ?? "Unknown"
}

// Channel config
const CHANNEL_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  whatsapp:  { label: "WhatsApp",  color: "#25D366", dot: "bg-[#25D366]" },
  instagram: { label: "Instagram", color: "#E1306C", dot: "bg-[#E1306C]" },
  facebook:  { label: "Messenger", color: "#1877F2", dot: "bg-[#1877F2]" },
  email:     { label: "Email",     color: "#0ea5e9", dot: "bg-sky-500" },
}
function channelCfg(ch: string) {
  return CHANNEL_CONFIG[ch] ?? { label: ch, color: "#82786a", dot: "bg-stone-400" }
}

// Simple booking intent detection from messages
function detectIntent(messages: Message[]): string | null {
  const guestText = messages
    .filter((m) => m.sender === "guest")
    .map((m) => m.body)
    .join(" ")
    .toLowerCase()

  const hasIntent = /book|table|reserv|tonight|tomorrow|tuesday|wednesday|thursday|friday|saturday|sunday|monday|seat|slot/.test(guestText)
  if (!hasIntent) return null

  const paxMatch = guestText.match(/(\d+)\s*(?:people|persons?|pax|guests?|of\s+us)/i)
  const pax = paxMatch ? `${paxMatch[1]} pax` : ""

  const timeMatch = guestText.match(/(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)
  const time = timeMatch ? timeMatch[1].replace(/\s/g, "") : ""

  const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday","tonight","tomorrow"]
  const dayMatch = days.find((d) => guestText.includes(d))
  const day = dayMatch ? dayMatch.charAt(0).toUpperCase() + dayMatch.slice(1) : ""

  const parts = ["New booking", pax, [day, time].filter(Boolean).join(" ")].filter(Boolean)
  return parts.join(" · ")
}

// ─── Channel status pill ──────────────────────────────────────────────────────

function StatusPill({ channel, connected }: { channel: string; connected: boolean }) {
  const cfg = channelCfg(channel)
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold",
        connected
          ? "border-border bg-card text-foreground"
          : "border-border/50 bg-muted/40 text-muted-foreground",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", connected ? cfg.dot : "bg-muted-foreground")}
      />
      {cfg.label} · {connected ? "connected" : "unavailable"}
    </span>
  )
}

// ─── Thread list item ─────────────────────────────────────────────────────────

function ThreadItem({ conv, active, onClick }: {
  conv: Conversation; active: boolean; onClick: () => void
}) {
  const name = displayName(conv)
  const cfg = channelCfg(conv.channel)
  const meta = phoneMeta(conv.phone)
  const bg = avatarColor(name)

  const preview = conv.last_message_body
    ? (conv.last_sender === "staff" ? `You: ${conv.last_message_body}` : conv.last_message_body)
    : ""

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/30",
        active ? "bg-[#FAF4EF]" : "hover:bg-muted/30",
      )}
    >
      {/* Avatar with channel dot */}
      <div className="relative shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: bg }}
        >
          {initials(name)}
        </div>
        {/* Channel dot — bottom-left corner */}
        <span
          className={cn("absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-card", cfg.dot)}
        />
      </div>

      <div className="min-w-0 flex-1">
        {/* Name + flag + time */}
        <div className="flex items-center justify-between gap-1">
          <span className="flex items-center gap-1 text-[13.5px] font-semibold text-foreground">
            <span className="truncate max-w-[120px]">{name}</span>
            {meta?.flag && <span className="text-[13px]">{meta.flag}</span>}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(conv.last_message_at)}</span>
        </div>
        {/* Preview + unread */}
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[12px] text-muted-foreground max-w-[160px]">
            {preview || conv.subject || ""}
          </p>
          {conv.unread_count > 0 && (
            <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isGuest = msg.sender === "guest"
  const isAI    = msg.sender === "ai"
  const isStaff = msg.sender === "staff"

  return (
    <div className={cn("mb-3 flex gap-2", isGuest ? "justify-start" : "justify-end")}>
      <div className="max-w-[70%]">
        <div className={cn(
          "rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed",
          isGuest && "bg-card border border-border/60 text-foreground rounded-tl-sm",
          isAI    && "bg-blue-50 text-blue-900 border border-blue-100 rounded-tr-sm",
          isStaff && "bg-primary text-white rounded-tr-sm",
        )}>
          {msg.body}
        </div>
        <p className={cn(
          "mt-1 text-[10.5px] text-muted-foreground",
          isGuest ? "pl-1" : "pr-1 text-right",
        )}>
          {isAI && "✦ AI · "}{formatTime(msg.created_at)}
        </p>
      </div>
    </div>
  )
}

// ─── Channel filter chip ──────────────────────────────────────────────────────

function FilterChip({
  label, dotClass, active, count, onClick,
}: {
  label: string; dotClass?: string; active: boolean; count?: number; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {dotClass && <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />}
      {label}
      {count != null && count > 0 && (
        <span className="rounded-full bg-primary/20 px-1 text-[9px] font-bold text-primary">{count}</span>
      )}
    </button>
  )
}

// ─── Main AI Inbox ────────────────────────────────────────────────────────────

export function AIInbox() {
  const { data: conversations = [], isLoading: convsLoading } = useConversations()
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<"all" | "whatsapp" | "instagram" | "facebook">("all")
  const [draft, setDraft]             = useState("")
  const [sending, setSending]         = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selected = conversations.find((c) => c.id === selectedId) ?? null
  const { data: messages = [], isLoading: msgsLoading } = useMessages(selectedId)
  useGuestReservations(selected?.phone ?? null, selected?.email ?? null) // preload for future panel
  const sendMsg = useSendInboxMessage()
  const resolve = useResolveConversation()

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id)
    }
  }, [conversations, selectedId])

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const filtered = useMemo(() => {
    if (channelFilter === "all") return conversations.filter((c) => c.status !== "resolved")
    if (channelFilter === "instagram") return conversations.filter((c) => c.channel === "instagram")
    if (channelFilter === "facebook")  return conversations.filter((c) => c.channel === "facebook" || c.channel === "messenger")
    return conversations.filter((c) => c.channel === channelFilter)
  }, [conversations, channelFilter])

  // AI suggested reply = last AI message in thread
  const suggestedReply = useMemo(() => {
    return [...messages].reverse().find((m) => m.sender === "ai") ?? null
  }, [messages])

  // Booking intent detection
  const detectedIntent = useMemo(() => detectIntent(messages), [messages])

  const handleSend = useCallback(async () => {
    if (!draft.trim() || !selectedId || sending) return
    setSending(true)
    try {
      await sendMsg.mutateAsync({ conversation_id: selectedId, body: draft.trim() })
      setDraft("")
      textareaRef.current?.focus()
    } finally {
      setSending(false)
    }
  }, [draft, selectedId, sending, sendMsg])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const useSuggested = () => {
    if (suggestedReply) {
      setDraft(suggestedReply.body)
      textareaRef.current?.focus()
    }
  }

  const selectedMeta = selected ? phoneMeta(selected.phone) : null
  const selectedCfg  = selected ? channelCfg(selected.channel) : null

  if (convsLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading inbox…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header banner ── */}
      <div className="rounded-xl border border-[#E7C8B1] bg-[#FAF4EF] px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[14px] font-bold text-foreground">Unified Meta inbox</span>
          <span className="text-[13px] text-muted-foreground">
            AI captures booking intent and drafts replies in the guest's language.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill channel="whatsapp"  connected={true} />
          <StatusPill channel="facebook"  connected={true} />
          <StatusPill channel="instagram" connected={true} />
          <StatusPill channel="email"     connected={false} />
        </div>
      </div>

      {/* ── 2-pane inbox ── */}
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Sparkles className="h-10 w-10 opacity-20" />
          <div className="text-center">
            <p className="text-[14px] font-semibold">No conversations yet</p>
            <p className="text-[12px]">WhatsApp, Instagram, Messenger, and email messages appear here automatically.</p>
          </div>
        </div>
      ) : (
        <div className="flex overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm" style={{ height: "calc(100vh - 340px)", minHeight: 520 }}>
          {/* ─── Left: Thread list ─── */}
          <div className="flex w-[320px] shrink-0 flex-col border-r border-border/60">
            {/* Channel filter chips */}
            <div className="flex flex-wrap gap-1.5 border-b border-border/60 p-3">
              <FilterChip label="All" active={channelFilter === "all"} onClick={() => setChannelFilter("all")}
                count={conversations.filter((c) => c.unread_count > 0).length} />
              <FilterChip label="WhatsApp" dotClass="bg-[#25D366]" active={channelFilter === "whatsapp"}
                onClick={() => setChannelFilter("whatsapp")}
                count={conversations.filter((c) => c.channel === "whatsapp" && c.unread_count > 0).length} />
              <FilterChip label="Messenger" dotClass="bg-[#1877F2]" active={channelFilter === "facebook"}
                onClick={() => setChannelFilter("facebook")}
                count={conversations.filter((c) => c.channel === "facebook" && c.unread_count > 0).length} />
              <FilterChip label="Instagram" dotClass="bg-[#E1306C]" active={channelFilter === "instagram"}
                onClick={() => setChannelFilter("instagram")}
                count={conversations.filter((c) => c.channel === "instagram" && c.unread_count > 0).length} />
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-[12.5px] text-muted-foreground">No conversations</p>
              ) : (
                filtered.map((conv) => (
                  <ThreadItem key={conv.id} conv={conv} active={conv.id === selectedId}
                    onClick={() => setSelectedId(conv.id)} />
                ))
              )}
            </div>
          </div>

          {/* ─── Right: Message pane ─── */}
          <div className="flex flex-1 flex-col min-w-0">
            {selected && selectedCfg ? (
              <>
                {/* Guest header */}
                <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold text-white"
                      style={{ background: avatarColor(displayName(selected)) }}
                    >
                      {initials(displayName(selected))}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-foreground">{displayName(selected)}</span>
                        {selectedMeta?.flag && <span className="text-[14px]">{selectedMeta.flag}</span>}
                        {/* Channel pill */}
                        <span
                          className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            borderColor: selectedCfg.color + "50",
                            background: selectedCfg.color + "15",
                            color: selectedCfg.color,
                          }}
                        >
                          ● {selectedCfg.label}
                        </span>
                      </div>
                      {selectedMeta && (
                        <p className="text-[12px] text-muted-foreground">
                          {selectedMeta.country} · {selectedMeta.lang}
                        </p>
                      )}
                      {!selectedMeta && selected.email && (
                        <p className="text-[12px] text-muted-foreground">{selected.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selected.status !== "resolved" && (
                      <button
                        type="button"
                        onClick={() => resolve.mutate(selected.id)}
                        disabled={resolve.isPending}
                        className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Resolve
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Create reservation
                    </button>
                  </div>
                </div>

                {/* AI detected intent banner */}
                {detectedIntent && messages.length > 0 && (
                  <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span className="text-[12.5px] text-amber-900">
                      <strong>AI detected intent:</strong> {detectedIntent}
                    </span>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {msgsLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.filter((m) => m.sender !== "ai").length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-[12.5px] text-muted-foreground">No messages yet</p>
                    </div>
                  ) : (
                    <>
                      {messages
                        .filter((m) => m.sender !== "ai") // AI replies shown in suggested box, not in thread
                        .map((msg) => <Bubble key={msg.id} msg={msg} />)}
                      <div ref={bottomRef} />
                    </>
                  )}
                </div>

                {/* AI suggested reply */}
                {suggestedReply && selected.status !== "resolved" && (
                  <div className="mx-3 mb-2 rounded-xl border border-[#E7C8B1] bg-[#FAF4EF] p-3.5">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-amber-700" />
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800">
                        AI Suggested Reply
                      </span>
                    </div>
                    <p className="mb-3 text-[13px] leading-relaxed text-foreground">{suggestedReply.body}</p>
                    <button
                      type="button"
                      onClick={useSuggested}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Use
                    </button>
                  </div>
                )}

                {/* Compose */}
                {selected.status !== "resolved" ? (
                  <div className="border-t border-border/60 p-3">
                    <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2">
                      <textarea
                        ref={textareaRef}
                        rows={2}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Reply to ${displayName(selected)}…`}
                        className="flex-1 resize-none bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={!draft.trim() || sending}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-opacity disabled:opacity-40 hover:bg-primary/90"
                      >
                        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send
                      </button>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1 px-1 text-[10.5px] text-muted-foreground">
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", channelCfg(selected.channel).dot)}
                      />
                      Sends via {selectedCfg.label} · Shift+Enter for new line
                    </p>
                  </div>
                ) : (
                  <div className="border-t border-border/60 px-4 py-3 text-center">
                    <p className="text-[12px] text-muted-foreground">
                      Thread resolved ·{" "}
                      <button
                        type="button"
                        className="underline hover:text-foreground"
                        onClick={() => resolve.mutate(selected.id)}
                      >
                        Reopen
                      </button>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  <p className="text-[13px]">Select a conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
