import { useQuery } from "@tanstack/react-query"

export type WeekAtGlanceItem = {
  dateIso: string // YYYY-MM-DD
  mode?: string | null // Club night / Lounge / etc
  eventName?: string | null
  djLines?: string[]
  promotion?: string | null
}

export type RoofCalendarEvent = {
  dateIso: string // YYYY-MM-DD
  eventName: string | null
  startTime: string | null // HH:mm
  endTime: string | null // HH:mm
  startMinutes: number | null
  dj1: string | null
  dj2: string | null
  genre: string | null
  promotion: string | null
  status: string | null
}

export type RoofCalendarWeekData = {
  byDate: WeekAtGlanceItem[]
  events: RoofCalendarEvent[]
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function normalizeHeader(h: string) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
}

function toIsoDate(raw: string): string | null {
  const s = String(raw || "").trim()
  if (!s) return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/)
  if (m) {
    const dd = m[1].padStart(2, "0")
    const mm = m[2].padStart(2, "0")
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${yy}-${mm}-${dd}`
  }

  return null
}

function pick(obj: Record<string, string>, keys: string[]) {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && String(v).trim() !== "") return String(v).trim()
  }
  return null
}

function timeToMinutes(raw: string) {
  const cleaned = String(raw || "").trim().replace(";", ":")
  const m = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

function fmtTime(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, "0")
  const mm = String(m % 60).padStart(2, "0")
  return `${hh}:${mm}`
}

function normalizeTime(raw: string): { display: string; minutes: number } | null {
  const mins = timeToMinutes(raw)
  if (mins === null) return null
  return { display: fmtTime(mins), minutes: mins }
}

function formatDjCell(cell: string | null) {
  const s = String(cell || "").trim()
  if (!s) return null
  const m = s.match(/^(?:DJ\s*)?(.+?)\s+(\d{1,2}[:;]\d{2})\s*-\s*(\d{1,2}[:;]\d{2})/i)
  if (m) {
    const name = String(m[1] || "").replace(/\s+/g, " ").trim()
    const start = normalizeTime(m[2])
    const end = normalizeTime(m[3])
    if (start && end) return `${name} ${start.display} - ${end.display}`
  }
  return s
    .replace(/^DJ\s+/i, "")
    .replace(/;/g, ":")
    .replace(/\s*-\s*/g, " - ")
}

function findHeaderRow(lines: string[]) {
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const cols = parseCsvLine(lines[i]).map(normalizeHeader)
    if (cols.includes("deadline") && cols.some((c) => c === "dj_1" || c === "dj_2" || c === "dj_3")) {
      return { header: cols, headerIdx: i }
    }
    // fallback: sometimes columns are named dj1/dj2/dj3
    if (cols.includes("deadline") && cols.some((c) => c === "dj1" || c === "dj2" || c === "dj3")) {
      return { header: cols, headerIdx: i }
    }
    // secondary fallback: allow Date + DJ columns
    if (cols.includes("date") && cols.some((c) => c.startsWith("dj"))) {
      return { header: cols, headerIdx: i }
    }
  }
  return null
}

function parseWeekCsv(csvText: string): WeekAtGlanceItem[] {
  const lines = csvText
    .split(/\r?\n/g)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")

  if (lines.length < 2) return []

  const headerInfo = findHeaderRow(lines)
  if (!headerInfo) return []
  const { header, headerIdx } = headerInfo

  function parseDjCell(cell: string) {
    const s = String(cell || "").trim()
    if (!s) return null
    // Examples:
    // "DJ Charle$ 21:30 - 23:00"
    // "DJ Charle$ 23:00 - 01;00"
    const m = s.match(/^(?:DJ\s*)?(.+?)\s+(\d{1,2}[:;]\d{2})\s*-\s*(\d{1,2}[:;]\d{2})/i)
    if (!m) return null
    const name = String(m[1] || "").replace(/\s+/g, " ").trim()
    const start = timeToMinutes(m[2])
    const end0 = timeToMinutes(m[3])
    if (start === null || end0 === null) return null
    let end = end0
    if (end < start) end += 1440 // crosses midnight
    return { name, start, end }
  }

  // Aggregate to one item per date (Week-at-a-Glance cards)
  const byDate = new Map<
    string,
    {
      djByName: Map<string, { displayName: string; start: number; end: number }>
      events: Set<string>
      promotions: Set<string>
      mode?: string | null
    }
  >()

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    header.forEach((h, idx) => {
      row[h] = cols[idx] ?? ""
    })

    // This HQ sheet uses "Deadline" as the event date column (e.g. 16.08.24).
    const dateIso = toIsoDate(pick(row, ["deadline", "date", "event_date", "calendar_date", "schedule_date"]) || "")
    if (!dateIso) continue

    // Skip cancelled rows
    const status = (pick(row, ["status"]) || "").toLowerCase()
    if (status === "cancel" || status === "cancelled" || status === "canceled") continue

    const mode = pick(row, ["mode", "club_lounge", "club_or_lounge", "night_type", "format"])

    const eventName = pick(row, ["event", "event_name", "name", "title"])
    const dj1 = pick(row, ["dj_1", "dj1", "dj_01", "dj_one"])
    const dj2 = pick(row, ["dj_2", "dj2", "dj_02", "dj_two"])
    const dj3 = pick(row, ["dj_3", "dj3", "dj_03", "dj_three"])

    // Column Q is Promotion in your sheet, but header is "Promotion" so this maps cleanly.
    const promotion = pick(row, ["promotion", "promo", "offer"])

    const cur =
      byDate.get(dateIso) || {
        djByName: new Map<string, { displayName: string; start: number; end: number }>(),
        events: new Set<string>(),
        promotions: new Set<string>(),
        mode: null,
      }

    if (mode && !cur.mode) cur.mode = mode
    if (eventName) cur.events.add(eventName)

    for (const djCell of [dj1, dj2, dj3]) {
      const parsed = parseDjCell(djCell || "")
      if (!parsed) continue
      const key = parsed.name.toLowerCase()
      const existing = cur.djByName.get(key)
      if (!existing) {
        cur.djByName.set(key, { displayName: parsed.name, start: parsed.start, end: parsed.end })
      } else {
        existing.start = Math.min(existing.start, parsed.start)
        existing.end = Math.max(existing.end, parsed.end)
      }
    }

    if (promotion) cur.promotions.add(promotion)
    byDate.set(dateIso, cur)
  }

  return Array.from(byDate.entries()).map(([dateIso, v]) => {
    const djLines = Array.from(v.djByName.entries())
      .map(([lowerName, range]) => ({ lowerName, displayName: range.displayName, start: range.start, end: range.end }))
      .sort((a, b) => a.start - b.start)
      .map((x) => `${x.displayName} ${fmtTime(x.start)} - ${fmtTime(x.end)}`)

    const eventName = v.events.size ? Array.from(v.events).join(" · ") : null
    const promotion = v.promotions.size ? Array.from(v.promotions).join(" · ") : null

    return {
      dateIso,
      mode: v.mode || null,
      eventName,
      djLines,
      promotion,
    }
  })
}

function parseRoofCalendarEvents(csvText: string): RoofCalendarEvent[] {
  const lines = csvText
    .split(/\r?\n/g)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")

  if (lines.length < 2) return []

  const headerInfo = findHeaderRow(lines)
  if (!headerInfo) return []
  const { header, headerIdx } = headerInfo

  const out: RoofCalendarEvent[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    header.forEach((h, idx) => {
      row[h] = cols[idx] ?? ""
    })

    const dateIso = toIsoDate(pick(row, ["deadline", "date", "event_date", "calendar_date", "schedule_date"]) || "")
    if (!dateIso) continue

    const statusRaw = pick(row, ["status"]) || null
    const status = (statusRaw || "").toLowerCase()
    if (status === "cancel" || status === "cancelled" || status === "canceled") continue

    const eventName = pick(row, ["event", "event_name", "name", "title"]) || null
    const startCell = pick(row, ["start", "start_time", "time_start", "event_start", "start_at"])
    const endCell = pick(row, ["end", "end_time", "time_end", "event_end", "end_at"])
    const start = startCell ? normalizeTime(startCell) : null
    const end = endCell ? normalizeTime(endCell) : null

    const dj1 = formatDjCell(pick(row, ["dj_1", "dj1", "dj_01", "dj_one"]) || null)
    const dj2 = formatDjCell(pick(row, ["dj_2", "dj2", "dj_02", "dj_two"]) || null)

    const genre = pick(row, ["genre", "music_genre", "music", "genre_s", "genres"]) || null
    const promotion = pick(row, ["promotion", "promo", "offer"]) || null

    out.push({
      dateIso,
      eventName,
      startTime: start?.display || null,
      endTime: end?.display || null,
      startMinutes: start?.minutes ?? null,
      dj1,
      dj2,
      genre,
      promotion,
      status: statusRaw,
    })
  }

  return out
}

export function useRoofCalendarWeekData() {
  const url = (import.meta as any).env?.VITE_HQ_WEEK_AT_A_GLANCE_CSV_URL as string | undefined

  return useQuery({
    queryKey: ["roof-calendar-week-data", url],
    queryFn: async (): Promise<RoofCalendarWeekData> => {
      if (!url) return { byDate: [], events: [] }
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to load week CSV (${res.status})`)
      const text = await res.text()
      return { byDate: parseWeekCsv(text), events: parseRoofCalendarEvents(text) }
    },
    enabled: Boolean(url),
    staleTime: 1000 * 60 * 5,
  })
}

export function useWeekAtGlanceCsv() {
  const q = useRoofCalendarWeekData()
  return {
    ...q,
    data: q.data?.byDate ?? [],
  }
}

