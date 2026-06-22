/** Deno-shared post-processing for parse-schedule (keep in sync with src/lib/parse-schedule.ts) */

export type ParsedScheduleEntry = {
  rawName: string
  dayIndex: number
  dayOfMonth: number | null
  startTime: string
  endTime: string
}

export type ParsedSchedule = {
  weekStartDayOfMonth: number | null
  entries: ParsedScheduleEntry[]
  warnings: string[]
}

export function normalizeTime(raw: string | number | null | undefined): string | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s || s === "0" || s === "0,0" || s === "0.0" || s === "00:00:00") {
    return null
  }
  if (s === "0:00" || s === "00:00") return "00:00"
  s = s.replace(/[.,]/g, ":")
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) {
    const hourOnly = s.match(/^(\d{1,2})$/)
    if (hourOnly) {
      const h = Number(hourOnly[1])
      if (h >= 0 && h <= 27) return `${String(h % 24).padStart(2, "0")}:00`
    }
    return null
  }
  let h = Number(m[1])
  const min = Number(m[2])
  if (min > 59) return null
  if (h >= 24) h -= 24
  if (h < 0 || h > 23) return null
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

export function postProcessParsedSchedule(raw: unknown): ParsedSchedule {
  const input = (raw ?? {}) as Record<string, unknown>
  const warnings = Array.isArray(input.warnings) ? input.warnings.map((w) => String(w)) : []

  const weekStartDayOfMonth =
    input.weekStartDayOfMonth != null && Number.isFinite(Number(input.weekStartDayOfMonth))
      ? Number(input.weekStartDayOfMonth)
      : null

  const rawEntries = Array.isArray(input.entries) ? input.entries : []
  const entries: ParsedScheduleEntry[] = []

  for (const item of rawEntries) {
    const row = item as Record<string, unknown>
    const rawName = String(row.rawName ?? row.name ?? "").trim()
    if (!rawName) continue

    const dayIndex = Number(row.dayIndex)
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) continue

    const startTime = normalizeTime(row.startTime as string)
    const endTime = normalizeTime(row.endTime as string)
    if (!startTime || !endTime) continue
    if (startTime === endTime) continue

    const dayOfMonth =
      row.dayOfMonth != null && Number.isFinite(Number(row.dayOfMonth))
        ? Number(row.dayOfMonth)
        : null

    entries.push({ rawName, dayIndex, dayOfMonth, startTime, endTime })
  }

  if (entries.length === 0) {
    warnings.push("No shifts could be read from the image. Try a sharper or larger screenshot.")
  }

  return { weekStartDayOfMonth, entries, warnings }
}
