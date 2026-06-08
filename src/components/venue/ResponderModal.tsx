import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { CsvReservation } from "@/hooks/useReservationsCsv"
import { useRespondToGuest, type RespondType } from "@/hooks/useWebFormReservations"
import {
  X, Check, MessageCircle, Ban, ArrowRight, RefreshCw,
  Calendar, Clock, Users, Mail, CheckCircle, MessageSquare,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplyType {
  id: RespondType
  label: string
  color: string
  blurb: string
  icon: React.ReactNode
  template: (r: CsvReservation, reason?: string) => string
}

const firstName = (name: string | null) =>
  (name ?? "there").trim().split(/\s+/)[0]

const guestLabel = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`

const formatDateLong = (iso: string | null) => {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const REPLY_TYPES: ReplyType[] = [
  {
    id: "confirm",
    label: "Confirm",
    color: "#2e7a52",
    blurb: "Approve the booking and let the guest know.",
    icon: <Check className="h-3.5 w-3.5" />,
    template: (r) =>
      `Hi ${firstName(r.name)},\n\nGreat news! Your reservation at The Roof for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "—"} is confirmed. We look forward to hosting you.\n\nWith Love,\nThe Roof Da Nang`,
  },
  {
    id: "followup",
    label: "Follow up",
    color: "#2c5f9e",
    blurb: "Ask a question — e.g. a request you can't confirm yet.",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    template: (r) =>
      `Hi ${firstName(r.name)},\n\nThank you for your reservation request for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "—"}.${r.specialRequests ? ` Regarding your request: "${r.specialRequests}" — we can't guarantee it for that time slot.` : ""} Could we offer you an alternative? Reply here and we'll hold your table.\n\nWith Love,\nThe Roof Da Nang`,
  },
  {
    id: "decline",
    label: "Decline",
    color: "#b83232",
    blurb: "Decline the booking with a short reason.",
    icon: <Ban className="h-3.5 w-3.5" />,
    template: (r, reason) =>
      `Hi ${firstName(r.name)},\n\nThank you for thinking of The Roof. Unfortunately we're unable to accommodate your reservation for ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "—"}. ${reason ? `${reason}. ` : ""}We're sorry to miss you and hope to welcome you another time.\n\nWith Love,\nThe Roof Da Nang`,
  },
]

const REPLY_BY_ID = Object.fromEntries(REPLY_TYPES.map((t) => [t.id, t]))

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AV_COLORS = ["#9a6f2e", "#c74c3c", "#2e7a52", "#2c5f9e", "#6a4fa3", "#80591f"]
function Avatar({ name, size = 42 }: { name: string | null; size?: number }) {
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
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: AV_COLORS[idx], fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  )
}

// ─── Channel chip ─────────────────────────────────────────────────────────────

