// ============================================================
// The Roof — Reservation Capacity Model (single source of truth)
//
// Table-based, not pax-based. Mirrors the venue's real inventory and
// the front-of-house allocation rules, and produces accept/decline
// recommendations per time slot.
//
//   Inventory (27 tables total) — three reservable categories:
//     • SEAVIEW  (11) — high demand. Cap varies by hour (see SEAVIEW_CAP_BY_HOUR).
//     • SOFA     (9)  — min 4 pax (2 in slow hours 14–18). All 9 reservable.
//     • STANDING (7)  — non-seaview standing tables. Overflow buffer.
//
//   Seaview intake caps per hour (earlier = more capacity):
//     14:00 → 11 · 15:00 → 8 · 16:00 → 7 · 17:00 → 4
//     18:00, 19:00, 20:00 → 2
//
//   Window: 14:00 → 20:00 slots. After 20:00 = walk-in only.
//
//   Zone per slot:
//     GREEN      seaview still available → accept freely
//     DISCUSSION seaview cap hit → steer to sofa/standing, must communicate
//     FULL       all 27 tables gone → decline / waitlist
// ============================================================

export type SeatingType = "seaview" | "sofa" | "bar"
export type CapacityZone = "green" | "discussion" | "full"

export const VENUE_CAPACITY = {
  firstSlotHour: 14,
  lastSlotHour: 20,
  avgStayHours: 3,
  seating: {
    seaview: {
      label: "Seaview",
      total: 11,
      reservablePerSlot: 2, // evening minimum — actual caps vary by hour
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
      label: "Standing",
      total: 7,
      reservablePerSlot: 7,
    },
  },
} as const

// ─── Time-based seaview caps ───────────────────────────────────────────────
// Earlier slots can absorb more seaview reservations (guests leave by peak time).
export const SEAVIEW_CAP_BY_HOUR: Record<number, number> = {
  14: 11,
  15: 8,
  16: 7,
  17: 4,
  18: 2,
  19: 2,
  20: 2,
}

export function seaviewCapForHour(hour: number): number {
  return SEAVIEW_CAP_BY_HOUR[hour] ?? 2
}

export const SOFA_CAP_PER_SLOT = VENUE_CAPACITY.seating.sofa.reservablePerSlot       // 9
export const BAR_CAP_PER_SLOT = VENUE_CAPACITY.seating.bar.reservablePerSlot          // 7
export const STANDING_CAP_PER_SLOT = BAR_CAP_PER_SLOT                                 // alias

// Evening minimum (peak hours 18–20). Full seaview is 11.
export const SEAVIEW_CAP_PER_SLOT = VENUE_CAPACITY.seating.seaview.reservablePerSlot  // 2

// Total tables in venue
export const TOTAL_TABLES =
  VENUE_CAPACITY.seating.seaview.total +
  VENUE_CAPACITY.seating.sofa.total +
  VENUE_CAPACITY.seating.bar.total // 27

// Kept for backward compat (widgets that reference it); now equals TOTAL_TABLES.
export const MAX_TABLES_PER_SLOT = TOTAL_TABLES // 27

// Legacy alias — was "2 seaview + 9 sofa = 11". Now unused in logic.
export const GREEN_TABLES_PER_SLOT = TOTAL_TABLES // 27 (updated to full table count)

// All reservable slot hours: [14,15,16,17,18,19,20]
export const SLOT_HOURS: number[] = Array.from(
  { length: VENUE_CAPACITY.lastSlotHour - VENUE_CAPACITY.firstSlotHour + 1 },
  (_, i) => VENUE_CAPACITY.firstSlotHour + i,
)

// ─── Seating classification ────────────────────────────────────────────────

const SEAVIEW_HINTS = [
  "sea view", "seaview", "sea", "ocean", "view",
  "ban công", "ban cong", "balcony", "biển", "bien", "railing", "sunset", "fireworks",
]
const SOFA_HINTS = ["sofa", "couch", "lounge", "booth"]
const BAR_HINTS = ["bar", "counter", "standing", "high table", "stool"]

/**
 * Seating classification based on party size + optional text hints.
 *
 *   < 4 pax  → seaview (staff follow up if seaview cap hit → In Discussion)
 *   ≥ 4 pax  → sofa
 *
 * Text hints override the size rule.
 */
