// ============================================================
// The Roof — Reservation Capacity Model (single source of truth)
//
// Table-based, not pax-based. Mirrors the venue's real inventory and
// the front-of-house allocation rules, and produces accept/decline
// recommendations per time slot.
//
//   Inventory (28 tables total) — three reservable categories:
//     • SEAVIEW (11) — high demand. Only 2 reservable per hour
//                      (intake cap); the other 9 held for walk-ins.
//     • SOFA    (9)  — min 4 pax (2 in slow hours 14–18). All reservable.
//     • BAR     (8)  — non-seaview standing. Overflow buffer: offered to
//                      reservations only once seaview is full AND the guest
//                      is told (this is the "In Discussion" flow).
//
//   Window: 14:00 → 20:00 slots. After 20:00 = walk-in only.
//
//   Capacity tiers per slot:
//     GREEN      ≤ 11 tables (2 seaview + 9 sofa) → accept freely
//     DISCUSSION seaview full / into the bar overflow → must communicate
//     FULL       all 19 reservable tables gone → decline / waitlist
// ============================================================

export type SeatingType = "seaview" | "sofa" | "bar"
export type CapacityZone = "green" | "discussion" | "full"

export const VENUE_CAPACITY = {
  // Reservation window (ICT). After lastSlotHour = walk-in only.
  firstSlotHour: 14,
  lastSlotHour: 20,

  // Average dwell time — informational (intake-cap model doesn't use overlap).
  avgStayHours: 3,

  seating: {
    seaview: {
      label: "Seaview",
      total: 11,
      reservablePerSlot: 2, // intake cap; rest held for walk-ins
    },
    sofa: {
      label: "Sofa",
      total: 9,
      reservablePerSlot: 9,
      minPax: 4,
      slowHourMinPax: 2,
      slowHours: [14, 15, 16, 17, 18],
    },
    bar: {
      label: "Bar",
      total: 8,
      reservablePerSlot: 8, // overflow only — engaged via "In Discussion"
    },
  },
} as const

export const SEAVIEW_CAP_PER_SLOT = VENUE_CAPACITY.seating.seaview.reservablePerSlot // 2
export const SOFA_CAP_PER_SLOT = VENUE_CAPACITY.seating.sofa.reservablePerSlot // 9
export const BAR_CAP_PER_SLOT = VENUE_CAPACITY.seating.bar.reservablePerSlot // 8

// Comfortable reservable tables per slot — no awkward conversations.
export const GREEN_TABLES_PER_SLOT = SEAVIEW_CAP_PER_SLOT + SOFA_CAP_PER_SLOT // 11

// Absolute max reservable per slot (9 seaview always held for walk-ins).
export const MAX_TABLES_PER_SLOT = GREEN_TABLES_PER_SLOT + BAR_CAP_PER_SLOT // 19

// All reservable slot hours, e.g. [14,15,16,17,18,19,20]
export const SLOT_HOURS: number[] = Array.from(
  { length: VENUE_CAPACITY.lastSlotHour - VENUE_CAPACITY.firstSlotHour + 1 },
  (_, i) => VENUE_CAPACITY.firstSlotHour + i,
)

// ─── Seating classification ────────────────────────────────────────────────
// We only have party size + an optional free-text table preference, so this is
// best-effort. Seaview is the binding constraint, so we detect seaview intent
// from both the table-preference and special-requests text.

const SEAVIEW_HINTS = [
  "sea view", "seaview", "sea", "ocean", "view",
  "ban công", "ban cong", "balcony", "biển", "bien", "railing", "sunset", "fireworks",
]
const SOFA_HINTS = ["sofa", "couch", "lounge", "booth"]
const BAR_HINTS = ["bar", "counter", "standing", "high table", "stool"]

/**
 * Seating classification based on party size + optional text hints.
 *
 * Rules (per Charlie's booking logic):
 *   < 4 pax  → seaview (if seaview cap hit at runtime, staff follow up via In Discussion)
 *   ≥ 4 pax  → sofa
 *
 * Text hints override the size rule in case a guest explicitly requests a type.
 */
export function classifySeating(input: {
  table?: string | null
  specialRequests?: string | null
  numberOfGuests?: number | null
}): SeatingType {
  const text = `${input.table ?? ""} ${input.specialRequests ?? ""}`.toLowerCase()
  // Explicit text overrides take priority
  if (SEAVIEW_HINTS.some((h) => text.includes(h))) return "seaview"
  if (SOFA_HINTS.some((h) => text.includes(h))) return "sofa"
  if (BAR_HINTS.some((h) => text.includes(h))) return "bar"
  // Party-size rule: 4+ pax → sofa, otherwise seaview (staff follow-up if full)
  if ((input.numberOfGuests ?? 0) >= 4) return "sofa"
  return "seaview"
}