function ChannelChip({
  icon,
  label,
  detail,
  on,
  disabled,
  onToggle,
}: {
  icon: React.ReactNode
  label: string
  detail: string
  on: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={cn(
        "flex flex-1 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && on && "border-amber-200 bg-amber-50",
        !disabled && !on && "border-border bg-surface hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          on && !disabled ? "bg-primary text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-foreground">{label}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {disabled ? "Not on file" : detail}
        </div>
      </div>
      <div
        className={cn(
          "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded",
          on && !disabled ? "bg-primary border-primary" : "border-border bg-transparent",
          "border",
        )}
        style={{ width: 18, height: 18 }}
      >
        {on && !disabled && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
    </button>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface ResponderModalProps {
  reservation: CsvReservation | null
  onClose: () => void
}

export function ResponderModal({ reservation: r, onClose }: ResponderModalProps) {
  const [type, setType] = useState<RespondType>("confirm")
  const [reason, setReason] = useState("")
  const [msg, setMsg] = useState("")
  const [waOn, setWaOn] = useState(true)
  const [emailOn, setEmailOn] = useState(true)
  const [sent, setSent] = useState(false)
  const [shown, setShown] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const respondTo = useRespondToGuest()

  const hasPhone = !!(r?.phone)
  const hasEmail = !!(r?.email)

  // Reset state when reservation changes
  useEffect(() => {
    if (r) {
      setType("confirm")
      setReason("")
      setSent(false)
      setWaOn(hasPhone)
      setEmailOn(hasEmail)
      requestAnimationFrame(() => setShown(true))
    } else {
      setShown(false)
    }
  }, [r?.reservationSystemId])

  // Regenerate template on type/reason change
  useEffect(() => {
    if (!r) return
    setMsg(REPLY_BY_ID[type].template(r, reason))
  }, [type, reason, r?.reservationSystemId])

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && r) onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [r, onClose])

  if (!r) return null

  const selectedChannels = [waOn && "WhatsApp", emailOn && "Email"].filter(Boolean) as string[]
  const needsReason = type === "decline"
  const canSend =
    selectedChannels.length > 0 &&
    msg.trim().length > 0 &&
    (!needsReason || reason.trim().length > 0)

  const handleSend = async () => {
    if (!r.reservationSystemId || !r.reservationSystemToken) return
    await respondTo.mutateAsync({
      id: r.reservationSystemId,
      token: r.reservationSystemToken,
      type,
      message: msg.trim(),
      reason: needsReason ? reason.trim() : undefined,
      channels: selectedChannels,
    })
    setSent(true)
    setTimeout(() => onClose(), 1300)
  }

  const rt = REPLY_BY_ID[type]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(26,22,18,.4)] transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
      />

      {/* Modal */}
      <div
        className="relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_8px_28px_rgba(26,22,18,.12),0_2px_6px_rgba(26,22,18,.06)]"
        style={{
          maxHeight: "90vh",
          transform: shown ? "translateY(0) scale(1)" : "translateY(8px) scale(.98)",
          opacity: shown ? 1 : 0,
          transition: "transform .24s cubic-bezier(.32,.72,0,1), opacity .2s",
        }}
      >
        {sent ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center gap-4 px-8 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle className="h-7 w-7" />
            </div>
            <div className="text-lg font-bold">Reply sent</div>
            <div className="max-w-xs text-[13.5px] text-muted-foreground">
              Your {rt.label.toLowerCase()} message was sent to {firstName(r.name)} via{" "}
              {selectedChannels.join(" & ")}.
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600">
              <Clock className="mr-1 inline h-3 w-3" />
              Now awaiting their reply
            </span>
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
              <Avatar name={r.name} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold">Respond to {r.name}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateLong(r.dateOfReservation)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {r.time ?? "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {guestLabel(r.numberOfGuests)}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
              {/* Special requests callout */}
              {r.specialRequests && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] italic">
                  <span className="mt-0.5 shrink-0 text-primary">✦</span>
                  <span>
                    <b className="not-italic font-semibold">Guest request:</b> {r.specialRequests}
                  </span>
                </div>
              )}

              {/* Reply type picker */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  How do you want to reply?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {REPLY_TYPES.map((t) => {
                    const active = type === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        className="flex flex-col items-start gap-1.5 rounded-xl p-3 text-left transition-colors"
                        style={{
                          border: `1.5px solid ${active ? t.color : "var(--border)"}`,
                          background: active ? t.color + "12" : "var(--card)",
                        }}
                      >
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-lg"
                          style={{
                            background: active ? t.color : "var(--muted)",
                            color: active ? "#fff" : "var(--muted-foreground)",
                          }}
                        >
                          {t.icon}
                        </div>
                        <span
                          className="text-[13px] font-bold"
                          style={{ color: active ? t.color : "var(--foreground)" }}
                        >
                          {t.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{rt.blurb}</p>
              </div>

              {/* Decline reason */}
              {needsReason && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Reason for declining <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. fully booked for that time slot"
                    className={cn(
                      "w-full rounded-lg border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-ring",
                      reason.trim() ? "border-border" : "border-red-200",
                    )}
                  />
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    Included in the guest message and saved to the activity log.
                  </p>
                </div>
              )}

              {/* Message textarea */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Message
                  </span>
                  <button
                    type="button"
                    onClick={() => setMsg(rt.template(r, reason))}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[11.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reset
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-xl border border-border bg-background p-3 text-[13px] leading-relaxed outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Channel chips */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Send via
                </p>
                <div className="flex gap-2">
                  <ChannelChip
                    icon={<MessageCircle className="h-4 w-4" />}
                    label="WhatsApp"
                    detail={r.phone ?? ""}
                    on={waOn}
                    disabled={!hasPhone}
                    onToggle={() => setWaOn((v) => !v)}
                  />
                  <ChannelChip
                    icon={<Mail className="h-4 w-4" />}
                    label="Email"
                    detail={r.email ?? ""}
                    on={emailOn}
                    disabled={!hasEmail}
                    onToggle={() => setEmailOn((v) => !v)}
                  />
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center gap-3 border-t border-border/60 px-5 py-3.5">
              <p className="flex-1 text-[11.5px] text-muted-foreground">
                {selectedChannels.length > 0
                  ? `Will mark as "responded · awaiting reply".`
                  : "Pick at least one channel."}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSend || respondTo.isPending}
                onClick={handleSend}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors",
                  canSend && !respondTo.isPending
                    ? "hover:bg-primary/90"
                    : "cursor-not-allowed opacity-50",
                )}
              >
                <ArrowRight className="h-4 w-4" />
                {selectedChannels.length > 0 ? `Send via ${selectedChannels.join(" & ")}` : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
