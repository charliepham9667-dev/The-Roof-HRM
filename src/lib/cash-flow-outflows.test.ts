import { describe, expect, it } from "vitest"
import { buildPaidDebtOutflowsByDate, paidDebtOutflowDate } from "./cash-flow-outflows"

describe("paidDebtOutflowDate", () => {
  it("prefers due_date over paid_at (payment list day)", () => {
    expect(
      paidDebtOutflowDate({
        amount_vnd: 1_000_000,
        paid_at: "2026-05-16",
        due_date: "2026-05-12",
      }),
    ).toBe("2026-05-12")
  })

  it("falls back to paid_at then updated_at when due_date missing", () => {
    expect(
      paidDebtOutflowDate({
        amount_vnd: 1_000_000,
        paid_at: "2026-05-10",
        due_date: "",
      }),
    ).toBe("2026-05-10")
    expect(
      paidDebtOutflowDate({
        amount_vnd: 500_000,
        paid_at: null,
        updated_at: "2026-05-12T08:00:00Z",
        due_date: "",
      }),
    ).toBe("2026-05-12")
    expect(
      paidDebtOutflowDate({
        amount_vnd: 500_000,
        paid_at: null,
        due_date: "2026-05-01",
      }),
    ).toBe("2026-05-01")
  })
})

describe("buildPaidDebtOutflowsByDate", () => {
  it("sums amounts per date", () => {
    const map = buildPaidDebtOutflowsByDate([
      { amount_vnd: 10_000_000, paid_at: "2026-05-10", due_date: "2026-05-01" },
      { amount_vnd: 5_000_000, paid_at: "2026-05-10", due_date: "2026-05-02" },
      { amount_vnd: 3_000_000, paid_at: null, due_date: "2026-05-11" },
    ])
    expect(map.get("2026-05-01")).toBe(10_000_000)
    expect(map.get("2026-05-02")).toBe(5_000_000)
    expect(map.get("2026-05-11")).toBe(3_000_000)
  })

  it("skips zero or invalid amounts", () => {
    const map = buildPaidDebtOutflowsByDate([
      { amount_vnd: 0, paid_at: "2026-05-10", due_date: "2026-05-01" },
    ])
    expect(map.size).toBe(0)
  })
})
