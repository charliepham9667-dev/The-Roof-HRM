import { describe, expect, it } from "vitest"
import { getTodayIsoInTimezone, toIsoDateInTimezone } from "@/lib/date"

describe("date helpers", () => {
  it("formats an ISO day string in ICT timezone", () => {
    const d = new Date("2026-01-01T00:30:00.000Z")
    expect(toIsoDateInTimezone(d, "Asia/Ho_Chi_Minh")).toBe("2026-01-01")
  })

  it("returns YYYY-MM-DD for current day", () => {
    const today = getTodayIsoInTimezone()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
