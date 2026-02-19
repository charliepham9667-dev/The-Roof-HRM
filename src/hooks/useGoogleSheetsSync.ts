import { useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"

// ── February content tab CSV URL ─────────────────────────────────────────────
// To update: File → Share → Publish to web → select tab → CSV → copy link
const GSHEET_PATH =
  "/spreadsheets/d/e/2PACX-1vShOo7qWcL693R7xonSB2XiFa_dh9-QUe9eXV86TahCfaCEA6aAw0gMWkOP3-ELv0Jj4UhT1Agdy5I5/pub?gid=1310601959&single=true&output=csv"

// Use Vite dev proxy to avoid CORS; in production fetch directly
export const GSHEET_CSV_URL =
  import.meta.env.DEV
    ? `/gsheets-proxy${GSHEET_PATH}`
    : `https://docs.google.com${GSHEET_PATH}`

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  upserted: number
  skipped: number
  errors: string[]
}

// ── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(cell)
        cell = ""
      } else if (ch === '\r' && next === '\n') {
        row.push(cell)
        cell = ""
        rows.push(row)
        row = []
        i++
      } else if (ch === '\n') {
        row.push(cell)
        cell = ""
        rows.push(row)
        row = []
      } else {
        cell += ch
      }
    }
  }
  // last row
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** Parse DD/MM/YYYY → YYYY-MM-DD */
function parseDateDMY(raw: string): string | null {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

/** Map Google Sheet pillar → our pillar key stored in notes */
function mapPillar(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (v.includes("vietnamese") || v.includes("holiday")) return "holidays"
  if (v.includes("announce") || v.includes("promo")) return "announcements"
  if (v.includes("reel") || v.includes("trend")) return "reels"
  if (v.includes("community") || v.includes("guest")) return "community"
  if (v.includes("drink") || v.includes("shisha") || v.includes("experience")) return "drinks"
  if (v.includes("atmosphere") || v.includes("rooftop") || v.includes("vibe")) return "atmosphere"
  if (v.includes("event") || v.includes("dj")) return "events_djs"
  return "events_djs"
}

/** Map platform string → our enum */
function mapPlatform(raw: string): "instagram" | "facebook" | "tiktok" | "all" {
  const v = raw.trim().toLowerCase()
  if (v.includes("tiktok") && (v.includes("instagram") || v.includes("facebook"))) return "all"
  if (v.includes("facebook") && v.includes("instagram")) return "all"
  if (v.includes("tiktok")) return "tiktok"
  if (v.includes("facebook")) return "facebook"
  if (v.includes("instagram")) return "instagram"
  return "all"
}

/** Map format string → our content_type enum */
function mapFormat(raw: string): "post" | "story" | "reel" | "video" | "carousel" | null {
  const v = raw.trim().toLowerCase()
  if (v.includes("reel")) return "reel"
  if (v.includes("video")) return "video"
  if (v.includes("story")) return "story"
  if (v.includes("carousel")) return "carousel"
  if (v.includes("poster") || v.includes("photo") || v.includes("meme")) return "post"
  return null
}

/** Map status string → our status enum */
function mapStatus(raw: string): "draft" | "scheduled" | "published" | "cancelled" {
  const v = raw.trim()
  if (v.includes("Published") || v.includes("✔")) return "published"
  if (v.includes("Scheduled") || v.includes("📅")) return "scheduled"
  if (v.includes("Cancelled") || v.includes("❌")) return "cancelled"
  if (v.includes("In Progress") || v.includes("📝")) return "draft"
  return "draft"
}

/** Extract the first URL from a cell that might contain "Link Photo:\nhttps://..." */
function extractUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Look for http(s):// URL
  const match = trimmed.match(/https?:\/\/[^\s]+/)
  return match ? match[0] : null
}

/** Build a stable dedup key for a row */
function buildGsheetId(date: string, title: string, platform: string): string {
  return `gsheet:${date}:${title.trim().toLowerCase().slice(0, 40)}:${platform}`
}

// ── Column indices (0-based) from header: Date,Pillar,Format,Platform,Title/Ideas,Caption,Link Brief,Link Photo/Video,Status,Notes,Link air ──
const COL = {
  date: 0,
  pillar: 1,
  format: 2,
  platform: 3,
  title: 4,
  caption: 5,
  linkBrief: 6,
  linkMedia: 7,
  status: 8,
  notes: 9,
  linkAir: 10,
} as const

// ── Module-level mutex + cooldown ────────────────────────────────────────────
// Shared across ALL instances of the hook in the same JS bundle.
// Prevents duplicate syncs from: StrictMode double-invoke, multiple components
// calling sync(), or rapid re-mounts.
let syncInProgress = false
let lastSyncTimestamp = 0
const SYNC_COOLDOWN_MS = 60_000 // don't re-sync within 60 seconds

// ── Main sync hook ────────────────────────────────────────────────────────────

