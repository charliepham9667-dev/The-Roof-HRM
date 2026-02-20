import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DJPayment {
  id: string
  sync_key: string | null
  date: string
  event_name: string
  event_type: string
  dj_name: string
  dj_type: "foreigner" | "local" | null
  set_start: string | null   // "HH:MM:SS"
  set_end: string | null
  duration_hours: number | null
  base_rate_vnd: number
  multiplier: number
  amount_vnd: number | null
  amount_override: boolean
  payer_type: "foreigner_charlie" | "local_company" | null
  status: "scheduled" | "done" | "no_show"
  payment_status: "paid" | "unpaid" | "na"
  receipt_uploaded: boolean
  notes: string | null
  synced_from_sheet: boolean
  created_at: string
  updated_at: string
}

export type UpdateDJPaymentInput = Partial<Pick<
  DJPayment,
  "status" | "payment_status" | "amount_vnd" | "amount_override" |
  "receipt_uploaded" | "notes" | "payer_type" | "dj_type"
>>

export interface CreateDJPaymentInput {
  date: string
  event_name: string
  event_type: string
  dj_name: string
  dj_type?: "foreigner" | "local"
  set_start?: string
  set_end?: string
  duration_hours?: number
  base_rate_vnd?: number
  multiplier?: number
  amount_vnd?: number
  payer_type?: "foreigner_charlie" | "local_company"
  status?: "scheduled" | "done" | "no_show"
  payment_status?: "paid" | "unpaid" | "na"
  receipt_uploaded?: boolean
  notes?: string
  amount_override?: boolean
}

// ── Payer classification ───────────────────────────────────────────────────────

// DJs who are the owner — fee is always 0, displayed as "Owner"
const OWNER_DJS = new Set(["charles", "charle$"])

const FOREIGNER_DJS = new Set(["throbak", "amor"])

export function isOwnerDJ(name: string): boolean {
  return OWNER_DJS.has(name.toLowerCase().replace(/\$/g, "s"))
}

export function classifyDJPayer(name: string): "foreigner_charlie" | "local_company" {
  // Owner DJs and local DJs both have the company/owner footing the bill
  if (isOwnerDJ(name)) return "local_company"
  return FOREIGNER_DJS.has(name.toLowerCase().replace(/\$/g, "s"))
    ? "foreigner_charlie"
    : "local_company"
}

export function classifyDJType(name: string): "foreigner" | "local" {
  if (isOwnerDJ(name)) return "local"
  return FOREIGNER_DJS.has(name.toLowerCase().replace(/\$/g, "s")) ? "foreigner" : "local"
}

// ── Sync helpers ──────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
      continue
    }
    if (ch === "," && !inQuotes) { out.push(cur); cur = ""; continue }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function normalizeHeader(h: string) {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "_")
}

function pick(obj: Record<string, string>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && String(v).trim() !== "") return String(v).trim()
  }
  return null
}

