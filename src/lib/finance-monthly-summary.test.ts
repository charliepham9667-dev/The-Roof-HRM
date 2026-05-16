import { describe, expect, it } from "vitest"
import { summarizeMonthlyPerformance } from "./finance-monthly-summary"

const rows = [
  { month: "Dec", monthKey: "2025-12", actualRevenue: 1_000_000_000, lastYearRevenue: 850_000_000, targetRevenue: 1_200_000_000 },
  { month: "Jan", monthKey: "2026-01", actualRevenue: 1_100_000_000, lastYearRevenue: 900_000_000, targetRevenue: 1_200_000_000 },
  { month: "Feb", monthKey: "2026-02", actualRevenue: 1_050_000_000, lastYearRevenue: 920_000_000, targetRevenue: 1_200_000_000 },
  { month: "Mar", monthKey: "2026-03", actualRevenue: 1_500_000_000, lastYearRevenue: 980_000_000, targetRevenue: 1_300_000_000 },
  { month: "Apr", monthKey: "2026-04", actualRevenue: 1_850_000_000, lastYearRevenue: 1_100_000_000, targetRevenue: 1_400_000_000 },
  { month: "May", monthKey: "2026-05", actualRevenue: 1_180_000_000, lastYearRevenue: 1_050_000_000, targetRevenue: 1_425_000_000, isPartialMonth: true },
]

describe("summarizeMonthlyPerformance", () => {
  it("sums six-month revenue and compares to prior year", () => {
    const s = summarizeMonthlyPerformance(rows)
    expect(s.sixMoRevenue).toBe(7_680_000_000)
    expect(s.sixMoVsPriorPct).toBeGreaterThan(0)
  })

  it("counts targets hit excluding partial month", () => {
    const s = summarizeMonthlyPerformance(rows)
    expect(s.targetsTotal).toBe(5)
    expect(s.targetsHit).toBe(2)
    expect(s.bestMonth.month).toBe("Apr")
  })

  it("finds closest miss among completed months", () => {
    const s = summarizeMonthlyPerformance(rows)
    expect(s.closestMiss?.month).toBe("Jan")
  })
})
