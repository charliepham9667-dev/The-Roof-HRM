// ============================================================
// The Roof — Reservation Capacity Model (single source of truth)
//
// Table-based, not pax-based. Mirrors the venue's real inventory and
// the front-of-house allocation rules.
//
//   Inventory (28 tables total):
//     • 11 seaview standing  — high demand. Only 2 reservable per hour
//                               (intake cap); the other 9 held for walk-ins.
//     • 8  non-seaview stand. — overflow buffer. Held for walk-ins by
//                               default; offered to reservations only once
//                               the seaview cap is hit AND communicated to
//                               the guest (this is the "In Discussion" flow).
//     • 9  sofa              — min 4 pax (2 pax allowed in slow hours 14–18).
//                               All 9 reservable.
//
//   Window: 14:00 → 20:00 slots. After 20:00 = walk-in only.
//
//   Two-tier capacity per slot:
//     GREEN      ≤ 11 reservable tables (2 seaview + 9 sofa) → accept freely
//     DISCUSSION seaview cap hit OR into the standing overflow → must
//                communicate (offer non-seaview / bar) before confirming
//     FULL       all 19 reservable tables gone → decline / waitlist
// ============================================================

export type SeatingType = "seaview" | "sofa" | "standing"
export type CapacityZone = "green" | "discussion" | "full"

export const VENUE_CAPACITY = {
  // Reservation window (ICT). After lastSlotHour = walk-in only.
  firstSlotHour: 14,
  lastSlotHour: 20,

  // Average dwell time — informational (intake-cap model doesn't use overlap).
  avgStayHours: 3,

  seating: {
    seaview: {
      total: 11,
      reservablePerSlot: 2, // intake cap; rest held for walk-ins
    },
    standing: {
      total: 8,
      reservablePerSlot: 8, // overflow only — engaged via "In Discussion"
    },
    sofa: {
      total: 9,
      reservablePerSlot: 9,
      minPax: 4,
      slowHourMinPax: 2,
      slowHours: [14, 15, 16, 17, 18],
    },
  },
} as const

// Comfortable reservable tables per slot — no awkward conversations.
export const GREEN_TABLES_PER_SLOT =
  VENUE_CAPACITY.seating.seaview.reservablePerSlot + // 2
  VENUE_CAPACITY.seating.sofa.reservablePerSlot // 9  => 11

// Absolute max reservable per slot (9 seaview always held for walk-ins).
export const MAX_TABLES_PER_SLOT =
  GREEN_TABLES_PER_SLOT + VENUE_CAPACITY.seating.standing.reservablePerSlot // +8 => 19

export const SEAVIEW_CAP_PER_SLOT = VENUE_CAPACITY.seating.seaview.reservablePerSlot // 2

// All reservable slot hours, e.g. [14,15,16,17,18,19,20]
export const SLOT_HOURS: number[] = Array.from(
  { length: VENUE_CAPACITY.lastSlotHour - VENUE_CAPACITY.firstSlotHour + 1 },
  (_, i) => VENUE_CAPACITY.firstSlotHour + i,
)

// ─── Seating classification ────────────────────────────────────────────────
// We only have party size + an optional free-text table preference, so this is
// best-effort. The binding constraint is the seaview 2-cap, so we err toward
// detecting seaview intent from both the table-preference and special-requests.

const SEAVIEW_HINTS = [
  "sea view", "seaview", "sea", "ocean", "view",
  "ban công", "ban cong", "balcony", "biển", "bien", "railing", "sunset", "fireworks",
]
const SOFA_HINTS = ["sofa", "couch", "lounge", "booth"]

/** Best-effort seating type from a reservation's preference + requests + size. */
export function classifySeating(input: {
  table?: string | null
  specialRequests?: string | null
  numberOfGuests?: number | null
}): SeatingType {
  const text = `${input.table ?? ""} ${input.specialRequests ?? ""}`.toLowerCase()
  if (SOFA_HINTS.some((h) => text.includes(h))) return "sofa"
  if (SEAVIEW_HINTS.some((h) => text.includes(h))) return "seaview"
  // Large parties default to sofa (the only ≥4-pax seating).
  if ((input.numberOfGuests ?? 0) >= 5) return "sofa"
  // Otherwise treat as flexible standing (no explicit seaview demand).
  return "standing"
}

// ─── Per-slot allocation ───────────────────────────────────────────────────

export interface SlotAllocation {
  hour: number
  time: string // "19:00"
  seaviewReserved: number // seaview-intent reservations starting this hour
  seaviewCap: number // 2
  seaviewOverflow: number // seaview demand beyond the cap (needs an offer)
  sofaReserved: number
  standingReserved: number
  tablesConfirmed: number // accepted bookings (firm)
  tablesPending: number // pending bookings (tentative)
  tablesReserved: number // confirmed + pending
  greenCap: number // 11
  hardCap: number // 19
  pax: number
  zone: CapacityZone
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
  if (tablesReserved > GREEN_TABLES_PER_SLOT || seaviewReserved > SEAVIEW_CAP_PER_SLOT)
    return "discussion"
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
    let standingReserved = 0
    let tablesConfirmed = 0
    let tablesPending = 0
    let pax = 0

    for (const r of rows) {
      const type = classifySeating(r)
      if (type === "seaview") seaviewReserved++
      else if (type === "sofa") sofaReserved++
      else standingReserved++

      if (r.bookingStatus === "pending") tablesPending++
      else tablesConfirmed++

      pax += r.numberOfGuests ?? 0
    }

    const tablesReserved = tablesConfirmed + tablesPending
    const seaviewOverflow = Math.max(0, seaviewReserved - SEAVIEW_CAP_PER_SLOT)

    return {
      hour,
      time: `${String(hour).padStart(2, "0")}:00`,
      seaviewReserved,
      seaviewCap: SEAVIEW_CAP_PER_SLOT,
      seaviewOverflow,
      sofaReserved,
      standingReserved,
      tablesConfirmed,
      tablesPending,
      tablesReserved,
      greenCap: GREEN_TABLES_PER_SLOT,
      hardCap: MAX_TABLES_PER_SLOT,
      pax,
      zone: zoneFor(tablesReserved, seaviewReserved),
    }
  })
}

/** Day-level rollup across all slots. */
export interface DayCapacitySummary {
  slots: SlotAllocation[]
  totalTables: number
  totalPax: number
  peakSlot: SlotAllocation | null
  discussionSlots: number
  fullSlots: number
  seaviewOverflowSlots: number
}

export function summarizeDay(slots: SlotAllocation[]): DayCapacitySummary {
  const totalTables = slots.reduce((a, s) => a + s.tablesReserved, 0)
  const totalPax = slots.reduce((a, s) => a + s.pax, 0)
  const peakSlot =
    slots.length === 0
      ? null
      : slots.reduce((a, b) => (b.tablesReserved > a.tablesReserved ? b : a), slots[0])
  return {
    slots,
    totalTables,
    totalPax,
    peakSlot,
    discussionSlots: slots.filter((s) => s.zone === "discussion").length,
    fullSlots: slots.filter((s) => s.zone === "full").length,
    seaviewOverflowSlots: slots.filter((s) => s.seaviewOverflow > 0).length,
  }
}
