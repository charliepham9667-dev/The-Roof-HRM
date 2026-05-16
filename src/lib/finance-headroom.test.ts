import { describe, expect, it } from "vitest"
import {
  computeDebtRibbonBuckets,
  computeFreeCashFlow,
  computeRunwayDays,
  formatDueRelative,
  forwardFillLiquidity,
  mostRecentFridayIso,
} from "./finance-headroom"

describe("computeFreeCashFlow", () => {
  it("subtracts debt from liquidity", () => {
    expect(computeFreeCashFlow(2_010_000_000, 250_000_000)).toBe(1_760_000_000)
  })
})

describe("computeRunwayDays", () => {
  it("returns days at current burn", () => {
    expect(computeRunwayDays(470_000_000, 47_000_000)).toBe(10)
  })

  it("returns 0 when fcf is zero or negative", () => {
    expect(computeRunwayDays(0, 47_000_000)).toBe(0)
  })
})

describe("computeDebtRibbonBuckets", () => {
  it("aggregates open items by status and due urgency", () => {
    const today = new Date()
    const iso = today.toISOString().slice(0, 10)
    const buckets = computeDebtRibbonBuckets([
      { amount_vnd: 100_000_000, due_date: iso, status: "pending" },
      { amount_vnd: 65_000_000, due_date: "2099-12-31", status: "stopped" },
      { amount_vnd: 42_000_000, due_date: "2099-12-20", status: "pending" },
      { amount_vnd: 10_000_000, due_date: iso, status: "paid" },
    ])
    expect(buckets.total).toBe(142_000_000)
    expect(buckets.vendorCount).toBe(3)
    expect(buckets.dueTodayOrOverdue).toBe(100_000_000)
    expect(buckets.pendingTotal).toBe(142_000_000)
    expect(buckets.stoppedTotal).toBe(65_000_000)
  })
})

describe("formatDueRelative", () => {
  it('returns "Today" for same calendar day', () => {
    const today = new Date("2026-05-16T12:00:00")
    expect(formatDueRelative("2026-05-16", today)).toBe("Today")
  })
})

describe("forwardFillLiquidity", () => {
  it("carries last known snapshot forward", () => {
    const dates = ["2026-05-01", "2026-05-02", "2026-05-03"]
    const result = forwardFillLiquidity(dates, [{ report_date: "2026-05-01", total_vnd: 100 }])
    expect(result).toEqual([100, 100, 100])
  })
})

describe("mostRecentFridayIso", () => {
  it("returns a Friday on or before the given date", () => {
    const friday = mostRecentFridayIso(new Date("2026-05-16")) // Saturday
    expect(friday).toBe("2026-05-15")
  })
})
