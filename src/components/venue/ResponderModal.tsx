import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { CsvReservation } from "@/hooks/useReservationsCsv"
import { useRespondToGuest, type RespondType } from "@/hooks/useWebFormReservations"
import {
  X, Check, MessageCircle, ArrowRight, RefreshCw,
  Calendar, Clock, Users, Mail, CheckCircle, DoorOpen,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type Lang = "en" | "vi"

interface ReplyOption {
  id: string
  respondType: RespondType
  table?: string            // optional seating assignment, e.g. "Seaview"
  label: string
  color: string
  blurb: string
  icon: React.ReactNode
  /** Reason written to the activity log. No option asks staff to type one. */
  logReason?: string
  template: Record<Lang, (r: CsvReservation) => string>
}

// Guest-facing contact. Matches the number already printed in the reservation
// confirmation emails (reservation-system/supabase/functions/_shared/email.ts).
const WHATSAPP = "+84 097 35 35 334"

// Seaview tables seat a maximum of 3. Must stay in step with the booking form
// (reservation-system/framer/ReservationForm.jsx), which tells guests the same.
const SEAVIEW_MAX_PAX = 3
const isSeaviewEligible = (r: CsvReservation) => r.numberOfGuests <= SEAVIEW_MAX_PAX

const firstName = (name: string | null) =>
  (name ?? "there").trim().split(/\s+/)[0]

const firstNameVi = (name: string | null) =>
  (name ?? "bạn").trim().split(/\s+/)[0]

const guestLabel = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`

const guestLabelVi = (n: number) => `${n} khách`

const formatDateLong = (iso: string | null) => {
  if (!iso) return "TBC"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const formatDateLongVi = (iso: string | null) => {
  if (!iso) return "chưa xác định"
  const [y, m, d] = iso.split("-").map(Number)
  return `ngày ${d} tháng ${m}, ${y}`
}

const OPT: Record<string, ReplyOption> = {
  confirm_seaview: {
    id: "confirm_seaview",
    respondType: "confirm",
    table: "Seaview",
    label: "Accept · Seaview",
    color: "#2e7a52",
    blurb: "Confirm with a seaview table, the best seat in the house.",
    icon: <Check className="h-3.5 w-3.5" />,
    template: {
      en: (r) =>
        `Hi ${firstName(r.name)},\n\nYour table at The Roof is confirmed for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "TBC"}. We've saved you a seaview table.\n\nWe hold your table for 15 minutes from your reservation time. See you soon!\n\nWith Love,\nThe Roof Da Nang`,
      vi: (r) =>
        `Chào ${firstNameVi(r.name)},\n\nBàn của bạn tại The Roof đã được xác nhận cho ${guestLabelVi(r.numberOfGuests)} vào ${formatDateLongVi(r.dateOfReservation)} lúc ${r.time ?? "chưa xác định"}. Chúng mình đã giữ cho bạn một bàn view biển.\n\nChúng mình giữ bàn trong 15 phút kể từ giờ đặt. Hẹn gặp bạn!\n\nThân mến,\nThe Roof Đà Nẵng`,
    },
  },
  confirm_sofa: {
    id: "confirm_sofa",
    respondType: "confirm",
    label: "Accept · Sofa/No Note",
    color: "#2c7a86",
    blurb: "Confirm without promising a specific seat.",
    icon: <Check className="h-3.5 w-3.5" />,
    template: {
      en: (r) =>
        `Hi ${firstName(r.name)},\n\nYour table at The Roof is confirmed for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "TBC"}.\n\nWe hold your table for 15 minutes from your reservation time. See you soon!\n\nWith Love,\nThe Roof Da Nang`,
      vi: (r) =>
        `Chào ${firstNameVi(r.name)},\n\nBàn của bạn tại The Roof đã được xác nhận cho ${guestLabelVi(r.numberOfGuests)} vào ${formatDateLongVi(r.dateOfReservation)} lúc ${r.time ?? "chưa xác định"}.\n\nChúng mình giữ bàn trong 15 phút kể từ giờ đặt. Hẹn gặp bạn!\n\nThân mến,\nThe Roof Đà Nẵng`,
    },
  },
  // Always offers the two ways back in: walk in, or ask us on WhatsApp.
  decline: {
    id: "decline",
    respondType: "decline",
    label: "Decline",
    color: "#b8752e",
    blurb: "Fully booked. Tells them to walk in or check other tables on WhatsApp.",
    icon: <DoorOpen className="h-3.5 w-3.5" />,
    logReason: "Fully booked, walk-in and WhatsApp options offered",
    template: {
      en: (r) =>
        `Hi ${firstName(r.name)},\n\nThank you for your request for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "TBC"}. ${
          isSeaviewEligible(r)
            ? "Our seaview tables are fully booked for that time, so we can't hold one for you."
            : "We're fully booked for reservations at that time, so we can't hold a table for you."
        }\n\nYou can still join us two ways:\n\n1. Walk in at that time. We keep tables for walk-in guests and will seat you as soon as one frees up.\n\n2. Text us on WhatsApp at ${WHATSAPP} and we'll check what's open in our bar and indoor areas.\n\nHope to see you!\n\nWith Love,\nThe Roof Da Nang`,
      vi: (r) =>
        `Chào ${firstNameVi(r.name)},\n\nCảm ơn bạn đã gửi yêu cầu đặt bàn cho ${guestLabelVi(r.numberOfGuests)} vào ${formatDateLongVi(r.dateOfReservation)} lúc ${r.time ?? "chưa xác định"}. ${
          isSeaviewEligible(r)
            ? "Các bàn view biển đã kín chỗ vào khung giờ này nên chúng mình chưa thể giữ bàn cho bạn."
            : "Chúng mình đã kín chỗ đặt bàn trước vào khung giờ này nên chưa thể giữ bàn cho bạn."
        }\n\nBạn vẫn có thể ghé chơi theo hai cách:\n\n1. Đến trực tiếp vào giờ đó. Chúng mình luôn dành bàn cho khách đến trực tiếp và sẽ sắp xếp chỗ ngay khi có bàn trống.\n\n2. Nhắn WhatsApp cho chúng mình qua số ${WHATSAPP}, chúng mình sẽ kiểm tra các bàn còn trống ở khu quầy bar và khu trong nhà.\n\nHẹn gặp bạn!\n\nThân mến,\nThe Roof Đà Nẵng`,
    },
  },
}

