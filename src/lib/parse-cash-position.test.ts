import { describe, expect, it } from "vitest"
import { isValidIsoDate } from "./finance-headroom"
import {
  normalizeVndAmount,
  postProcessParsedCashPosition,
  resolveSheetColumnDate,
} from "./parse-cash-position"

describe("resolveSheetColumnDate", () => {
  it("uses month from column label (18-Mar = March 18)", () => {
    expect(resolveSheetColumnDate("18-Mar", 2026, 5)).toBe("2026-03-18")
    expect(resolveSheetColumnDate("12-Apr", 2026, 5)).toBe("2026-04-12")
    expect(resolveSheetColumnDate("5-May", 2026, null)).toBe("2026-05-05")
  })

  it("rejects impossible dates", () => {
    expect(resolveSheetColumnDate("31-Feb", 2026, null)).toBe(null)
  })
})

describe("postProcessParsedCashPosition", () => {
  it("normalizes single snapshot", () => {
    const result = postProcessParsedCashPosition({
      reportDate: "2026-05-16",
      bankBalanceVnd: "1.728.057.427",
      cashBalanceVnd: "45.500.000",
      warnings: [],
    })
    expect(result.days).toHaveLength(1)
    expect(result.isDailySeries).toBe(false)
    expect(result.bankBalanceVnd).toBe(1_728_057_427)
  })

  it("prefers columnLabel over wrong model reportDate", () => {
    const result = postProcessParsedCashPosition({
      sheetYear: 2026,
      sheetMonth: 5,
      days: [
        {
          columnLabel: "18-Mar",
          reportDate: "2026-05-18",
          bankBalanceVnd: 1_000_000,
          cashBalanceVnd: 200_000,
        },
      ],
      warnings: [],
    })
    expect(result.days[0].reportDate).toBe("2026-03-18")
  })

  it("parses daily spreadsheet series", () => {
    const result = postProcessParsedCashPosition({
      sheetYear: 2026,
      days: [
        {
          columnLabel: "12-Apr",
          bankBalanceVnd: "1.810.425.407",
          cashBalanceVnd: "214.324.311",
          totalVnd: "2.024.749.718",
        },
        {
          reportDate: "2026-05-13",
          bankBalanceVnd: 1_237_435_048,
          cashBalanceVnd: 106_418_301,
          totalVnd: 1_343_853_349,
        },
      ],
      warnings: [],
    })
    expect(result.isDailySeries).toBe(true)
    expect(result.days).toHaveLength(2)
    expect(result.days[0].reportDate).toBe("2026-04-12")
    expect(result.days[1].reportDate).toBe("2026-05-13")
  })
})

describe("isValidIsoDate", () => {
  it("rejects invalid calendar dates", () => {
    expect(isValidIsoDate("2026-02-31")).toBe(false)
    expect(isValidIsoDate("2026-03-18")).toBe(true)
  })
})

describe("normalizeVndAmount (cash position)", () => {
  it("parses comma-separated amounts", () => {
    expect(normalizeVndAmount("98,809,967")).toBe(98_809_967)
  })
})
