import Papa from "papaparse"
import type { AdsManualMetricInput, AdsPlatform } from "@/hooks/useAdsIntegrations"

export type CsvParseResult = {
  rows: AdsManualMetricInput[]
  skipped: Array<{ line: number; reason: string }>
  columnsDetected: Record<string, string | null>
  totalRowsParsed: number
  headerRowIndex: number
  diagnostic?: string | null
}

const FIELD_ALIASES: Record<
  AdsPlatform,
  {
    campaignId: string[]
    campaignName: string[]
    metricDate: string[]
    spend: string[]
    impressions: string[]
    clicks: string[]
    conversions: string[]
    revenue: string[]
  }
> = {
  google_ads: {
    campaignId: ["campaign id", "campaignid"],
    campaignName: ["campaign", "campaign name"],
    metricDate: ["day", "date", "week", "month", "segments.date"],
    spend: [
      "cost",
      "cost (converted currency)",
      "cost usd",
      "cost eur",
      "cost gbp",
      "cost vnd",
      "amount spent",
      "spend",
    ],
    impressions: ["impressions", "impr.", "impr", "impressions (abs.)"],
    clicks: ["clicks", "interactions"],
    conversions: ["conversions", "all conv.", "all conversions"],
    revenue: [
      "conv. value",
      "conv value",
      "conversion value",
      "all conv. value",
      "all conversion value",
    ],
  },
  facebook_ads: {
    campaignId: ["campaign id"],
    campaignName: ["campaign name", "campaign"],
    metricDate: ["reporting starts", "day", "date"],
    spend: [
      "amount spent (usd)",
      "amount spent (vnd)",
      "amount spent",
      "spend",
      "amount spent (eur)",
      "amount spent (gbp)",
    ],
    impressions: ["impressions"],
    clicks: [
      "link clicks",
      "clicks (all)",
      "clicks",
      "outbound clicks",
      "unique link clicks",
    ],
    conversions: [
      "results",
      "purchases",
      "website purchases",
      "leads",
      "conversions",
    ],
    revenue: [
      "purchase conversion value",
      "website purchase conversion value",
      "purchases conversion value",
      "conversion value",
      "total conversion value",
    ],
  },
  tiktok_ads: {
    campaignId: ["campaign id", "campaign_id"],
    campaignName: ["campaign name", "campaign", "campaign_name"],
    metricDate: ["by day", "date", "stat time day", "stat_time_day"],
    spend: ["cost", "spend", "total cost"],
    impressions: ["impressions", "impression"],
    clicks: ["clicks (destination)", "clicks", "click"],
    conversions: [
      "total conversion",
      "conversion",
      "conversions",
      "total complete payment",
    ],
    revenue: [
      "total complete payment value",
      "total conversion value",
      "complete payment roas",
      "revenue",
    ],
  },
}

function normaliseKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ")
}

function buildColumnIndex(headers: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const header of headers) {
    if (typeof header !== "string") continue
    const key = normaliseKey(header)
    if (!key) continue
    if (!map.has(key)) map.set(key, header)
  }
  return map
}

function resolveColumn(index: Map<string, string>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const key = normaliseKey(alias)
    const match = index.get(key)
    if (match) return match
  }
  const norms = Array.from(index.entries())
  for (const alias of aliases) {
    const key = normaliseKey(alias)
    const starts = norms.find(([k]) => k.startsWith(key + " ") || k.startsWith(key + "("))
    if (starts) return starts[1]
  }
  return null
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const raw = String(value).trim()
  if (!raw || raw === "--" || raw.toLowerCase() === "n/a") return 0
  const cleaned = raw.replace(/[,\s]/g, "").replace(/[^0-9.\-]/g, "")
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const ddmmyyyy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (ddmmyyyy) {
    const [, a, b, c] = ddmmyyyy
    const yyyy = c.length === 2 ? `20${c}` : c
    if (Number(b) > 12 && Number(a) <= 12) {
      return `${yyyy.padStart(4, "0")}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`
    }
    return `${yyyy.padStart(4, "0")}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`
  }
  const parsed = new Date(raw)
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function collectAllAliasKeys(platform: AdsPlatform): Set<string> {
  const aliases = FIELD_ALIASES[platform]
  const set = new Set<string>()
  for (const list of Object.values(aliases)) {
    for (const a of list) set.add(normaliseKey(a))
  }
  return set
}

