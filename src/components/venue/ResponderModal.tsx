import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { CsvReservation } from "@/hooks/useReservationsCsv"
import { useRespondToGuest, type RespondType } from "@/hooks/useWebFormReservations"
import {
  X, Check, MessageCircle, Ban, ArrowRight, RefreshCw,
  Calendar, Clock, Users, Mail, CheckCircle, MessageSquare, DoorOpen,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type Lang = "en" | "vi"

interface ReplyOption {
  id: string
  respondType: RespondType
  table?: string            // optional seating assignment, e.g. "Seaview" | "Bar Area"
  label: string
  color: string
  blurb: string
  icon: React.ReactNode
  /** When false the reason input is hidden and `logReason` is stored instead. */
  requiresReason?: boolean
  /** Reason written to the activity log when the staff isn't asked to type one. */
  logReason?: string
  template: Record<Lang, (r: CsvReservation, reason?: string) => string>
}

// Guest-facing contact. Matches the number already printed in the reservation
// confirmation emails (reservation-system/supabase/functions/_shared/email.ts).
const WHATSAPP = "+84 097 35 35 334"

// Parties under this size are the ones we can seat on a seaview table.
const SEAVIEW_MAX_PAX = 3
const isSeaviewEligible = (r: CsvReservation) => r.numberOfGuests < SEAVIEW_MAX_PAX

const firstName = (name: string | null) =>
  (name ?? "there").trim().split(/\s+/)[0]

const firstNameVi = (name: string | null) =>
  (name ?? "bạn").trim().split(/\s+/)[0]

const guestLabel = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`

const guestLabelVi = (n: number) => `${n} khách`

const formatDateLong = (iso: string | null) => {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const formatDateLongVi = (iso: string | null) => {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-").map(Number)
  return `ngày ${d} tháng ${m}, ${y}`
}

const OPT: Record<string, ReplyOption> = {
  confirm: {
    id: "confirm",
    respondType: "confirm",
    label: "Confirm",
    color: "#2e7a52",
    blurb: "Approve the booking and let the guest know.",
    icon: <Check className="h-3.5 w-3.5" />,
    template: {
      en: (r) =>
        `Hi ${firstName(r.name)},\n\nGreat news! Your reservation at The Roof for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "—"} is confirmed. We look forward to hosting you.\n\nWith Love,\nThe Roof Da Nang`,
      vi: (r) =>
        `Chào ${firstNameVi(r.name)},\n\nTin vui! Đặt bàn của bạn tại The Roof cho ${guestLabelVi(r.numberOfGuests)} vào ${formatDateLongVi(r.dateOfReservation)} lúc ${r.time ?? "—"} đã được xác nhận. Chúng mình rất mong được đón tiếp bạn.\n\nThân mến,\nThe Roof Đà Nẵng`,
    },
  },
  confirm_seaview: {
    id: "confirm_seaview",
    respondType: "confirm",
    table: "Seaview",
    label: "Confirm · Seaview",
    color: "#2e7a52",
    blurb: "Confirm with a seaview table — best seat in the house.",
    icon: <Check className="h-3.5 w-3.5" />,
    template: {
      en: (r) =>
        `Hi ${firstName(r.name)},\n\nWonderful news — your table at The Roof is confirmed for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "—"}, and we've saved you one of our seaview tables. The best seat in the house will be waiting for you.\n\nWe hold your table for 15 minutes from your reservation time. See you soon!\n\nWith Love,\nThe Roof Da Nang`,
      vi: (r) =>
        `Chào ${firstNameVi(r.name)},\n\nTin tuyệt vời — bàn của bạn tại The Roof đã được xác nhận cho ${guestLabelVi(r.numberOfGuests)} vào ${formatDateLongVi(r.dateOfReservation)} lúc ${r.time ?? "—"}, và chúng mình đã giữ cho bạn một bàn view biển. Vị trí đẹp nhất quán sẽ luôn chờ bạn.\n\nChúng mình giữ bàn trong 15 phút kể từ giờ đặt. Hẹn gặp bạn!\n\nThân mến,\nThe Roof Đà Nẵng`,
    },
  },
  confirm_bar: {
    id: "confirm_bar",
    respondType: "confirm",
    table: "Bar Area",
    label: "Confirm · Bar Area",
    color: "#2c7a86",
    blurb: "Seaview full — confirm a bar-area table instead.",
    icon: <Check className="h-3.5 w-3.5" />,
    template: {
      en: (r) =>
        `Hi ${firstName(r.name)},\n\nGreat news — your table at The Roof is confirmed for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "—"}.\n\nOur seaview tables are fully booked for that time, so we've reserved you a spot in our bar area instead — high tables, a warm buzz, and lovely views of their own. We think you'll love it.\n\nWe hold your table for 15 minutes from your reservation time. See you soon!\n\nWith Love,\nThe Roof Da Nang`,
      vi: (r) =>
        `Chào ${firstNameVi(r.name)},\n\nTin vui — bàn của bạn tại The Roof đã được xác nhận cho ${guestLabelVi(r.numberOfGuests)} vào ${formatDateLongVi(r.dateOfReservation)} lúc ${r.time ?? "—"}.\n\nCác bàn view biển đã kín chỗ vào khung giờ này, nên chúng mình đã giữ cho bạn một chỗ ở khu quầy bar — bàn cao, không khí sôi động và view rất riêng. Chúng mình tin là bạn sẽ thích.\n\nChúng mình giữ bàn trong 15 phút kể từ giờ đặt. Hẹn gặp bạn!\n\nThân mến,\nThe Roof Đà Nẵng`,
    },
  },
  followup: {
    id: "followup",
    respondType: "followup",
    label: "Follow up",
    color: "#2c5f9e",
    blurb: "Ask a question — e.g. a request you can't confirm yet.",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    template: {
      en: (r) =>
        `Hi ${firstName(r.name)},\n\nThank you for your reservation request for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "—"}.${r.specialRequests ? ` Regarding your request: "${r.specialRequests}" — we can't guarantee it for that time slot.` : ""} Could we offer you an alternative? Reply here and we'll hold your table.\n\nWith Love,\nThe Roof Da Nang`,
      vi: (r) =>
        `Chào ${firstNameVi(r.name)},\n\nCảm ơn bạn đã gửi yêu cầu đặt bàn cho ${guestLabelVi(r.numberOfGuests)} vào ${formatDateLongVi(r.dateOfReservation)} lúc ${r.time ?? "—"}.${r.specialRequests ? ` Về yêu cầu của bạn: "${r.specialRequests}" — chúng mình chưa thể đảm bảo cho khung giờ này.` : ""} Chúng mình có thể đề xuất một phương án khác được không? Bạn phản hồi lại tin này nhé, chúng mình sẽ giữ bàn cho bạn.\n\nThân mến,\nThe Roof Đà Nẵng`,
    },
  },
  // The everyday decline: seaview (or the whole floor) is booked out, but the
  // guest still has two real ways in — walking in, or asking us on WhatsApp.
  decline_walkin: {
    id: "decline_walkin",
    respondType: "decline",
    label: "Decline · Walk-in",
    color: "#b8752e",
    blurb: "Fully booked — but invite them to walk in or check other tables on WhatsApp.",
    icon: <DoorOpen className="h-3.5 w-3.5" />,
    requiresReason: false,
    logReason: "Fully booked — walk-in and WhatsApp options offered",
    template: {
      en: (r) =>
        `Hi ${firstName(r.name)},\n\nThank you for your reservation request for ${guestLabel(r.numberOfGuests)} on ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "—"}.\n\n${
          isSeaviewEligible(r)
            ? "Our seaview tables are fully booked for that time, so we're not able to hold one for you — they get reserved every day, often well in advance."
            : "We're fully booked for reservations at that time, so we're not able to hold a table for you."
        }\n\nThat doesn't mean you can't join us though — you still have two options:\n\n1. Walk in at that time. We always keep tables aside for walk-in guests, and our team will seat you as soon as one frees up.\n\n2. Message us on WhatsApp at ${WHATSAPP}. We'll check what's still open in our bar area and indoor sections and hold something for you.\n\nWe'd genuinely love to see you — please don't let this put you off.\n\nWith Love,\nThe Roof Da Nang`,
      vi: (r) =>
        `Chào ${firstNameVi(r.name)},\n\nCảm ơn bạn đã gửi yêu cầu đặt bàn cho ${guestLabelVi(r.numberOfGuests)} vào ${formatDateLongVi(r.dateOfReservation)} lúc ${r.time ?? "—"}.\n\n${
          isSeaviewEligible(r)
            ? "Các bàn view biển đã kín chỗ vào khung giờ này nên chúng mình chưa thể giữ bàn trước cho bạn — bàn view biển gần như kín mỗi ngày và thường được đặt từ khá sớm."
            : "Chúng mình đã kín chỗ đặt bàn trước vào khung giờ này nên chưa thể giữ bàn cho bạn."
        }\n\nNhưng bạn vẫn có thể ghé chơi cùng chúng mình theo hai cách:\n\n1. Đến trực tiếp vào giờ đó. Chúng mình luôn dành sẵn một số bàn cho khách đến trực tiếp, và đội ngũ sẽ sắp xếp chỗ cho bạn ngay khi có bàn trống.\n\n2. Nhắn WhatsApp cho chúng mình qua số ${WHATSAPP}. Chúng mình sẽ kiểm tra các bàn còn trống ở khu quầy bar và khu trong nhà rồi giữ chỗ giúp bạn.\n\nChúng mình rất mong được gặp bạn nhé!\n\nThân mến,\nThe Roof Đà Nẵng`,
    },
  },
  decline: {
    id: "decline",
    respondType: "decline",
    label: "Decline",
    color: "#b83232",
    blurb: "Closed or a private event — no walk-in to offer. Needs a reason.",
    icon: <Ban className="h-3.5 w-3.5" />,
    requiresReason: true,
    template: {
      en: (r, reason) =>
        `Hi ${firstName(r.name)},\n\nThank you for thinking of The Roof. Unfortunately we're unable to accommodate your reservation for ${formatDateLong(r.dateOfReservation)} at ${r.time ?? "—"}. ${reason ? `${reason}. ` : ""}\n\nIf you'd like to try another date or time, message us on WhatsApp at ${WHATSAPP} and we'll help you find a spot.\n\nWe're sorry to miss you this time and hope to welcome you soon.\n\nWith Love,\nThe Roof Da Nang`,
      vi: (r, reason) =>
        `Chào ${firstNameVi(r.name)},\n\nCảm ơn bạn đã nghĩ đến The Roof. Rất tiếc chúng mình chưa thể phục vụ yêu cầu đặt bàn của bạn vào ${formatDateLongVi(r.dateOfReservation)} lúc ${r.time ?? "—"}. ${reason ? `${reason}. ` : ""}\n\nNếu bạn muốn thử một ngày hoặc khung giờ khác, hãy nhắn WhatsApp cho chúng mình qua số ${WHATSAPP}, chúng mình sẽ hỗ trợ bạn tìm chỗ.\n\nChúng mình rất tiếc vì lần này chưa được đón tiếp bạn và mong sớm gặp bạn.\n\nThân mến,\nThe Roof Đà Nẵng`,
    },
  },
}

// Small parties are seaview-eligible → offer Seaview / Bar Area confirm.
// Larger parties get the generic confirm. Both get the walk-in decline first,
// since "seaview is booked out" is the everyday case and a hard no is rare.
function optionsFor(r: CsvReservation): ReplyOption[] {
  return isSeaviewEligible(r)
    ? [OPT.confirm_seaview, OPT.confirm_bar, OPT.followup, OPT.decline_walkin, OPT.decline]
    : [OPT.confirm, OPT.followup, OPT.decline_walkin, OPT.decline]
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
      setSelectedId(optionsFor(r)[0].id)
      setLang("en")
      setReason("")
      setSent(false)
      setWaOn(hasPhone)
      setEmailOn(hasEmail)
      requestAnimationFrame(() => setShown(true))
    } else {
      setShown(false)
    }
  }, [r?.reservationSystemId])

  // Regenerate template on option/language/reason change
  useEffect(() => {
    if (!r) return
    const opts = optionsFor(r)
    const o = opts.find((x) => x.id === selectedId) ?? opts[0]
    setMsg(o.template[lang](r, reason))
  }, [selectedId, lang, reason, r?.reservationSystemId])

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
  const needsReason = opt.requiresReason === true
  const canSend =
    selectedChannels.length > 0 &&
    msg.trim().length > 0 &&
    (!needsReason || reason.trim().length > 0)

  const handleSend = async () => {
    if (!r.reservationSystemId || !r.reservationSystemToken) return
    await respondTo.mutateAsync({
      id: r.reservationSystemId,
      token: r.reservationSystemToken,
      type: opt.respondType,
      table: opt.table,
      message: msg.trim(),
      reason: needsReason ? reason.trim() : opt.logReason,
      channels: selectedChannels,
      language: lang,
    })
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
                <div className={cn("grid gap-2", options.length >= 4 ? "grid-cols-2" : "grid-cols-3")}>
                  {options.map((t, i) => {
                    const active = opt.id === t.id
                    // Odd count in a 2-col grid → let the last tile span the row.
                    const spans = options.length >= 4 && options.length % 2 === 1 && i === options.length - 1
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          "flex flex-col items-start gap-1.5 rounded-xl p-3 text-left transition-colors",
                          spans && "col-span-2",
                        )}
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
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Message
                  </span>
                  <div className="flex items-center gap-1.5">
                    <LangToggle value={lang} onChange={setLang} />
                    <button
                      type="button"
                      onClick={() => setMsg(rt.template[lang](r, reason))}
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
