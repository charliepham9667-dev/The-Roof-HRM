/**
 * Parsing + matching helpers for the weekly-schedule screenshot importer.
 * Mirror of supabase/functions/_shared/parse-schedule.ts — keep the two in sync.
 *
 * The source image is the Google-sheet weekly roster Charlie maintains: rows are
 * staff (short names), columns are 7 days (Mon→Sun) each split into In / Out / Hours.
 * Vision returns one entry per real shift; we normalise + match names here.
 */

export type RoleOption = "service" | "bartender" | "cashier" | "kitchen" | "management"

export type ParsedScheduleEntry = {
  /** Name exactly as printed in the row label (e.g. "THUY", "Huy", "THĂM"). */
  rawName: string
  /** Column position, 0 = first day column (Monday) … 6 = Sunday. */
  dayIndex: number
  /** Day-of-month shown in that column header, for week sanity-check (null if unreadable). */
  dayOfMonth: number | null
  /** "HH:MM" 24h start (In). */
  startTime: string
  /** "HH:MM" 24h end (Out). May be earlier than start for overnight shifts. */
  endTime: string
}

export type ParsedSchedule = {
  /** Day-of-month of the first (Monday) column, for sanity-checking the target week. */
  weekStartDayOfMonth: number | null
  entries: ParsedScheduleEntry[]
  warnings: string[]
}

export type MatchableEmployee = {
  id: string
  full_name: string | null
  job_role: string | null
  department: string | null
}

/** localStorage key for remembered raw-name → employee-id mappings. */
export const SCHEDULE_ALIAS_STORAGE_KEY = "roof.schedule.nameAliases.v1"

/** Lowercase, strip Vietnamese diacritics, collapse whitespace. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return ""
  return String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** "HH:MM" zero-padded, or null if not a real clock time. Treats 0 / blank as off. */
export function normalizeTime(raw: string | number | null | undefined): string | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s || s === "0" || s === "0,0" || s === "0.0" || s === "0:00" || s === "00:00:00") {
    // 00:00 is ambiguous (midnight) — only keep it when written as "00:00" / "0:00"
    if (s === "0:00" || s === "00:00") return "00:00"
    return null
  }
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
  // Sheets sometimes write past-midnight as 25:00 / 27:00 — wrap to 24h clock.
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
    if (startTime === endTime) continue // zero-length / off

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

/** Map an employee's role/department to one of the 5 shift role options. */
export function deriveRoleFromEmployee(emp: MatchableEmployee | null | undefined): RoleOption {
  const text = `${emp?.job_role ?? ""} ${emp?.department ?? ""}`.toLowerCase()
  if (/bar|bartender/.test(text)) return "bartender"
  if (/manage|floor|owner|director|lead/.test(text)) return "management"
  if (/cashier|reception|account|finance/.test(text)) return "cashier"
  if (/kitchen|chef|cook|food/.test(text)) return "kitchen"
  return "service"
}

/**
 * Best-effort match of a sheet name to an employee.
 * Order: remembered alias → exact token → prefix token. Returns null if no confident hit.
 */
export function autoMatchEmployee(
  rawName: string,
  employees: MatchableEmployee[],
  aliases: Record<string, string> = {},
): MatchableEmployee | null {
  const norm = normalizeName(rawName)
  if (!norm) return null

  const aliasId = aliases[norm]
  if (aliasId) {
    const byAlias = employees.find((e) => e.id === aliasId)
    if (byAlias) return byAlias
  }

  let best: { emp: MatchableEmployee; score: number } | null = null
  for (const emp of employees) {
    const fullTokens = normalizeName(emp.full_name).split(" ").filter(Boolean)
    const roleTokens = normalizeName(`${emp.job_role ?? ""} ${emp.department ?? ""}`)
      .split(" ")
      .filter(Boolean)
    let score = 0
    // Whole-name equality (e.g. roster "Nguyen") beats a token buried in a longer
    // name (e.g. "Le Dac Nguyen Vu") so common middle names don't steal the match.
    if (normalizeName(emp.full_name) === norm) score = 120
    else if (fullTokens.includes(norm)) score = 90
    else if (fullTokens.some((t) => t.length >= 3 && (t.startsWith(norm) || norm.startsWith(t))))
      score = 60
    else if (roleTokens.includes(norm)) score = 40

    if (score > 0 && (!best || score > best.score)) best = { emp, score }
  }

  return best && best.score >= 60 ? best.emp : null
}

export function loadNameAliases(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SCHEDULE_ALIAS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function saveNameAliases(aliases: Record<string, string>): void {
  try {
    localStorage.setItem(SCHEDULE_ALIAS_STORAGE_KEY, JSON.stringify(aliases))
  } catch {
    /* ignore quota / private-mode errors */
  }
}