function toIsoDate(raw: string): string | null {
  const s = String(raw || "").trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/)
  if (m) {
    const dd = m[1].padStart(2, "0")
    const mm = m[2].padStart(2, "0")
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${yy}-${mm}-${dd}`
  }
  return null
}

function timeToMinutes(raw: string): number | null {
  const cleaned = String(raw || "").trim().replace(";", ":")
  const m = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hh = Number(m[1])
  const mm2 = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm2)) return null
  return hh * 60 + mm2
}

function minutesToTimeStr(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, "0")
  const mm2 = String(m % 60).padStart(2, "0")
  return `${hh}:${mm2}:00`
}

/** Parse "DJ CharleS 21:30 - 23:00" → { name, startMins, endMins } */
function parseDjCell(cell: string | null): { name: string; startMins: number; endMins: number } | null {
  const s = String(cell || "").trim()
  if (!s || s === "—") return null
  const m = s.match(/^(?:DJ\s*)?(.+?)\s+(\d{1,2}[:;]\d{2})\s*-\s*(\d{1,2}[:;]\d{2})/i)
  if (m) {
    const name = m[1].replace(/\s+/g, " ").trim()
    const startMins = timeToMinutes(m[2])
    let endMins = timeToMinutes(m[3])
    if (startMins !== null && endMins !== null) {
      if (endMins < startMins) endMins += 1440 // crosses midnight
      return { name, startMins, endMins }
    }
  }
  // name only — no times, skip (can't calculate payment without times)
  return null
}

function mapEventType(eventName: string, layout: string): "default" | "tet" | "new_year" | "partnership" {
  const ev = (eventName || "").toLowerCase()
  const ly = (layout || "").toLowerCase()
  if (ev.includes("tết") || ev.includes("tet") || ev.includes("mùng") || ev.includes("mung")) return "tet"
  if (ev.includes("new year") || ev.includes("nye")) return "new_year"
  if (ly.includes("partner")) return "partnership"
  return "default"
}

const MULTIPLIERS: Record<string, number> = {
  default: 1.0,
  tet: 1.5,
  new_year: 1.5,
  partnership: 1.0,
}
const BASE_RATE_VND = 500_000

interface SyncPayload {
  sync_key: string
  date: string
  event_name: string
  event_type: string
  dj_name: string
  dj_type: "foreigner" | "local"
  set_start: string
  set_end: string
  duration_hours: number
  base_rate_vnd: number
  multiplier: number
  payer_type: "foreigner_charlie" | "local_company"
  status: "scheduled" | "done"
  synced_from_sheet: boolean
}

export function parseDJPaymentsFromCsv(csvText: string, todayIso: string): SyncPayload[] {
  const lines = csvText.split(/\r?\n/g).map((l) => l.trimEnd()).filter(Boolean)
  if (lines.length < 2) return []

  // Find header row (has "deadline" or "date" + dj columns)
  let headerIdx = -1
  let header: string[] = []
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const cols = parseCsvLine(lines[i]).map(normalizeHeader)
    const hasDj = cols.some((c) => c === "dj_1" || c === "dj1" || c.startsWith("dj_"))
    const hasDate = cols.includes("deadline") || cols.includes("date")
    if (hasDate && hasDj) { header = cols; headerIdx = i; break }
  }
  if (headerIdx === -1) return []

  const START_ISO = "2026-01-01"
  const out: SyncPayload[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    header.forEach((h, idx) => { row[h] = cols[idx] ?? "" })

    const dateIso = toIsoDate(pick(row, ["deadline", "date", "event_date"]) || "")
    if (!dateIso) continue
    if (dateIso < START_ISO || dateIso > todayIso) continue

    const statusRaw = (pick(row, ["status"]) || "").toLowerCase()
    if (statusRaw === "cancel" || statusRaw === "cancelled") continue

    const eventName = pick(row, ["event", "event_name", "name", "title"]) || "Event"
    const layout = pick(row, ["layout", "mode", "format", "club_lounge"]) || ""
    const eventType = mapEventType(eventName, layout)
    const multiplier = MULTIPLIERS[eventType] ?? 1.0
    const rowStatus: "scheduled" | "done" = dateIso > todayIso ? "scheduled" : "done"

    for (const djKey of ["dj_1", "dj1", "dj_01", "dj_2", "dj2", "dj_02", "dj_3", "dj3", "dj_03"]) {
      const raw = pick(row, [djKey])
      if (!raw) continue
      const parsed = parseDjCell(raw)
      if (!parsed) continue

      const durationH = Math.round(((parsed.endMins - parsed.startMins) / 60) * 100) / 100
      const syncKey = `${dateIso}:${eventName.toLowerCase().slice(0, 30)}:${parsed.name.toLowerCase()}:${minutesToTimeStr(parsed.startMins)}`

      out.push({
        sync_key: syncKey,
        date: dateIso,
        event_name: eventName,
        event_type: eventType,
        dj_name: parsed.name,
        dj_type: classifyDJType(parsed.name),
        set_start: minutesToTimeStr(parsed.startMins),
        set_end: minutesToTimeStr(parsed.endMins),
        duration_hours: durationH,
        base_rate_vnd: BASE_RATE_VND,
        multiplier,
        payer_type: classifyDJPayer(parsed.name),
        status: rowStatus,
        synced_from_sheet: true,
      })
    }
  }

  // Deduplicate by sync_key (keep last)
  const map = new Map<string, SyncPayload>()
  for (const p of out) map.set(p.sync_key, p)
  return Array.from(map.values())
}

// ── Query key ─────────────────────────────────────────────────────────────────

const QK = ["dj_payments"] as const

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useDJPayments() {
  return useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dj_payments")
        .select("*")
        .order("date", { ascending: true })
        .order("set_start", { ascending: true })
      if (error) throw error
      return (data ?? []) as DJPayment[]
    },
  })
}

export function useUpdateDJPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateDJPaymentInput & { id: string }) => {
      const { data, error } = await supabase
        .from("dj_payments")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as DJPayment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK })
    },
  })
}

export function useCreateDJPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateDJPaymentInput) => {
      const payload = {
        ...input,
        dj_type: input.dj_type ?? classifyDJType(input.dj_name),
        payer_type: input.payer_type ?? classifyDJPayer(input.dj_name),
        base_rate_vnd: input.base_rate_vnd ?? BASE_RATE_VND,
        multiplier: input.multiplier ?? 1.0,
        synced_from_sheet: false,
      }
      const { data, error } = await supabase
        .from("dj_payments")
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as DJPayment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK })
    },
  })
}

// ── Sync hook ─────────────────────────────────────────────────────────────────

export interface DJSyncResult {
  upserted: number
  skipped: number
  errors: string[]
  unmappedDJs: string[]
}

export function useDJPaymentsSync() {
  const queryClient = useQueryClient()

  const sync = async (): Promise<DJSyncResult> => {
    const result: DJSyncResult = { upserted: 0, skipped: 0, errors: [], unmappedDJs: [] }

    const csvUrl = (import.meta as any).env?.VITE_HQ_WEEK_AT_A_GLANCE_CSV_URL as string | undefined
    if (!csvUrl) {
      result.errors.push("VITE_HQ_WEEK_AT_A_GLANCE_CSV_URL is not set.")
      return result
    }

    let csvText: string
    try {
      const res = await fetch(csvUrl, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      csvText = await res.text()
      if (csvText.trim().startsWith("<!")) throw new Error("Got HTML instead of CSV")
    } catch (e) {
      result.errors.push(`Failed to fetch CSV: ${e}`)
      return result
    }

    const todayIso = new Date().toISOString().slice(0, 10)
    const payloads = parseDJPaymentsFromCsv(csvText, todayIso)

    if (payloads.length === 0) {
      result.errors.push("No DJ rows found in CSV. Check VITE_HQ_WEEK_AT_A_GLANCE_CSV_URL.")
      return result
    }

    // Track any DJ names not in the known payer map (for report-back)
    const KNOWN = new Set(["charles", "charle$", "throbak", "amor", "dark", "kazho", "dcrown", "cece"])
    for (const p of payloads) {
      const key = p.dj_name.toLowerCase().replace(/\$/g, "s")
      if (!KNOWN.has(key)) result.unmappedDJs.push(p.dj_name)
    }

    // Upsert in batches — on conflict(sync_key) update everything EXCEPT
    // payment_status (if already set) and amount_vnd (if amount_override=true).
    // We do this with a two-step approach:
    // 1. Load existing rows to know which ones need protection
    // 2. For new rows: full upsert; for existing with overrides: partial update only
    const { data: existingRows, error: fetchErr } = await supabase
      .from("dj_payments")
      .select("id, sync_key, payment_status, amount_override")
      .not("sync_key", "is", null)

    if (fetchErr) {
      result.errors.push(`Failed to load existing rows: ${fetchErr.message}`)
      return result
    }

    const existingMap = new Map<string, { id: string; paymentStatus: string; amountOverride: boolean }>()
    for (const r of existingRows ?? []) {
      if (r.sync_key) existingMap.set(r.sync_key, {
        id: r.id,
        paymentStatus: r.payment_status,
        amountOverride: r.amount_override,
      })
    }

    const BATCH = 50
    for (let i = 0; i < payloads.length; i += BATCH) {
      const batch = payloads.slice(i, i + BATCH)

      // Split batch into new rows and existing rows needing protection
      const newRows: typeof batch = []
      const existingUpdates: Array<{ id: string; payload: Partial<SyncPayload> }> = []

      for (const p of batch) {
        const existing = existingMap.get(p.sync_key)
        if (!existing) {
          newRows.push(p)
        } else {
          // Build safe update: never overwrite payment_status, protect amount if override
          const update: Partial<SyncPayload> = {
            date: p.date,
            event_name: p.event_name,
            event_type: p.event_type,
            dj_type: p.dj_type,
            set_start: p.set_start,
            set_end: p.set_end,
            duration_hours: p.duration_hours,
            base_rate_vnd: p.base_rate_vnd,
            multiplier: p.multiplier,
            payer_type: p.payer_type,
            status: p.status,
          }
          // Only update amount if not manually overridden
          if (!existing.amountOverride) {
            (update as any).amount_vnd = isOwnerDJ(p.dj_name) ? 0 : Math.round(p.duration_hours * p.base_rate_vnd * p.multiplier)
          }
          existingUpdates.push({ id: existing.id, payload: update })
        }
      }

      // Insert new rows — owner DJs get amount 0 and payment N/A
      if (newRows.length > 0) {
        const rowsToInsert = newRows.map((p) => {
          const owner = isOwnerDJ(p.dj_name)
          return {
            ...p,
            payment_status: owner ? "na" : "unpaid",
            amount_vnd: owner ? 0 : Math.round(p.duration_hours * p.base_rate_vnd * p.multiplier),
          }
        })

        const { error: insertErr } = await supabase
          .from("dj_payments")
          .upsert(rowsToInsert, { onConflict: "sync_key", ignoreDuplicates: false })

        if (insertErr) {
          result.errors.push(`Insert error (batch ${i / BATCH + 1}): ${insertErr.message}`)
          result.skipped += newRows.length
        } else {
          result.upserted += newRows.length
        }
      }

      // Update existing rows safely
      for (const { id, payload } of existingUpdates) {
        const { error: updateErr } = await supabase
          .from("dj_payments")
          .update(payload)
          .eq("id", id)

        if (updateErr) {
          result.errors.push(`Update error for ${id}: ${updateErr.message}`)
          result.skipped++
        } else {
          result.upserted++
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: QK })
    return result
  }

  return { sync }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatVndAmount(amount: number | null): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat("vi-VN").format(amount)
}

export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "—"
  const fmt = (t: string) => t.slice(0, 5) // "HH:MM"
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start)
}