export function classifySeating(input: {
  table?: string | null
  specialRequests?: string | null
  numberOfGuests?: number | null
}): SeatingType {
  const text = `${input.table ?? ""} ${input.specialRequests ?? ""}`.toLowerCase()
  if (SEAVIEW_HINTS.some((h) => text.includes(h))) return "seaview"
  if (SOFA_HINTS.some((h) => text.includes(h))) return "sofa"
  if (BAR_HINTS.some((h) => text.includes(h))) return "bar"
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
  const totalLeft = Math.max(0, TOTAL_TABLES - a.tablesReserved)

  if (totalLeft <= 0) {
    return {
      action: "full",
      tone: "red",
      headline: "Stop — slot full",
      detail: `All ${TOTAL_TABLES} tables booked. Decline or waitlist.`,
    }
  }

  if (a.seaviewLeft > 0) {
    return {
      action: "accept",
      tone: "green",
      headline: `Accept · ${a.seaviewLeft} seaview left`,
      detail: `Seaview ${a.seaviewLeft} · Sofa ${a.sofaLeft} · Standing ${a.barLeft} open.`,
    }
  }

  if (a.sofaLeft > 0) {
    return {
      action: "offer-sofa",
      tone: "green",
      headline: "Accept · sofa / standing only",
      detail: `Seaview cap reached — no seaview promises. Offer sofa (${a.sofaLeft}) or standing (${a.barLeft}).`,
    }
  }

  if (a.barLeft > 0) {
    return {
      action: "discuss-bar",
      tone: "amber",
      headline: "Discuss · standing tables only",
      detail: `Seaview & sofa gone. Only ${a.barLeft} standing tables left — confirm guest accepts before approving.`,
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
  time: string
  seaviewReserved: number
  seaviewCap: number      // varies by hour
  seaviewLeft: number
  sofaReserved: number
  sofaCap: number
  sofaLeft: number
  barReserved: number
  barCap: number
  barLeft: number
  tablesConfirmed: number
  tablesPending: number
  tablesReserved: number
  greenCap: number        // seaviewCap + sofaCap for this slot
  hardCap: number         // TOTAL_TABLES = 27
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

export function sofaMinPax(hour: number): number {
  const s = VENUE_CAPACITY.seating.sofa
  return (s.slowHours as readonly number[]).includes(hour) ? s.slowHourMinPax : s.minPax
}

function zoneFor(
  tablesReserved: number,
  seaviewReserved: number,
  seaviewCap: number,
): CapacityZone {
  if (tablesReserved >= TOTAL_TABLES) return "full"
  if (seaviewReserved >= seaviewCap) return "discussion"
  return "green"
}

export function computeSlotAllocations(reservations: ReservationLike[]): SlotAllocation[] {
  const byHour = new Map<number, ReservationLike[]>()
  for (const h of SLOT_HOURS) byHour.set(h, [])

  for (const r of reservations) {
    if (!r.time) continue
    const hour = parseInt(r.time.slice(0, 2), 10)
    if (!byHour.has(hour)) continue
    byHour.get(hour)!.push(r)
  }

  return SLOT_HOURS.map((hour) => {
    const rows = byHour.get(hour)!
    const seaviewCap = seaviewCapForHour(hour)

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
    const seaviewLeft = Math.max(0, seaviewCap - seaviewReserved)
    const sofaLeft = Math.max(0, SOFA_CAP_PER_SLOT - sofaReserved)
    const barLeft = Math.max(0, BAR_CAP_PER_SLOT - barReserved)

    return {
      hour,
      time: `${String(hour).padStart(2, "0")}:00`,
      seaviewReserved,
      seaviewCap,
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
      greenCap: seaviewCap + SOFA_CAP_PER_SLOT,
      hardCap: TOTAL_TABLES,
      pax,
      zone: zoneFor(tablesReserved, seaviewReserved, seaviewCap),
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
  const standingOnly = slots.filter((s) => s.recommendation.action === "discuss-bar")
  const sofaOnly = slots.filter((s) => s.recommendation.action === "offer-sofa")
  const list = (arr: SlotAllocation[]) => arr.map((s) => s.time).join(", ")

  if (full.length > 0) {
    return {
      tone: "red",
      headline: `Stop taking reservations at ${list(full)}`,
      detail: `${full.length} slot${full.length !== 1 ? "s" : ""} fully booked. Decline or waitlist — keep walk-in tables free.`,
    }
  }
  if (standingOnly.length > 0) {
    return {
      tone: "amber",
      headline: `Standing tables only at ${list(standingOnly)}`,
      detail: `Seaview and sofa are gone. Only confirm standing after the guest agrees (use In Discussion).`,
    }
  }
  if (sofaOnly.length > 0) {
    return {
      tone: "amber",
      headline: `Seaview full at ${list(sofaOnly)} — steer to sofa`,
      detail: `Keep accepting, but no seaview promises at these slots. Offer sofa or standing instead.`,
    }
  }
  return {
    tone: "green",
    headline: "Plenty of room — accept freely",
    detail: `Seaview caps vary by slot (11→2 from 14:00 to 18:00). All slots have seaview availability.`,
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
    seaviewOverflowSlots: slots.filter((s) => s.seaviewReserved >= s.seaviewCap).length,
    recommendation: recommendDay(slots),
  }
}
