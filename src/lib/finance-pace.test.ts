import { describe, expect, it } from "vitest"
import { computeMonthPace, formatPaceBadge } from "./finance-pace"

describe("computeMonthPace", () => {
  it("marks ahead when MTD exceeds pace for day 16 of 31", () => {
    const pace = computeMonthPace({
      mtdRevenue: 1_179_504_758,
      monthlyTarget: 1_425_000_000,
      dayOfMonth: 16,
      daysInMonth: 31,
      avgDailyRevenue: 78_600_000,
    })
    expect(pace.isAheadOfPace).toBe(true)
    expect(pace.paceAheadPercent).toBeGreaterThan(0)
  })

  it("formats pace badge", () => {
    expect(formatPaceBadge(70)).toBe("+70% ahead")
    expect(formatPaceBadge(-12)).toBe("-12% behind")
  })
})
