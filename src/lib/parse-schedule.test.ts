import { describe, expect, it } from "vitest"
import {
  autoMatchEmployee,
  deriveRoleFromEmployee,
  normalizeName,
  normalizeTime,
  postProcessParsedSchedule,
  type MatchableEmployee,
} from "./parse-schedule"

// Roster modelled on the live HRM staff directory.
const ROSTER: MatchableEmployee[] = [
  { id: "nhi", full_name: "Nguyen Yen Nhi", job_role: "marketing_manager", department: "Marketing" },
  { id: "thuy", full_name: "Thu Thuy", job_role: "floor_manager", department: "Management" },
  { id: "fu", full_name: "Fu", job_role: "head_bartender", department: "Bar" },
  { id: "duong", full_name: "Hà Quý Dương", job_role: "bartender", department: "Bar" },
  { id: "loc", full_name: "Mai Loc", job_role: "bartender", department: "Bar" },
  { id: "huy", full_name: "Phan Quoc huy", job_role: "Bartender", department: "Bar" },
  { id: "vu", full_name: "Le Dac Nguyen Vu", job_role: "service", department: "Service" },
  { id: "nguyen", full_name: "Nguyen", job_role: "service", department: "Service" },
  { id: "thanh", full_name: "Thanh", job_role: "service", department: "Service" },
  { id: "tho", full_name: "Tho", job_role: "service", department: "Service" },
  { id: "long", full_name: "Long", job_role: "shisha", department: "Service" },
]

describe("normalizeTime", () => {
  it("keeps real clock times", () => {
    expect(normalizeTime("16:00")).toBe("16:00")
    expect(normalizeTime("9:30")).toBe("09:30")
  })
  it("treats 0 / blank as off", () => {
    expect(normalizeTime("0")).toBeNull()
    expect(normalizeTime("0,0")).toBeNull()
    expect(normalizeTime("")).toBeNull()
    expect(normalizeTime(null)).toBeNull()
  })
  it("wraps past-midnight 25/27 to 24h", () => {
    expect(normalizeTime("25:00")).toBe("01:00")
    expect(normalizeTime("27:00")).toBe("03:00")
  })
  it("handles comma/dot separators and bare hours", () => {
    expect(normalizeTime("17.30")).toBe("17:30")
    expect(normalizeTime("17,30")).toBe("17:30")
    expect(normalizeTime("18")).toBe("18:00")
  })
})

describe("postProcessParsedSchedule", () => {
  it("keeps valid shifts, drops off-days and zero-length", () => {
    const result = postProcessParsedSchedule({
      weekStartDayOfMonth: 22,
      entries: [
        { rawName: "THUY", dayIndex: 0, dayOfMonth: 22, startTime: "16:00", endTime: "00:00" },
        { rawName: "Huy", dayIndex: 0, dayOfMonth: 22, startTime: "13:30", endTime: "21:30" },
        { rawName: "OffGuy", dayIndex: 1, dayOfMonth: 23, startTime: "0", endTime: "0" },
        { rawName: "Zero", dayIndex: 2, dayOfMonth: 24, startTime: "10:00", endTime: "10:00" },
        { rawName: "BadDay", dayIndex: 9, dayOfMonth: 0, startTime: "10:00", endTime: "12:00" },
      ],
      warnings: [],
    })
    expect(result.weekStartDayOfMonth).toBe(22)
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((e) => e.rawName)).toEqual(["THUY", "Huy"])
  })

  it("preserves overnight shifts as-is", () => {
    const result = postProcessParsedSchedule({
      entries: [{ rawName: "Tu", dayIndex: 4, startTime: "17:30", endTime: "01:30" }],
    })
    expect(result.entries[0]).toMatchObject({ startTime: "17:30", endTime: "01:30" })
  })
})

describe("autoMatchEmployee", () => {
  const cases: Array<[string, string]> = [
    ["THUY", "thuy"],
    ["Duong", "duong"],
    ["Loc", "loc"],
    ["Huy", "huy"],
    ["Vu", "vu"],
    ["Thanh", "thanh"],
    ["Tho", "tho"],
    ["Long", "long"],
    ["Nguyen", "nguyen"],
  ]
  it.each(cases)("matches sheet name %s to employee %s", (raw, expectedId) => {
    const match = autoMatchEmployee(raw, ROSTER)
    expect(match?.id).toBe(expectedId)
  })

  it("returns null for an ambiguous abbreviation with no roster token (Phu vs Fu)", () => {
    // 'Phu' shares no normalized token with 'Fu' — should need manual mapping.
    expect(autoMatchEmployee("Phu", ROSTER)).toBeNull()
  })

  it("uses a remembered alias to resolve an otherwise-unmatched name", () => {
    const aliases = { [normalizeName("Phu")]: "fu" }
    expect(autoMatchEmployee("Phu", ROSTER, aliases)?.id).toBe("fu")
  })
})

describe("deriveRoleFromEmployee", () => {
  it("maps department/job to a shift role", () => {
    expect(deriveRoleFromEmployee(ROSTER.find((e) => e.id === "fu"))).toBe("bartender")
    expect(deriveRoleFromEmployee(ROSTER.find((e) => e.id === "thuy"))).toBe("management")
    expect(deriveRoleFromEmployee(ROSTER.find((e) => e.id === "vu"))).toBe("service")
    expect(deriveRoleFromEmployee(null)).toBe("service")
  })
})