// ─── Recommendation ────────────────────────────────────────────────────────

export type RecAction = "accept" | "offer-sofa" | "discuss-bar" | "full"

export interface SlotRecommendation {
  action: RecAction
  tone: "green" | "amber" | "red"
  headline: string
  detail: string
}

export function recommendSlot(a: {
  seaviewLeft: number
  sofaLeft: number
  barLeft: number
  tablesReserved: number
}): SlotRecommendation {
  const totalLeft = Math.max(0, MAX_TABLES_PER_SLOT - a.tablesReserved)

  if (totalLeft <= 0) {
    return {
      action: "full",
      tone: "red",
      headline: "Stop — slot full",
      detail: `All ${MAX_TABLES_PER_SLOT} reservable tables booked. Decline or waitlist.`,
    }
  }

  if (a.seaviewLeft > 0) {
    return {
      action: "accept",
      tone: "green",
      headline: `Accept · ${a.seaviewLeft} seaview left`,
      detail: `Seaview ${a.seaviewLeft} · Sofa ${a.sofaLeft} · Bar ${a.barLeft} open.`,
    }
  }

  // Seaview cap hit
  if (a.sofaLeft > 0) {
    return {
      action: "offer-sofa",
      tone: "green",
      headline: "Accept · sofa / bar only",
      detail: `Seaview full — no seaview promises. Offer sofa (${a.sofaLeft}) or bar (${a.barLeft}).`,
    }
  }

  if (a.barLeft > 0) {
    return {
      action: "discuss-bar",
      tone: "amber",
      headline: "Discuss · bar tables only",
      detail: `Seaview & sofa gone. Only ${a.barLeft} bar/standing left — confirm the guest accepts before approving.`,
    }
  }

  return {
    action: "full",
    tone: "red",
    headline: "Stop — slot full",
    detail: "Decline or waitlist.",
  }
}

// ─── Per-slot allocation ───────────────────────────────────────────────────

export interface SlotAllocation {
  hour: number
  time: string // "19:00"
  // Per-category reserved + caps + remaining
  seaviewReserved: number
  seaviewCap: number
  seaviewLeft: number
  sofaReserved: number
  sofaCap: number
  sofaLeft: number
  barReserved: number
  barCap: number
  barLeft: number
  // Totals
  tablesConfirmed: number
  tablesPending: number
  tablesReserved: number
  greenCap: number // 11
  hardCap: number // 19
  pax: number
  zone: CapacityZone
  recommendation: SlotRecommendation
}

export interface ReservationLike {
  time: string | null
  numberOfGuests: number
  table?: string | null
  specialRequests?: string | null
  bookingStatus?: string | null
}

/** Sofa minimum pax for a given slot hour (relaxed in slow hours). */
export function sofaMinPax(hour: number): number {
  const s = VENUE_CAPACITY.seating.sofa
  return (s.slowHours as readonly number[]).includes(hour) ? s.slowHourMinPax : s.minPax
}

function zoneFor(tablesReserved: number, seaviewReserved: number): CapacityZone {
  if (tablesReserved > MAX_TABLES_PER_SLOT) return "full"
  if (tablesReserved > GREEN_TABLES_PER_SLOT || seaviewReserved > SEAVIEW_CAP_PER_SLOT) return "discussion"
  return "green"
}

/**
 * Build per-slot allocation for a day's reservations.
 * Intake-based: each booking is bucketed by its start hour (matches the
 * per-slot seaview intake cap the FOH team enforces). 1 booking = 1 table.
 * Declined / cancelled / no-show are excluded by the caller.
 */
