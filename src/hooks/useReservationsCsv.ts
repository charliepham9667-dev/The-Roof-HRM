import { useQuery } from "@tanstack/react-query"

const RESERVATIONS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRr_HlsFZroA6A6CNQDQzZiDwrNDHP5c_Ly3kY-yd8IK-SUHH5W-9vSbmyp3jRiiIvhw7O8SMxopWpq/pub?gid=0&single=true&output=csv"

export type ReservationStatus = "past" | "today" | "upcoming"

export interface CsvReservation {
  submittedAt: string | null
  email: string | null
  phone: string | null
  name: string | null
  table: string | null
  notes: string | null
  dateOfReservation: string | null // YYYY-MM-DD
  dateRaw: string | null
  time: string | null
  numberOfGuests: number
  specialRequests: string | null
  specialPackages: string | null
  occasion: string | null
  mustHaves: string | null
  status: ReservationStatus
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

/**
 * Parses date strings like "17-Feb-2026", "17/02/2026", "2026-02-17", "17-Feb-2025"
 * Returns "YYYY-MM-DD" or null.
 */
function parseReservationDate(raw: string): string | null {
  const s = String(raw || "").trim()
  if (!s) return null

  // ISO: 2026-02-17
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD-Mon-YYYY or DD Mon YYYY
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  }
  const m1 = s.match(/^(\d{1,2})[-\s]([a-zA-Z]{3,})[-\s](\d{4})$/)
  if (m1) {
    const dd = m1[1].padStart(2, "0")
    const mon = monthNames[m1[2].toLowerCase().slice(0, 3)]
    const yyyy = m1[3]
    if (mon) return `${yyyy}-${mon}-${dd}`
  }

  // DD/MM/YYYY
  const m2 = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  if (m2) {
    return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`
  }

  return null
}

function getIctTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(new Date())
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`
}

function parseReservationsCsv(csvText: string): CsvReservation[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")

  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_"),
  )

  const todayIso = getIctTodayIso()
  const results: CsvReservation[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? ""
    })

    const dateRaw = row["date_of_reservation"] || row["date"] || ""
    const dateIso = parseReservationDate(dateRaw)
    if (!dateIso) continue

    // Skip clearly invalid dates (like "31-Aug-2001" spam entry)
    const year = parseInt(dateIso.slice(0, 4), 10)
    if (year < 2024 || year > 2030) continue

    let status: ReservationStatus
    if (dateIso < todayIso) status = "past"
    else if (dateIso === todayIso) status = "today"
    else status = "upcoming"

    results.push({
      submittedAt: row["date"] || null,
      email: row["email"] || null,
      phone: row["phone_number"] || null,
      name: row["name"] || null,
      table: row["table"] || null,
      notes: row["notes"] || null,
      dateOfReservation: dateIso,
      dateRaw: dateRaw,
      time: row["time"] || null,
      numberOfGuests: parseInt(row["number_of_guests"] || "0", 10) || 0,
      specialRequests: row["special_requests"] || null,
      specialPackages: row["special_packages"] || null,
      occasion: row["occasion"] || null,
      mustHaves: row["must_haves"] || null,
      status,
    })
  }

  // Sort: today first, then upcoming, then past
  results.sort((a, b) => {
    const order: Record<ReservationStatus, number> = { today: 0, upcoming: 1, past: 2 }
    const oa = order[a.status]
    const ob = order[b.status]
    if (oa !== ob) return oa - ob
    // Within same status, sort by date then time
    const dateCompare = (a.dateOfReservation || "").localeCompare(b.dateOfReservation || "")
    if (dateCompare !== 0) return dateCompare
    return (a.time || "").localeCompare(b.time || "")
  })

  return results
}

export function useReservationsCsv() {
  return useQuery({
    queryKey: ["reservations-csv"],
    queryFn: async (): Promise<CsvReservation[]> => {
      const res = await fetch(RESERVATIONS_CSV_URL)
      if (!res.ok) throw new Error(`Failed to load reservations CSV (${res.status})`)
      const text = await res.text()
      return parseReservationsCsv(text)
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5,
  })
}

/** Returns only today's reservations from the CSV */
export function useTodayReservationsCsv() {
  const { data: all, ...rest } = useReservationsCsv()
  const todayIso = getIctTodayIso()
  const todayReservations = (all || []).filter((r) => r.dateOfReservation === todayIso)
  return { data: todayReservations, ...rest }
}

/** Total confirmed pax for today (sum of numberOfGuests for today's reservations) */
export function useTodayPaxConfirmed() {
  const { data: todayReservations, isLoading } = useTodayReservationsCsv()
  const pax = (todayReservations || []).reduce((sum, r) => sum + r.numberOfGuests, 0)
  return { pax, isLoading }
}
