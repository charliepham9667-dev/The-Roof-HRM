import { describe, expect, it } from "vitest"
import {
  inferCategoryFromRemarks,
  isInternalTransfer,
  normalizeVndAmount,
  postProcessParsedPaymentList,
} from "./parse-payment-list"

describe("normalizeVndAmount", () => {
  it("parses dotted VND amounts", () => {
    expect(normalizeVndAmount("110.000.000")).toBe(110_000_000)
    expect(normalizeVndAmount("98,809,967")).toBe(98_809_967)
  })
})

describe("inferCategoryFromRemarks", () => {
  it("detects rent", () => {
    expect(inferCategoryFromRemarks("thanh toan tien thue nha thang 5")).toBe("rent")
  })
  it("detects inventory from beer remarks", () => {
    expect(
      inferCategoryFromRemarks(
        "The Roof thanh toan tien Beer East West tu 01.04 den 15.04.2026 Cty SEA",
      ),
    ).toBe("inventory")
  })
  it("detects entertainment from DJ remarks", () => {
    expect(
      inferCategoryFromRemarks("The Roof thanh toan tien DJ ngay 1+4+11 Dang Thanh Nhan"),
    ).toBe("other")
  })
})

describe("isInternalTransfer", () => {
  it("flags internal THE ROOF transfer", () => {
    expect(
      isInternalTransfer("CÔNG TY TNHH TMDV THE ROOF", "chuyen khoan giua cac tai khoan MB"),
    ).toBe(true)
  })
})

describe("postProcessParsedPaymentList", () => {
  it("filters skip rows and reconciles total", () => {
    const result = postProcessParsedPaymentList({
      listDate: "2026-05-15",
      paymentChannel: "bank",
      totalPaymentVnd: 151_320_000,
      rows: [
        {
          vendor: "EAST WEST BREWING",
          amountVnd: "110.000.000",
          category: "rent",
          remarks: "rent May",
        },
        {
          vendor: "BINH MINH HOME",
          amountVnd: 29_500_000,
          category: "capex",
        },
        {
          vendor: "THE ROOF",
          amountVnd: 800_000_000,
          skip: true,
          remarks: "internal",
        },
      ],
      warnings: [],
    })
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].amountVnd).toBe(110_000_000)
    expect(result.paymentChannel).toBe("bank")
  })
})