function findHeaderRowIndex(rows: string[][], platform: AdsPlatform): number {
  const aliasKeys = collectAllAliasKeys(platform)
  const limit = Math.min(rows.length, 25)
  let bestIdx = -1
  let bestScore = 0
  for (let i = 0; i < limit; i += 1) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    let score = 0
    for (const cell of row) {
      if (typeof cell !== "string") continue
      const key = normaliseKey(cell)
      if (!key) continue
      if (aliasKeys.has(key)) {
        score += 1
        continue
      }
      for (const alias of aliasKeys) {
        if (key.startsWith(alias + " ") || key.startsWith(alias + "(")) {
          score += 1
          break
        }
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestScore >= 2 ? bestIdx : -1
}

export function parseAdsCsv(
  text: string,
  platform: AdsPlatform,
  accountId: string,
): CsvParseResult {
  const aliases = FIELD_ALIASES[platform]
  const cleanText = text.replace(/^\uFEFF/, "")

  const rawParsed = Papa.parse<string[]>(cleanText, {
    header: false,
    skipEmptyLines: "greedy",
  })

  const allRows = (rawParsed.data || []).filter((r) => Array.isArray(r) && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""))

  if (allRows.length === 0) {
    return {
      rows: [],
      skipped: [],
      columnsDetected: {
        campaignId: null,
        campaignName: null,
        metricDate: null,
        spend: null,
        impressions: null,
        clicks: null,
        conversions: null,
        revenue: null,
      },
      totalRowsParsed: 0,
      headerRowIndex: -1,
      diagnostic: "File appears to be empty.",
    }
  }

  const headerIdx = findHeaderRowIndex(allRows, platform)
  if (headerIdx === -1) {
    const preview = allRows.slice(0, 5).map((r) => r.join(" | ")).join("\n")
    return {
      rows: [],
      skipped: [],
      columnsDetected: {
        campaignId: null,
        campaignName: null,
        metricDate: null,
        spend: null,
        impressions: null,
        clicks: null,
        conversions: null,
        revenue: null,
      },
      totalRowsParsed: allRows.length,
      headerRowIndex: -1,
      diagnostic:
        "Couldn't find a recognizable header row. Make sure the CSV contains columns like Campaign, Day, Impressions/Impr., Cost, Clicks. First rows were:\n" +
        preview,
    }
  }

  const headerRow = allRows[headerIdx].map((cell) => (typeof cell === "string" ? cell.trim() : String(cell ?? "")))
  const dataRows = allRows.slice(headerIdx + 1)
  const index = buildColumnIndex(headerRow)

  const columnsDetected = {
    campaignId: resolveColumn(index, aliases.campaignId),
    campaignName: resolveColumn(index, aliases.campaignName),
    metricDate: resolveColumn(index, aliases.metricDate),
    spend: resolveColumn(index, aliases.spend),
    impressions: resolveColumn(index, aliases.impressions),
    clicks: resolveColumn(index, aliases.clicks),
    conversions: resolveColumn(index, aliases.conversions),
    revenue: resolveColumn(index, aliases.revenue),
  }

  const colIndexFor = (header: string | null): number => {
    if (!header) return -1
    return headerRow.findIndex((h) => h === header)
  }

  const idxCampaignName = colIndexFor(columnsDetected.campaignName)
  const idxCampaignId = colIndexFor(columnsDetected.campaignId)
  const idxMetricDate = colIndexFor(columnsDetected.metricDate)
  const idxSpend = colIndexFor(columnsDetected.spend)
  const idxImpressions = colIndexFor(columnsDetected.impressions)
  const idxClicks = colIndexFor(columnsDetected.clicks)
  const idxConversions = colIndexFor(columnsDetected.conversions)
  const idxRevenue = colIndexFor(columnsDetected.revenue)

  const rows: AdsManualMetricInput[] = []
  const skipped: CsvParseResult["skipped"] = []

  const todayIso = new Date().toISOString().slice(0, 10)

  for (let i = 0; i < dataRows.length; i += 1) {
    const row = dataRows[i]
    const lineNumber = headerIdx + i + 2
    if (!Array.isArray(row)) {
      skipped.push({ line: lineNumber, reason: "empty row" })
      continue
    }

    const rawName = idxCampaignName >= 0 ? String(row[idxCampaignName] ?? "").trim() : ""
    if (!rawName) {
      skipped.push({ line: lineNumber, reason: "missing campaign name" })
      continue
    }
    const nameLower = rawName.toLowerCase()
    if (
      nameLower === "total" ||
      nameLower.startsWith("total:") ||
      nameLower.startsWith("total —") ||
      nameLower.startsWith("total -") ||
      nameLower.startsWith("grand total")
    ) {
      skipped.push({ line: lineNumber, reason: "aggregate total row" })
      continue
    }

    const rawId = idxCampaignId >= 0 ? String(row[idxCampaignId] ?? "").trim() : ""
    const campaignId = rawId || rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64)

    let metricDate: string | null = null
    if (idxMetricDate >= 0) {
      metricDate = parseDate(row[idxMetricDate])
    }
    if (!metricDate) metricDate = todayIso

    const spend = idxSpend >= 0 ? parseNumber(row[idxSpend]) : 0
    const impressions = idxImpressions >= 0 ? Math.round(parseNumber(row[idxImpressions])) : 0
    const clicks = idxClicks >= 0 ? Math.round(parseNumber(row[idxClicks])) : 0
    const conversions = idxConversions >= 0 ? parseNumber(row[idxConversions]) : 0
    const revenue = idxRevenue >= 0 ? parseNumber(row[idxRevenue]) : 0

    if (spend === 0 && impressions === 0 && clicks === 0) {
      skipped.push({ line: lineNumber, reason: "no spend/impressions/clicks" })
      continue
    }

    const originalRow: Record<string, string> = {}
    for (let c = 0; c < headerRow.length; c += 1) {
      originalRow[headerRow[c]] = typeof row[c] === "string" ? (row[c] as string) : String(row[c] ?? "")
    }

    rows.push({
      platform,
      account_id: accountId,
      campaign_id: campaignId,
      campaign_name: rawName,
      metric_date: metricDate,
      spend,
      impressions,
      clicks,
      conversions,
      revenue,
      raw_payload: {
        source: "csv_upload",
        original_headers: headerRow,
        original_row: originalRow,
      },
    })
  }

  const dateFallbackUsed = idxMetricDate === -1
  const diagnostic = dateFallbackUsed
    ? "No per-day date column detected — imported rows were tagged with today's date. For a daily breakdown, segment by Time → Day in the Ads Manager before exporting."
    : null

  return {
    rows,
    skipped,
    columnsDetected,
    totalRowsParsed: dataRows.length,
    headerRowIndex: headerIdx,
    diagnostic,
  }
}
