import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useReservationsCsv, type CsvReservation } from "@/hooks/useReservationsCsv"
import { useWebFormReservations, useSendReminder, useSendGuestMessage, useCancelReservation } from "@/hooks/useWebFormReservations"
import { useReservations, useDeleteReservation } from "@/hooks/useReservations"
import { ReservationFormSheet } from "@/components/venue/ReservationFormSheet"
import { InlineComment } from "@/components/venue/ReservationPanel"
import { ResponderModal } from "@/components/venue/ResponderModal"
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
  Bell,
  Send,
  CheckCircle2,
  MessageCircle,
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
  // Web form / DB entries: occasion holds the booking channel ('website', 'phone', 'whatsapp', etc.)
  if (r.occasion && SOURCE_BADGE[r.occasion]) return SOURCE_BADGE[r.occasion]
  // Legacy hint: phone field contains 'zalo' or 'wa'
  const phone = r.phone ?? ""
  if (phone.toLowerCase().includes("zalo") || phone.toLowerCase().includes("wa")) return SOURCE_BADGE.whatsapp
  // No reservationSystemId = manually entered (CSV / phone booking) → Phone
  if (!r.reservationSystemId) return SOURCE_BADGE.phone
  // Web form entry with no recognised source → Website
  return SOURCE_BADGE.website
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ReservationRow({
  r,
  canEdit,
  onEdit,
  onRespond,
}: {
  r: CsvReservation
  canEdit: boolean
  onEdit: (r: CsvReservation) => void
  onRespond: (r: CsvReservation) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [composeText, setComposeText] = useState("")
  const [composeChannel, setComposeChannel] = useState<'email' | 'whatsapp'>('email')
  const [reminderSent, setReminderSent] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const deleteRes = useDeleteReservation()
  const cancelRes = useCancelReservation()
  const sendReminder = useSendReminder()
  const sendMessage = useSendGuestMessage()
  const badge = sourceBadge(r)
  const dbId = r.dbId ?? null
  const alreadyClosed = r.bookingStatus === 'cancelled' || r.bookingStatus === 'declined' || r.bookingStatus === 'noshow'
  const canCancel = !!r.reservationSystemId && !alreadyClosed
  const isPending = r.bookingStatus === 'pending'
  const isConfirmed = r.bookingStatus === 'accepted'
  const isWebForm = !!r.reservationSystemId
  const hasEmail = !!r.email
  const hasPhone = !!r.phone
  const hasResponded = !!r.respondedAt

  async function handleSendReminder() {
    if (!r.reservationSystemId || !r.reservationSystemToken) return
    await sendReminder.mutateAsync({ id: r.reservationSystemId, token: r.reservationSystemToken })
    setReminderSent(true)
    setTimeout(() => setReminderSent(false), 4000)
  }

  async function handleSendMessage() {
    if (!r.reservationSystemId || !r.reservationSystemToken || !composeText.trim()) return
    await sendMessage.mutateAsync({
      id: r.reservationSystemId,
      token: r.reservationSystemToken,
      body: composeText.trim(),
      channel: composeChannel,
    })
    setComposeText("")
    setMessageSent(true)
    setTimeout(() => setMessageSent(false), 4000)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!dbId) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    await deleteRes.mutateAsync(dbId)
    setConfirmDelete(false)
  }

  async function handleCancel() {
    if (!r.reservationSystemId || !r.reservationSystemToken || !cancelReason.trim()) return
    await cancelRes.mutateAsync({
      id: r.reservationSystemId,
      token: r.reservationSystemToken,
      reason: cancelReason.trim(),
      name: r.name,
      date: r.dateOfReservation,
      time: r.time,
      pax: r.numberOfGuests,
    })
    setCancelReason("")
    setShowCancel(false)
  }

  const monthLabel = r.dateOfReservation
    ? new Date(r.dateOfReservation + "T00:00:00").toLocaleDateString("en-US", { month: "short" })
    : "—"
  const dayLabel = r.dateOfReservation ? r.dateOfReservation.slice(8) : "—"

  return (
    <div className="border-b border-border last:border-0">
      {/* Main row: left content (expand trigger) + right actions (always tappable) */}
      <div className="flex items-stretch">
        {/* Left: date badge + details — tapping this area expands/collapses */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v) } }}
          className="flex flex-1 min-w-0 cursor-pointer items-start gap-2.5 px-3 py-2.5"
        >
          {/* Date badge — compact */}
          <div className="shrink-0 flex w-8 flex-col items-center rounded bg-muted/70 px-0 py-1 text-center">
            <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground leading-none">
              {monthLabel}
            </span>
            <span className="text-[15px] font-bold leading-tight text-foreground">
              {dayLabel}
            </span>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            {/* Name + badge on same line */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="truncate text-sm font-semibold text-foreground leading-snug">
                {r.name || "Unknown"}
              </span>
              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none", badge.cls)}>
                {badge.label}
              </span>
              {r.bookingStatus === 'pending' && !hasResponded && (
                <span
                  className="shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none"
                  style={{ border: "1px dashed #d8c08a", color: "#a06820", background: "transparent" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#c9a23f" }} />
                  Pending
                </span>
              )}
              {r.bookingStatus === 'pending' && hasResponded && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-blue-600">
                  <Clock className="h-2 w-2" />
                  Responded
                </span>
              )}
              {(r.bookingStatus === 'accepted' || !r.bookingStatus) && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✓ Confirmed
                </span>
              )}
              {r.bookingStatus === 'declined' && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none bg-red-50 text-red-600 border border-red-200">
                  Declined
                </span>
              )}
              {r.bookingStatus === 'cancelled' && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none bg-zinc-100 text-zinc-500 border border-zinc-200">
                  Cancelled
                </span>
              )}
              {r.bookingStatus === 'noshow' && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none bg-red-50 text-red-400 border border-red-200">
                  No Show
                </span>
              )}
              {r.responseType === 'confirm' && r.responseChannels?.includes('Guest self-confirm') && (
                <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none bg-emerald-600 text-white border border-emerald-700">
                  ✓ Guest confirmed
                </span>
              )}
            </div>
            {/* Meta: time · pax · table · phone */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5 shrink-0" />
                {r.time || "—"}
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5 shrink-0" />
                {r.numberOfGuests} pax
              </span>
              {r.table && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {r.table}
                  </span>
                </>
              )}
              {r.phone && (
                <>
                  <span className="text-border">·</span>
                  <a
                    href={`tel:${r.phone}`}
                    className="flex items-center gap-0.5 hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-2.5 w-2.5 shrink-0" />
                    {r.phone}
                  </a>
                </>
              )}
            </div>
            {/* Notes preview */}
            {!expanded && (r.specialRequests || r.notes?.trim()) && (
              <p className="mt-0.5 line-clamp-1 text-[10px] italic text-muted-foreground">
                {r.specialRequests ? `📝 ${r.specialRequests}` : `💬 ${r.notes}`}
              </p>
            )}
          </div>
        </div>

        {/* Right: Edit + chevron — completely separate from the expand area */}
        <div className="flex shrink-0 items-center gap-1 pr-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(r)}
              className="rounded border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors active:bg-muted hover:bg-muted hover:text-foreground"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground active:bg-muted hover:bg-muted"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="space-y-2 border-t border-border/40 bg-muted/20 px-3 pb-3 pt-2">
          <div className="grid grid-cols-1 gap-y-1 text-xs text-muted-foreground">
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
              <div><span className="font-medium text-foreground/70">Special requests: </span>{r.specialRequests}</div>
            )}
            {r.specialPackages && (
              <div><span className="font-medium text-foreground/70">Package: </span>{r.specialPackages}</div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Staff comment</p>
            <InlineComment dbId={dbId} currentNote={r.notes} canEdit={canEdit} />
          </div>
          {/* Respond button — web form reservations that are still pending */}
          {isPending && isWebForm && (
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => onRespond(r)}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                  hasResponded
                    ? "border border-border text-foreground hover:bg-muted"
                    : "bg-primary text-white hover:bg-primary/90",
                )}
              >
                <MessageCircle className="h-3 w-3" />
                {hasResponded ? "Resend / update" : "Respond"}
              </button>
            </div>
          )}

          {/* Send Reminder — confirmed web form reservations with email */}
          {isConfirmed && isWebForm && hasEmail && (
            <div className="flex items-center gap-2 pt-0.5">
              {reminderSent ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Reminder sent
                </span>
              ) : (
                <button
                  type="button"
                  disabled={sendReminder.isPending}
                  onClick={handleSendReminder}
                  className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  {sendReminder.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                  Send Reminder
                </button>
              )}
              {sendReminder.isError && (
                <span className="text-xs text-red-500">Failed — try again</span>
              )}
            </div>
          )}

          {/* Follow-up compose box — all web form reservations with contact info */}
          {isWebForm && (hasEmail || hasPhone) && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Follow-up message
              </p>
              <div className="flex items-center gap-1.5">
                <select
                  value={composeChannel}
                  onChange={(e) => setComposeChannel(e.target.value as 'email' | 'whatsapp')}
                  className="rounded border border-input bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {hasEmail && <option value="email">Email</option>}
                  {hasPhone && <option value="whatsapp">WhatsApp</option>}
                </select>
                <span className="text-[10px] text-muted-foreground truncate">
                  {composeChannel === 'email' ? r.email : r.phone}
                </span>
              </div>
              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                placeholder="Type your message…"
                rows={3}
                className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <div className="flex items-center justify-between">
                {messageSent ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Message sent
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {sendMessage.isError ? "Send failed — try again" : ""}
                  </span>
                )}
                <button
                  type="button"
                  disabled={sendMessage.isPending || !composeText.trim()}
                  onClick={handleSendMessage}
                  className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {sendMessage.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Cancel reservation (web-form) — requires a reason, moves to Declined & Lost */}
          {canEdit && canCancel && (
            <div className="border-t border-border/40 pt-2">
              {showCancel ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
                    Cancel reservation
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancelling (e.g. duplicate, guest cancelled by email)…"
                    rows={2}
                    autoFocus
                    className="w-full rounded border border-destructive/40 bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive resize-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    {cancelRes.isError && (
                      <span className="mr-auto text-[11px] text-destructive">Failed — try again</span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setShowCancel(false); setCancelReason("") }}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={cancelRes.isPending || !cancelReason.trim()}
                      className="flex items-center gap-1 rounded px-2.5 py-1 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {cancelRes.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Confirm cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCancel(true)}
                    className="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Cancel reservation
                  </button>
                </div>
              )}
            </div>
          )}

          {canEdit && dbId && (
            <div className="flex items-center justify-end gap-2 pt-0.5">
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
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card px-3 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">{label}</span>
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
        {count} bookings
      </span>
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
        {pax} guests
      </span>
    </div>
  )
}

