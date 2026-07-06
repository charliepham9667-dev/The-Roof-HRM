// The Roof Bonus Framework — reconciliation math. Two-phase pool.
// Policy source: The Roof/1-context/sops.md §2.
//
//   qualifying = revenue after service charge, FOC, VAT
//   surplus    = qualifying − monthly_target
//
//   Phase 1 — Foundation: hit 100% of target → 1% of TARGET into the pool.
//   Phase 2 — Hustle:     every VND above target → 7% of SURPLUS.
//
//   policyPool = foundation + hustle
//     foundation = target_hit ? target × 1% : 0
//     hustle     = max(0, surplus) × 7% × review-gate
//
// The Google review gate applies to Phase 2 only (the surplus pool). Phase 1 is
// unlocked purely by hitting target. Gate (highest tier met wins; else 0%):
//   4.8★ + 100 new reviews → 100%
//   4.7★ +  70 new reviews →  70%
//   4.6★ +  35 new reviews →  35%
//   otherwise              →   0%
//
// The per-employee rules are NOT applied here — this is a POOL-level check. Team-vs-
// leadership split and the June 2026 tenure scaling (50/75/100% by continuous service
// from START DATE, probation included) only divide the pool; they don't change its total.

export const FOUNDATION_RATE = 0.01 // Phase 1: of the monthly target, when target is hit
export const SURPLUS_BONUS_RATE = 0.07 // Phase 2: of the surplus, review-gated

/** AIOS monthly revenue targets (VND). Source: Charlie/quarterly_objectives.md. */
const TARGET_SCHEDULE: Record<number, number[]> = {
  // Jan   Feb    Mar    Apr    May     Jun    Jul    Aug    Sep    Oct    Nov    Dec
  2026: [
    750_000_000, 975_000_000, 1_500_000_000, 1_500_000_000, 1_425_000_000, 1_500_000_000,
    1_800_000_000, 1_800_000_000, 1_200_000_000, 900_000_000, 750_000_000, 1_200_000_000,
  ],
}

/** Default target for a month from the AIOS schedule, or null if unknown (editable). */
export function defaultTargetVnd(year: number, month: number): number | null {
  const row = TARGET_SCHEDULE[year]
  if (!row) return null
  return row[month - 1] ?? null
}

export type BonusGate = { pct: number; label: string }

export function bonusGate(rating: number | null, newReviews: number | null): BonusGate {
  const r = rating ?? 0
  const n = newReviews ?? 0
  if (r >= 4.8 && n >= 100) return { pct: 1.0, label: "4.8★ + 100 reviews → 100%" }
  if (r >= 4.7 && n >= 70) return { pct: 0.7, label: "4.7★ + 70 reviews → 70%" }
  if (r >= 4.6 && n >= 35) return { pct: 0.35, label: "4.6★ + 35 reviews → 35%" }
  return { pct: 0, label: "Below review gate → 0%" }
}

export type BonusStatus = "incomplete" | "below-target" | "match" | "over" | "under"

export type BonusCheck = {
  target: number
  qualifyingRevenue: number
  targetHit: boolean
  surplus: number
  foundationPool: number // Phase 1: 1% of target when hit
  gate: BonusGate
  hustlePoolGross: number // Phase 2 before the gate: 7% of surplus
  hustlePool: number // Phase 2 after the gate
  policyPool: number // foundation + hustlePool — what policy says should be paid
  paid: number // what the sheet actually paid (bonus total)
  delta: number // paid − policyPool  (positive = overpaid)
  status: BonusStatus
}

export type BonusCheckInput = {
  target: number | null
  qualifyingRevenue: number | null
  rating: number | null
  newReviews: number | null
  paid: number | null
}

/** Tolerance for calling paid vs policy a "match" — larger of 0.5% of pool or 200K VND. */
function matchTolerance(pool: number): number {
  return Math.max(200_000, Math.round(pool * 0.005))
}

export function computeBonusCheck(input: BonusCheckInput): BonusCheck {
  const target = input.target ?? 0
  const qualifyingRevenue = input.qualifyingRevenue ?? 0
  const paid = input.paid ?? 0
  const gate = bonusGate(input.rating, input.newReviews)

  const targetHit = target > 0 && qualifyingRevenue >= target
  const surplus = qualifyingRevenue - target

  const foundationPool = targetHit ? Math.round(target * FOUNDATION_RATE) : 0
  const hustlePoolGross = surplus > 0 ? Math.round(surplus * SURPLUS_BONUS_RATE) : 0
  const hustlePool = Math.round(hustlePoolGross * gate.pct)
  const policyPool = foundationPool + hustlePool

  const hasInputs = (input.qualifyingRevenue ?? 0) > 0 && (input.target ?? 0) > 0
  let status: BonusStatus
  if (!hasInputs) {
    status = "incomplete"
  } else if (!targetHit) {
    status = "below-target"
  } else {
    const delta = paid - policyPool
    const tol = matchTolerance(policyPool)
    status = Math.abs(delta) <= tol ? "match" : delta > 0 ? "over" : "under"
  }

  return {
    target,
    qualifyingRevenue,
    targetHit,
    surplus,
    foundationPool,
    gate,
    hustlePoolGross,
    hustlePool,
    policyPool,
    paid,
    delta: paid - policyPool,
    status,
  }
}

/** Short human label + accent color for a status, for badges. */
export function bonusStatusMeta(status: BonusStatus): { label: string; color: string; bg: string } {
  switch (status) {
    case "match":
      return { label: "Matches policy", color: "#2E7D52", bg: "#E7F3EC" }
    case "over":
      return { label: "Overpaid vs policy", color: "#8B3030", bg: "#F7E9E4" }
    case "under":
      return { label: "Underpaid vs policy", color: "#B8922A", bg: "#F7F0DC" }
    case "below-target":
      return { label: "Target not hit — no bonus due", color: "#6B7280", bg: "#F0EEE9" }
    default:
      return { label: "Add revenue + target", color: "#A89E8C", bg: "#F5F2EC" }
  }
}