// Seaview is only offered to parties we can actually seat there.
function optionsFor(r: CsvReservation): ReplyOption[] {
  return isSeaviewEligible(r)
    ? [OPT.confirm_seaview, OPT.confirm_sofa, OPT.decline]
    : [OPT.confirm_sofa, OPT.decline]
}

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

// ─── Language toggle ──────────────────────────────────────────────────────────

const LANGS: { id: Lang; label: string; title: string }[] = [
  { id: "en", label: "EN", title: "Write this reply in English" },
  { id: "vi", label: "VI", title: "Viết phản hồi bằng tiếng Việt" },
]

function LangToggle({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex items-center rounded-md border border-border p-0.5" role="group" aria-label="Reply language">
      {LANGS.map((l) => {
        const active = value === l.id
        return (
          <button
            key={l.id}
            type="button"
            title={l.title}
            aria-pressed={active}
            onClick={() => onChange(l.id)}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-bold tracking-wide transition-colors",
              active
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface ResponderModalProps {
  reservation: CsvReservation | null
  onClose: () => void
}

export function ResponderModal({ reservation: r, onClose }: ResponderModalProps) {
  const [selectedId, setSelectedId] = useState<string>("confirm")
  const [lang, setLang] = useState<Lang>("en")
  const [msg, setMsg] = useState("")
  const [waOn, setWaOn] = useState(true)
  const [emailOn, setEmailOn] = useState(true)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const respondTo = useRespondToGuest()

  const hasPhone = !!(r?.phone)
  const hasEmail = !!(r?.email)

  // Reset state when reservation changes
  useEffect(() => {
    if (r) {
      setSelectedId(optionsFor(r)[0].id)
      setLang("en")
      setSent(false)
      setSendError(null)
      setWaOn(hasPhone)
      setEmailOn(hasEmail)
      requestAnimationFrame(() => setShown(true))
    } else {
      setShown(false)
    }
  }, [r?.reservationSystemId])

  // Regenerate template on option/language change
  useEffect(() => {
    if (!r) return
    const opts = optionsFor(r)
    const o = opts.find((x) => x.id === selectedId) ?? opts[0]
    setMsg(o.template[lang](r))
  }, [selectedId, lang, r?.reservationSystemId])

  // Grow the box to the full message so nothing is hidden behind a scrollbar.
  // The modal body scrolls instead if the message is very long.
  // Measured in a rAF and re-run on `shown`/resize: measuring before the modal
  // has been laid out reads a near-zero width, which wraps the text into
  // hundreds of lines and locks in a wildly too-tall box.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const fit = () => {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
    const raf = requestAnimationFrame(fit)
    window.addEventListener("resize", fit)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", fit)
    }
  }, [msg, sent, shown])

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && r) onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [r, onClose])

  if (!r) return null

  const options = optionsFor(r)
  const opt = options.find((o) => o.id === selectedId) ?? options[0]

  const selectedChannels = [waOn && "WhatsApp", emailOn && "Email"].filter(Boolean) as string[]
  const canSend = selectedChannels.length > 0 && msg.trim().length > 0

  // Never fail silently. Both paths below used to return/throw with no UI change,
  // which read to staff as a dead Send button while the guest got nothing.
  const handleSend = async () => {
    setSendError(null)
    if (!r.reservationSystemId || !r.reservationSystemToken) {
      setSendError("This booking has no reservation-system reference, so it can't be replied to here.")
      return
    }
    try {
      await respondTo.mutateAsync({
        id: r.reservationSystemId,
        token: r.reservationSystemToken,
        type: opt.respondType,
        table: opt.table,
        message: msg.trim(),
        reason: opt.logReason,
        channels: selectedChannels,
        language: lang,
      })
    } catch (err: any) {
      console.error("[ResponderModal] respond-to-guest failed:", err)
      setSendError(err?.message || "Could not send the reply. Nothing was sent to the guest.")
      return
    }
    setSent(true)
    setTimeout(() => onClose(), 1300)
  }

  const rt = opt

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
                <div className={cn("grid gap-2", options.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                  {options.map((t) => {
                    const active = opt.id === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        // Colours come from Tailwind classes, not raw var(--x): the theme
                        // vars are bare RGB triplets, so `solid var(--border)` is invalid
                        // CSS and renders no border at all.
                        className={cn(
                          "flex flex-col items-start gap-1.5 rounded-xl border-[1.5px] p-3 text-left transition-colors",
                          active ? "border-transparent" : "border-border bg-card hover:bg-muted/40",
                        )}
                        style={active ? { borderColor: t.color, background: t.color + "14" } : undefined}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg",
                            !active && "bg-muted text-muted-foreground",
                          )}
                          style={active ? { background: t.color, color: "#fff" } : undefined}
                        >
                          {t.icon}
                        </div>
                        <span
                          className={cn("text-[13px] font-bold", !active && "text-foreground")}
                          style={active ? { color: t.color } : undefined}
                        >
                          {t.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{rt.blurb}</p>
              </div>

              {/* Message textarea */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Message
                  </span>
                  <div className="flex items-center gap-1.5">
                    <LangToggle value={lang} onChange={setLang} />
                    <button
                      type="button"
                      onClick={() => setMsg(rt.template[lang](r))}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-[11.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reset
                    </button>
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  className="w-full resize-none overflow-hidden rounded-xl border border-border bg-background p-3 text-[13px] leading-relaxed outline-none focus:ring-1 focus:ring-ring"
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
              <p
                className={cn(
                  "flex-1 text-[11.5px]",
                  sendError ? "font-semibold text-red-600" : "text-muted-foreground",
                )}
              >
                {sendError
                  ? sendError
                  : selectedChannels.length > 0
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