export function computeSlotAllocations(reservations: ReservationLike[]): SlotAllocation[] {
  const byHour = new Map<number, ReservationLike[]>()
  for (const h of SLOT_HOURS) byHour.set(h, [])

  for (const r of reservations) {
    if (!r.time) continue
    const hour = parseInt(r.time.slice(0, 2), 10)
    if (!byHour.has(hour)) continue // outside the reservable window
    byHour.get(hour)!.push(r)
  }

  return SLOT_HOURS.map((hour) => {
    const rows = byHour.get(hour)!
    let seaviewReserved = 0
    let sofaReserved = 0
    let barReserved = 0
    let tablesConfirmed = 0
    let tablesPending = 0
    let pax = 0

    for (const r of rows) {
      const type = classifySeating(r)
      if (type === "seaview") seaviewReserved++
      else if (type === "sofa") sofaReserved++
      else barReserved++

      if (r.bookingStatus === "pending") tablesPending++
      else tablesConfirmed++

      pax += r.numberOfGuests ?? 0
    }

    const tablesReserved = tablesConfirmed + tablesPending
    const seaviewLeft = Math.max(0, SEAVIEW_CAP_PER_SLOT - seaviewReserved)
    const sofaLeft = Math.max(0, SOFA_CAP_PER_SLOT - sofaReserved)
    const barLeft = Math.max(0, BAR_CAP_PER_SLOT - barReserved)

    return {
      hour,
      time: `${String(hour).padStart(2, "0")}:00`,
      seaviewReserved,
      seaviewCap: SEAVIEW_CAP_PER_SLOT,
      seaviewLeft,
      sofaReserved,
      sofaCap: SOFA_CAP_PER_SLOT,
      sofaLeft,
      barReserved,
      barCap: BAR_CAP_PER_SLOT,
      barLeft,
      tablesConfirmed,
      tablesPending,
      tablesReserved,
      greenCap: GREEN_TABLES_PER_SLOT,
      hardCap: MAX_TABLES_PER_SLOT,
      pax,
      zone: zoneFor(tablesReserved, seaviewReserved),
      recommendation: recommendSlot({ seaviewLeft, sofaLeft, barLeft, tablesReserved }),
    }
  })
}

// ─── Day-level rollup + recommendation ─────────────────────────────────────

export interface DayRecommendation {
  tone: "green" | "amber" | "red"
  headline: string
  detail: string
}

export interface DayCapacitySummary {
  slots: SlotAllocation[]
  totalTables: number
  totalPax: number
  peakSlot: SlotAllocation | null
  discussionSlots: number
  fullSlots: number
  seaviewOverflowSlots: number
  recommendation: DayRecommendation
}

function recommendDay(slots: SlotAllocation[]): DayRecommendation {
  const full = slots.filter((s) => s.recommendation.action === "full")
  const barOnly = slots.filter((s) => s.recommendation.action === "discuss-bar")
  const sofaOnly = slots.filter((s) => s.recommendation.action === "offer-sofa")

  const list = (arr: SlotAllocation[]) => arr.map((s) => s.time).join(", ")

  if (full.length > 0) {
    return {
      tone: "red",
      headline: `Stop taking reservations at ${list(full)}`,
      detail: `${full.length} slot${full.length !== 1 ? "s" : ""} fully booked. Decline or waitlist — keep walk-in tables free.`,
    }
  }
  if (barOnly.length > 0) {
    return {
      tone: "amber",
      headline: `Bar tables only at ${list(barOnly)}`,
      detail: `Seaview and sofa are gone at these slots. Only confirm bar/standing after the guest agrees (use In Discussion).`,
    }
  }
  if (sofaOnly.length > 0) {
    return {
      tone: "amber",
      headline: `Seaview full at ${list(sofaOnly)} — steer to sofa`,
      detail: `Keep accepting, but no seaview promises at these slots. Offer sofa or bar instead.`,
    }
  }
  return {
    tone: "green",
    headline: "Plenty of room — accept freely",
    detail: `Seaview is the scarce one (${SEAVIEW_CAP_PER_SLOT}/slot). All slots have seaview availability tonight.`,
  }
}

export function summarizeDay(slots: SlotAllocation[]): DayCapacitySummary {
  const totalTables = slots.reduce((a, s) => a + s.tablesReserved, 0)
  const totalPax = slots.reduce((a, s) => a + s.pax, 0)
  const peakSlot =
    slots.length === 0 ? null : slots.reduce((a, b) => (b.tablesReserved > a.tablesReserved ? b : a), slots[0])
  return {
    slots,
    totalTables,
    totalPax,
    peakSlot,
    discussionSlots: slots.filter((s) => s.zone === "discussion").length,
    fullSlots: slots.filter((s) => s.zone === "full").length,
    seaviewOverflowSlots: slots.filter((s) => s.seaviewReserved > SEAVIEW_CAP_PER_SLOT).length,
    recommendation: recommendDay(slots),
  }
}