// ─── Upcoming section header ───────────────────────────────────────────────────

function UpcomingDivider({ count, pax }: { count: number; pax: number }) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-primary/20 px-3 py-1.5" style={{ background: '#fdf6ee' }}>
      <Calendar className="h-3 w-3 shrink-0 text-primary" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Upcoming</span>
      <span className="rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
        {count} bookings · {pax} guests
      </span>
    </div>
  )
}

// ─── Date group header ─────────────────────────────────────────────────────────

function DateGroupHeader({ iso, todayIso }: { iso: string; todayIso: string }) {
  const days = daysBetween(todayIso, iso)
  const label = days === 1 ? "Tomorrow" : `In ${days} days`
  const formatted = formatDate(iso)
  return (
    <div className="flex items-center gap-2 border-b border-dashed border-border/60 bg-background px-3 py-1.5">
      <span className="text-[11px] font-semibold text-foreground">{formatted}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

// ─── Past section header ───────────────────────────────────────────────────────

function PastDivider({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="sticky top-0 z-20 flex w-full items-center gap-2 border-b border-border/60 bg-zinc-50 px-3 py-1.5 text-left transition-colors hover:bg-zinc-100"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Past (30 days)</span>
      <span className="rounded-full bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">
        {count}
      </span>
      <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
        {open ? (
          <>Hide <ChevronUp className="h-3 w-3" /></>
        ) : (
          <>Show <ChevronDown className="h-3 w-3" /></>
        )}
      </span>
    </button>
  )
}

// ─── Quick replies for "in discussion" reservations ───────────────────────────

const QUICK_REPLIES = [
  {
    id: "no_seaview",
    label: "No seaview tables",
    getMessage: (first: string) =>
      `Hi ${first}!\n\nUnfortunately we don't have any seaview tables left for your date. Would you like us to book a standard table instead?\n\nWith Love,\nThe Roof Da Nang`,
  },
  {
    id: "no_children",
    label: "No children after 7PM",
    getMessage: (first: string) =>
      `Hi ${first}!\n\nJust to let you know — we're unable to accommodate children after 7PM. Would an earlier time work for you, or would you like to adjust?\n\nWith Love,\nThe Roof Da Nang`,
  },
  {
    id: "bar_table",
    label: "Bar table only",
    getMessage: (first: string) =>
      `Hi ${first}!\n\nWe're fully booked on regular tables, but we have a great spot at the bar available. Would you be happy with a bar table? 🍹\n\nWith Love,\nThe Roof Da Nang`,
  },
] as const

function DiscussionRow({ r }: { r: CsvReservation }) {
  const [sentId, setSentId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const sendMessage = useSendGuestMessage()
  const firstName = (r.name ?? "there").split(/\s+/)[0]
  const hasPhone = !!r.phone
  const channel: "whatsapp" | "email" = hasPhone ? "whatsapp" : "email"

  const canSend = !!r.reservationSystemId && !!r.reservationSystemToken && (hasPhone || !!r.email)

  async function handleQuickReply(qr: (typeof QUICK_REPLIES)[number]) {
    if (!canSend) return
    setLoadingId(qr.id)
    try {
      await sendMessage.mutateAsync({
        id: r.reservationSystemId!,
        token: r.reservationSystemToken!,
        body: qr.getMessage(firstName),
        channel,
      })
      setSentId(qr.id)
      setTimeout(() => setSentId(null), 4000)
    } finally {
      setLoadingId(null)
    }
  }

  const formatted = r.dateOfReservation
    ? new Date(r.dateOfReservation + "T00:00:00").toLocaleDateString("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "—"

  return (
    <div className="border-b border-border/50 last:border-0 px-3 py-2.5">
      {/* Guest info */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span className="text-[13px] font-semibold text-foreground">{r.name || "Unknown"}</span>
        <span className="text-[11px] text-muted-foreground">
          {formatted} · {r.time || "—"} · {r.numberOfGuests} pax
        </span>
        {r.phone && (
          <a
            href={`tel:${r.phone}`}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
          >
            <Phone className="h-2.5 w-2.5" />
            {r.phone}
          </a>
        )}
      </div>
      {/* Quick-reply pills */}
      {canSend ? (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((qr) => {
            const isSent = sentId === qr.id
            const isLoading = loadingId === qr.id
            return (
              <button
                key={qr.id}
                type="button"
                disabled={!!loadingId || isSent}
                onClick={() => handleQuickReply(qr)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-default",
                  isSent
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60",
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : isSent ? (
                  <CheckCircle2 className="h-2.5 w-2.5" />
                ) : null}
                {isSent ? "Sent" : qr.label}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">No contact info — reply manually</p>
      )}
    </div>
  )
}

function DiscussionDivider({ count }: { count: number }) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-blue-200/60 bg-blue-50/80 px-3 py-1.5">
      <MessageCircle className="h-3 w-3 shrink-0 text-blue-500" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">In Discussion</span>
      <span className="rounded-full bg-blue-100 border border-blue-200 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600">
        {count}
      </span>
    </div>
  )
}

// ─── Status filter type ────────────────────────────────────────────────────────

type StatusFilter = "all" | "pending" | "accepted" | "declined"

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "pending",  label: "Pending" },
  { id: "accepted", label: "Confirmed" },
  { id: "declined", label: "Declined" },
]

// ─── Main component ────────────────────────────────────────────────────────────

export function ReservationsListView({ canEdit }: { canEdit: boolean }) {
  const todayIso = getTodayIso()
  const nextMonthIso = (() => {
    const d = new Date(todayIso + "T00:00:00")
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const { data: webFormAll = [], isLoading: webFormLoading } = useWebFormReservations()
  const { data: sheetAll = [], isLoading: sheetLoading } = useReservationsCsv()
  const { data: dbAll = [], isLoading: dbLoading } = useReservations(todayIso, nextMonthIso)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("accepted")
  const [formOpen, setFormOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [responderRes, setResponderRes] = useState<CsvReservation | null>(null)
  const [pastOpen, setPastOpen] = useState(false)

  // isLoading covers all three sources
  const csvLoading = webFormLoading || sheetLoading

  const allReservations = useMemo<CsvReservation[]>(() => {
    // Start with ALL web-form reservations (today + upcoming + past 30 days)
    const merged = [...webFormAll]
    const seenKeys = new Set(merged.map((r) => `${(r.name ?? "").toLowerCase()}|${r.dateOfReservation}|${(r.time ?? "").slice(0, 5)}`))

    // Add Google Sheets CSV reservations (all dates), de-duped by name+date+time
    for (const r of sheetAll) {
      const key = `${(r.name ?? "").toLowerCase()}|${r.dateOfReservation}|${(r.time ?? "").slice(0, 5)}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        merged.push(r)
      }
    }

    // Add database reservations (today + upcoming), de-duped
    for (const r of dbAll) {
      const key = `${r.customerName.toLowerCase()}|${r.reservationDate}|${r.reservationTime.slice(0, 5)}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
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
          mustHaves: null,
          status: r.reservationDate === todayIso ? "today" : "upcoming",
          bookingStatus: 'accepted' as const, // Manually entered = confirmed by definition
          dbId: r.id, // real HRM id — used to route edits back to the HRM table
        })
      }
    }

    return merged
  }, [webFormAll, sheetAll, dbAll, todayIso])

  const filtered = useMemo(() => {
    let list = allReservations
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) =>
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.specialRequests ?? "").toLowerCase().includes(q)
      )
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.bookingStatus === statusFilter)
    }
    return list
  }, [allReservations, search, statusFilter])

  // "In discussion" = pending reservations where we already sent a follow-up
  const discussionList = useMemo(
    () =>
      allReservations.filter(
        (r) => r.bookingStatus === "pending" && r.responseType === "followup" && r.respondedAt,
      ),
    [allReservations],
  )

  const todayList = filtered
    .filter((r) => r.dateOfReservation === todayIso)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
  const upcomingList = filtered.filter((r) => (r.dateOfReservation ?? "") > todayIso)
    .sort((a, b) => {
      const dc = (a.dateOfReservation ?? "").localeCompare(b.dateOfReservation ?? "")
      if (dc !== 0) return dc
      return (a.time ?? "").localeCompare(b.time ?? "")
    })
  const pastList = filtered.filter((r) => (r.dateOfReservation ?? "") < todayIso)
    .sort((a, b) => {
      // Most recent past first
      const dc = (b.dateOfReservation ?? "").localeCompare(a.dateOfReservation ?? "")
      if (dc !== 0) return dc
      return (b.time ?? "").localeCompare(a.time ?? "")
    })

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
  const isLoading = csvLoading || dbLoading || sheetLoading

  function handleEdit(r: CsvReservation) {
    // Route the edit to the backend the row actually came from, so changing a
    // time updates that record in place instead of inserting a duplicate.
    let origin: "hrm" | "website" | "csv"
    let id: string
    let reservationToken: string | undefined
    if (r.dbId) {
      origin = "hrm"; id = r.dbId
    } else if (r.reservationSystemId) {
      origin = "website"; id = r.reservationSystemId; reservationToken = r.reservationSystemToken
    } else {
      origin = "csv"; id = "" // legacy Google Sheet row — not editable here
    }

    setEditingReservation({
      id,
      origin,
      reservationToken,
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
      {/* Toolbar — search + add */}
      <div className="shrink-0 flex items-center gap-2 border-b border-border bg-muted/10 px-3 py-2">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-input bg-background py-1.5 pl-6 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <p className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
          {filtered.length} total
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => { setEditingReservation(null); setFormOpen(true) }}
            className="flex shrink-0 items-center gap-1 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>
      {/* Status filter chips */}
      <div className="shrink-0 flex items-center gap-1.5 border-b border-border/50 bg-muted/5 px-3 py-1.5 overflow-x-auto">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.id
          // Count per filter
          const count =
            f.id === "all" ? allReservations.length :
            allReservations.filter((r) => r.bookingStatus === f.id).length
          const colorActive =
            f.id === "pending"  ? "bg-amber-100 text-amber-800 border-amber-300" :
            f.id === "accepted" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
            f.id === "declined" ? "bg-red-100 text-red-700 border-red-300" :
            "bg-primary text-primary-foreground border-primary"
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                active
                  ? colorActive
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
              <span className={cn(
                "rounded-full px-1 text-[9px] font-bold",
                active ? "bg-white/30" : "bg-muted text-muted-foreground",
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Calendar className="h-7 w-7 opacity-30" />
            <p className="text-sm">
              {search ? "No matches" : statusFilter !== "all" ? `No ${statusFilter === "accepted" ? "confirmed" : statusFilter} reservations` : "No reservations"}
            </p>
          </div>
        ) : (
          <>
            {discussionList.length > 0 && (
              <section>
                <DiscussionDivider count={discussionList.length} />
                {discussionList.map((r, i) => (
                  <DiscussionRow key={`d-${i}`} r={r} />
                ))}
              </section>
            )}

            {todayList.length > 0 && (
              <section>
                <SectionDivider label="Today" count={todayList.length} pax={todayPax} />
                {todayList.map((r, i) => (
                  <ReservationRow key={`t-${i}`} r={r} canEdit={canEdit} onEdit={handleEdit} onRespond={setResponderRes} />
                ))}
              </section>
            )}

            {upcomingList.length > 0 && (
              <section>
                <UpcomingDivider count={upcomingList.length} pax={upcomingPax} />
                {Array.from(upcomingByDate.entries()).map(([date, rows]) => (
                  <div key={date}>
                    <DateGroupHeader iso={date} todayIso={todayIso} />
                    {rows.map((r, i) => (
                      <ReservationRow key={`u-${date}-${i}`} r={r} canEdit={canEdit} onEdit={handleEdit} onRespond={setResponderRes} />
                    ))}
                  </div>
                ))}
              </section>
            )}

            {pastList.length > 0 && (
              <section>
                <PastDivider count={pastList.length} open={pastOpen} onToggle={() => setPastOpen((v) => !v)} />
                {pastOpen && pastList.map((r, i) => (
                  <ReservationRow key={`p-${i}`} r={r} canEdit={canEdit} onEdit={handleEdit} onRespond={setResponderRes} />
                ))}
              </section>
            )}
          </>
        )}
      </div>

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

      <ResponderModal
        reservation={responderRes}
        onClose={() => setResponderRes(null)}
      />
    </div>
  )
}