export function useGoogleSheetsSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sync = useCallback(async (): Promise<SyncResult> => {
    const result: SyncResult = { upserted: 0, skipped: 0, errors: [] }

    // Bail out if a sync is already running or ran recently
    if (syncInProgress) return result
    if (Date.now() - lastSyncTimestamp < SYNC_COOLDOWN_MS) return result
    syncInProgress = true

    setIsSyncing(true)
    setError(null)

    try {
      // 1. Fetch CSV (Google Sheets published URLs support CORS; follow redirects)
      const res = await fetch(GSHEET_CSV_URL, { redirect: "follow" })
      if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`)
      const text = await res.text()
      // Sanity-check: if we got HTML instead of CSV (e.g. redirect error), bail out
      if (text.trimStart().startsWith("<!")) {
        throw new Error("Google Sheets returned an HTML page instead of CSV. Check the published link.")
      }

      // 2. Parse
      const allRows = parseCSV(text)

      // Find the header row (contains "Date" in column 0)
      const headerIdx = allRows.findIndex(
        (r) => r[COL.date]?.trim().toLowerCase() === "date"
      )
      if (headerIdx === -1) throw new Error("Could not find header row in CSV")

      const dataRows = allRows.slice(headerIdx + 1)

      // 3. Map rows → upsert payloads
      let lastDate: string | null = null

      const toUpsert: Array<{
        scheduled_date: string
        scheduled_time: string
        platform: string
        content_type: string | null
        caption: string | null
        media_url: string | null
        status: string
        notes: string
      }> = []

      for (const row of dataRows) {
        // Skip completely empty rows or the trailing "____" sentinel
        if (row.every((c) => !c.trim()) || row[0]?.trim() === "____") continue

        const rawDate = row[COL.date]?.trim() ?? ""
        const parsedDate = parseDateDMY(rawDate)

        // Rows with no date inherit from the previous row's date
        if (parsedDate) lastDate = parsedDate
        const date = lastDate
        if (!date) continue // skip if we have no date context yet

        const rawTitle = row[COL.title]?.trim() ?? ""
        const rawPlatform = row[COL.platform]?.trim() ?? ""
        const rawPillar = row[COL.pillar]?.trim() ?? ""
        const rawFormat = row[COL.format]?.trim() ?? ""
        const rawCaption = row[COL.caption]?.trim() ?? ""
        const rawStatus = row[COL.status]?.trim() ?? ""
        const rawMedia = row[COL.linkMedia]?.trim() ?? ""
        const rawBrief = row[COL.linkBrief]?.trim() ?? ""
        const rawNotes = row[COL.notes]?.trim() ?? ""
        const rawLinkAir = row[COL.linkAir]?.trim() ?? ""

        const platform = mapPlatform(rawPlatform)
        const gsheetId = buildGsheetId(date, rawTitle, platform)

        // Build notes metadata block
        const noteParts: string[] = [`gsheet_id:${gsheetId}`]
        if (rawTitle) noteParts.push(`title:${rawTitle}`)
        if (rawPillar) noteParts.push(`pillar:${mapPillar(rawPillar)}`)
        if (rawBrief) noteParts.push(`brief:${rawBrief}`)
        if (rawLinkAir) noteParts.push(`link_air:${rawLinkAir}`)
        if (rawNotes) noteParts.push(`sheet_notes:${rawNotes}`)
        const notesStr = noteParts.join("\n")

        // Prefer Link Photo/Video column; fall back to Link air column
        const mediaUrl = extractUrl(rawMedia) || extractUrl(rawLinkAir)

        toUpsert.push({
          scheduled_date: date,
          scheduled_time: "18:00:00",
          platform,
          content_type: mapFormat(rawFormat),
          caption: rawCaption || null,
          media_url: mediaUrl,
          status: mapStatus(rawStatus),
          notes: notesStr,
        })
      }

      // 4. Load all existing synced rows in one query, build gsheet_id → DB id map
      const { data: existingRows, error: fetchErr } = await supabase
        .from("content_calendar")
        .select("id, notes")
        .like("notes", "gsheet_id:%")

      if (fetchErr) throw new Error(`Failed to load existing rows: ${fetchErr.message}`)

      // Map: gsheet_id value → DB row id
      const existingMap = new Map<string, string>()
      for (const row of existingRows ?? []) {
        // notes starts with "gsheet_id:<value>\n..." — extract the exact key
        const firstLine = (row.notes ?? "").split("\n")[0]
        if (firstLine.startsWith("gsheet_id:")) {
          existingMap.set(firstLine, row.id)
        }
      }

      // 5. Insert or update each row
      for (const payload of toUpsert) {
        try {
          const gsheetKey = payload.notes.split("\n")[0] // "gsheet_id:<value>"
          const existingId = existingMap.get(gsheetKey)

          if (existingId) {
            // Update existing row
            const { error: updateErr } = await supabase
              .from("content_calendar")
              .update(payload)
              .eq("id", existingId)

            if (updateErr) {
              result.errors.push(`Update error for ${gsheetKey}: ${updateErr.message}`)
            } else {
              result.upserted++
            }
          } else {
            // Insert new row
            const { error: insertErr } = await supabase
              .from("content_calendar")
              .insert(payload)

            if (insertErr) {
              result.errors.push(`Insert error for ${gsheetKey}: ${insertErr.message}`)
            } else {
              result.upserted++
              // Add to map so subsequent syncs within same session don't re-insert
              existingMap.set(gsheetKey, "pending")
            }
          }
        } catch (rowErr) {
          result.errors.push(String(rowErr))
          result.skipped++
        }
      }

      lastSyncTimestamp = Date.now()
      setLastSynced(new Date())
      setLastResult(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      result.errors.push(msg)
    } finally {
      syncInProgress = false
      setIsSyncing(false)
    }

    return result
  }, [])

  return { sync, isSyncing, lastSynced, lastResult, error }
}
