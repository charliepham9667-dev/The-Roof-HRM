import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { parseGoogleSheetUrl, useOperationsSheetLink, type OperationsSheetKind } from "@/hooks/useOperationsSheetLinks"

export type RequestReviewStatus = "pending" | "approved" | "cancelled" | "declined"
export type RequestScope = "past" | "mtd" | "both"

export type OperationsRequestRow = {
  documentId: string | null
  requestDate: string
  amount: number
  status: RequestReviewStatus
  category: string
  supplier: string
  requester: string
  rawStatus: string
}

export type OperationsBreakdownRow = {
  key: string
  amount: number
  count: number
}

export type OperationsStatusMetric = {
  count: number
  amount: number
}

export type OperationsMetrics = {
  totalCount: number
  totalAmount: number
  byStatus: Record<RequestReviewStatus, OperationsStatusMetric>
  topCategories: OperationsBreakdownRow[]
  topSuppliers: OperationsBreakdownRow[]
  topRequesters: OperationsBreakdownRow[]
}

export type OperationsDataQuality = {
  invalidRows: number
  unknownStatuses: Record<string, number>
}

export type OperationsTabSummary = {
  gid: string | null
  tabName: string | null
  /** Rows discovered after parsing this tab's CSV. */
  rowsParsed: number
  /** True when the form-template fallback was used (single document per tab). */
  usedTemplateFallback: boolean
}

export type TabDiscoverySource =
  | "client_api"
  | "edge_api"
  | "edge_pubhtml"
  | "primary_only"

export type TabDiscoveryReport = {
  /** How the tab list was obtained (or "primary_only" when discovery failed). */
  source: TabDiscoverySource
  /** Number of tabs returned by the discovery call (before exclusion). */
  discoveredCount: number
  /** True when a client-callable Google API key is available. */
  hasClientApiKey: boolean
  /** Whether the client-side Sheets API call was attempted. */
  triedClientApi: boolean
  /** Whether the edge function call was attempted. */
  triedEdgeFunction: boolean
  /** Whether the edge function returned 404 (i.e. not deployed). */
  edgeFunctionMissing: boolean
  /** First user-visible error encountered while trying to discover tabs. */
  errorMessage: string | null
}

export type OperationsRequestMetricsResult = {
  rows: OperationsRequestRow[]
  quality: OperationsDataQuality
  monthStartIso: string
  todayIso: string
  pastRows: OperationsRequestRow[]
  mtdRows: OperationsRequestRow[]
  allRows: OperationsRequestRow[]
  metricsPast: OperationsMetrics
  metricsMtd: OperationsMetrics
  metricsAll: OperationsMetrics
  /** Per-tab summary so the UI can show which tabs contributed to the roll-up. */
  tabs: OperationsTabSummary[]
  /** Diagnostics around how the tab list was obtained. */
  discovery: TabDiscoveryReport
}

const EMPTY_METRICS: OperationsMetrics = {
  totalCount: 0,
  totalAmount: 0,
  byStatus: {
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    cancelled: { count: 0, amount: 0 },
    declined: { count: 0, amount: 0 },
  },
  topCategories: [],
  topSuppliers: [],
  topRequesters: [],
}

const HEADER_KEYS = {
  date: [
    "request_date",
    "date",
    "ngay",
    "ngay_date",
    "created_at",
    "created_date",
    "document_date",
  ],
  amount: [
    "amount",
    "so_tien",
    "tien",
    "total_amount",
    "tong_cong",
    "gia",
    "value",
  ],
  status: [
    "status",
    "trang_thai",
    "approval_status",
    "request_status",
    "payment_status",
  ],
  category: [
    "category",
    "expense_category",
    "muc_dich",
    "purpose",
    "department",
    "phong_ban",
  ],
  supplier: [
    "supplier",
    "vendor",
    "payee",
    "beneficiary",
    "nha_cung_cap",
    "ten_nha_cung_cap",
    "nguoi_thu_huong",
  ],
  requester: [
    "requester",
    "requested_by",
    "name",
    "author",
    "nguoi_de_nghi",
    "created_by",
  ],
  documentId: [
    "document_id",
    "doc_id",
    "id_tai_lieu",
    "id",
    "request_id",
  ],
}

function normalizeHeader(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
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

function pick(row: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (value != null && value.trim() !== "") return value.trim()
  }
  return null
}

function parseIsoDate(raw: string | null): string | null {
  const s = String(raw || "").trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const dmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/)
  if (dmy) {
    const dd = dmy[1].padStart(2, "0")
    const mm = dmy[2].padStart(2, "0")
    const yyyy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${yyyy}-${mm}-${dd}`
  }

  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return null
}

function parseAmount(raw: string | null): number | null {
  const s = String(raw || "").trim()
  if (!s) return null
  const digitsOnly = s.replace(/[^\d-]/g, "")
  if (!digitsOnly || digitsOnly === "-") return null
  const amount = Number(digitsOnly)
  if (!Number.isFinite(amount)) return null
  return amount
}

function normalizeStatus(raw: string | null): RequestReviewStatus | null {
  const status = normalizeHeader(String(raw || ""))
  if (!status) return null

  if (["pending", "request", "requested", "submitted", "in_review", "waiting"].includes(status)) return "pending"
  if (["approved", "approve", "accepted", "paid", "done", "completed"].includes(status)) return "approved"
  if (["cancelled", "canceled", "cancel", "huy", "da_huy"].includes(status)) return "cancelled"
  if (["declined", "rejected", "reject", "denied", "deny", "tu_choi"].includes(status)) return "declined"
  return null
}

function parseCsvRows(csvText: string): { rows: Record<string, string>[]; invalidRows: number } {
  const lines = csvText
    .split(/\r?\n/g)
    .map((l) => l.trimEnd())
    .filter(Boolean)
  if (lines.length < 2) return { rows: [], invalidRows: 0 }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  let invalidRows = 0
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length === 1 && values[0] === "") continue
    if (values.every((v) => v.trim() === "")) continue
    if (values.length > headers.length) {
      invalidRows++
      continue
    }
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ""
    })
    rows.push(row)
  }
  return { rows, invalidRows }
}

function isExcludedTabName(name: string | null | undefined): boolean {
  const n = String(name || "").trim().toLowerCase()
  if (!n) return false
  if (n.includes("template")) return true
  if (n.includes("bank account") || n.includes("bank_account")) return true
  return false
}

function withGid(csvUrl: string, gid: string): string {
  const url = new URL(csvUrl)
  url.searchParams.set("gid", gid)
  return url.toString()
}

type DiscoveryOutcome = {
  tabs: Array<{ gid: string; name: string }>
  source: TabDiscoverySource
  triedClientApi: boolean
  triedEdgeFunction: boolean
  edgeFunctionMissing: boolean
  errorMessage: string | null
}

// Try the Google Sheets API v4 directly from the browser. This works without
// any Edge Function deploy step — the Sheets API ships CORS headers for
// public reads when called with `?key=`. The key must be a browser-safe API
// key (HTTP referrer-restricted) exposed via VITE_GOOGLE_API_KEY at build
// time, and the spreadsheet must be shared "anyone with the link".
async function listTabsViaClientApi(
  spreadsheetId: string,
  apiKey: string,
): Promise<{ tabs: Array<{ gid: string; name: string }>; error: string | null }> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&fields=${encodeURIComponent("sheets.properties(sheetId,title,hidden)")}`
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const snippet = body.slice(0, 200)
      return {
        tabs: [],
        error: `Sheets API ${res.status}${snippet ? `: ${snippet}` : ""}`,
      }
    }
    const data = await res.json()
    const sheets: any[] = Array.isArray(data?.sheets) ? data.sheets : []
    const tabs: Array<{ gid: string; name: string }> = []
    for (const sheet of sheets) {
      const props = sheet?.properties || {}
      if (props.hidden) continue
      const sheetId = props.sheetId
      const title = props.title
      if (sheetId == null || !title) continue
      tabs.push({ gid: String(sheetId), name: String(title) })
    }
    return { tabs, error: null }
  } catch (err) {
    return {
      tabs: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// Invoke the `list-sheet-tabs` Edge Function as a fallback path. The
// function runs server-side (no CORS), uses the GOOGLE_API_KEY secret, and
// falls back to /pubhtml scraping for "Publish to web" sheets.
async function listTabsViaEdgeFunction(sheetUrl: string): Promise<{
  tabs: Array<{ gid: string; name: string }>
  source: "edge_api" | "edge_pubhtml" | null
  missing: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      tabs?: Array<{ gid: string; name: string }>
      source?: "api" | "pubhtml" | "none"
      error?: string | null
    }>("list-sheet-tabs", {
      body: { sheetUrl },
    })
    if (error) {
      const message = error.message || String(error)
      const lower = message.toLowerCase()
      const missing =
        lower.includes("not found") ||
        lower.includes("404") ||
        lower.includes("function not found")
      return { tabs: [], source: null, missing, error: message }
    }
    const tabs = Array.isArray(data?.tabs) ? data!.tabs! : []
    const remoteSource = data?.source
    const source: "edge_api" | "edge_pubhtml" | null =
      remoteSource === "api" ? "edge_api" : remoteSource === "pubhtml" ? "edge_pubhtml" : null
    return {
      tabs,
      source,
      missing: false,
      error: data?.error ?? null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const lower = message.toLowerCase()
    const missing =
      lower.includes("not found") ||
      lower.includes("404") ||
      lower.includes("failed to fetch")
    return { tabs: [], source: null, missing, error: message }
  }
}

async function discoverTabs(sheetUrl: string): Promise<DiscoveryOutcome> {
  const parsed = parseGoogleSheetUrl(sheetUrl)
  const outcome: DiscoveryOutcome = {
    tabs: [],
    source: "primary_only",
    triedClientApi: false,
    triedEdgeFunction: false,
    edgeFunctionMissing: false,
    errorMessage: null,
  }

  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY
  if (parsed.id && apiKey) {
    outcome.triedClientApi = true
    const { tabs, error } = await listTabsViaClientApi(parsed.id, apiKey)
    if (tabs.length > 0) {
      outcome.tabs = tabs
      outcome.source = "client_api"
      return outcome
    }
    if (error) outcome.errorMessage = `Client API: ${error}`
  }

  outcome.triedEdgeFunction = true
  const edge = await listTabsViaEdgeFunction(sheetUrl)
  if (edge.tabs.length > 0 && edge.source) {
    outcome.tabs = edge.tabs
    outcome.source = edge.source
    return outcome
  }
  if (edge.missing) outcome.edgeFunctionMissing = true
  if (edge.error && !outcome.errorMessage) {
    outcome.errorMessage = edge.missing
      ? "Edge Function `list-sheet-tabs` is not deployed."
      : `Edge Function: ${edge.error}`
  }

  return outcome
}

function parseCsvMatrix(csvText: string): string[][] {
  return csvText
    .split(/\r?\n/g)
    .map((line) => parseCsvLine(line))
    .filter((row) => row.some((cell) => cell.trim() !== ""))
}

function rowMatchesAnyPattern(row: string[], patterns: string[]): boolean {
  return row.some((cell) => {
    const normalized = normalizeHeader(cell)
    return patterns.some((pattern) => normalized.includes(pattern))
  })
}

function isMeaningfulValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed === ":" || trimmed === "-" || trimmed === "—") return false
  return /[\p{L}\p{N}]/u.test(trimmed)
}

function parseAmountsFromRow(row: string[]): number[] {
  const amounts: number[] = []
  for (const cell of row) {
    const amount = parseAmount(cell)
    if (amount != null) amounts.push(amount)
  }
  return amounts
}

function findValueForLabel(rows: string[][], patterns: string[]): string | null {
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const normalized = normalizeHeader(row[i])
      if (!patterns.some((pattern) => normalized.includes(pattern))) continue
      for (let j = i + 1; j < row.length; j++) {
        const candidate = row[j]?.trim()
        if (!candidate || !isMeaningfulValue(candidate)) continue
        const candidateNorm = normalizeHeader(candidate)
        if (patterns.some((pattern) => candidateNorm.includes(pattern))) continue
        return candidate
      }
    }
  }
  return null
}

function findAmountForLabel(rows: string[][], patterns: string[]): number | null {
  const candidates: number[] = []
  for (const row of rows) {
    if (!rowMatchesAnyPattern(row, patterns)) continue
    const amounts = parseAmountsFromRow(row)
    if (amounts.length) candidates.push(...amounts)
  }
  if (!candidates.length) return null
  const positive = candidates.filter((n) => n > 0)
  if (positive.length) return Math.max(...positive)
  return candidates[candidates.length - 1] ?? null
}

function parseTemplateForms(
  csvText: string,
  kind: Extract<OperationsSheetKind, "purchase_request" | "payment_request">,
): { rows: OperationsRequestRow[]; invalidRows: number } {
  const matrix = parseCsvMatrix(csvText)
  if (!matrix.length) return { rows: [], invalidRows: 0 }

  const titlePatterns = kind === "purchase_request"
    ? ["purchase_requisition", "phieu_yeu_cau_mua_hang"]
    : ["payment_request", "giay_de_nghi_thanh_toan"]

  const startIndexes: number[] = []
  matrix.forEach((row, idx) => {
    if (rowMatchesAnyPattern(row, titlePatterns)) startIndexes.push(idx)
  })

  const boundaries = startIndexes.length ? startIndexes : [0]
  const rows: OperationsRequestRow[] = []
  let invalidRows = 0

  for (let b = 0; b < boundaries.length; b++) {
    const start = boundaries[b]
    const end = boundaries[b + 1] ?? matrix.length
    const block = matrix.slice(start, end)

    const requestDate = parseIsoDate(findValueForLabel(block, ["ngay", "date", "request_date"]))
    const documentId = findValueForLabel(block, ["id_tai_lieu", "document_id", "doc_id"])
    const requester = findValueForLabel(block, ["nguoi_de_nghi", "requester", "requested_by", "name"]) ?? "Unspecified"
    const supplier = findValueForLabel(block, ["ten_nguoi_thu_huong", "supplier", "vendor", "payee", "beneficiary"]) ?? "Unspecified"
    const purpose = findValueForLabel(block, ["muc_dich", "purpose", "description"])
    const department = findValueForLabel(block, ["phong_ban", "department"])
    const notes = findValueForLabel(block, ["ghi_chu", "notes", "remark", "remarks"])
    const amount = findAmountForLabel(block, ["tong_cong", "total", "so_tien", "amount"])

    const category = purpose || notes || department || "Unspecified"
    if (!requestDate || amount == null) {
      invalidRows++
      continue
    }

    rows.push({
      documentId,
      requestDate,
      amount,
      status: "pending",
      category,
      supplier,
      requester,
      rawStatus: "pending",
    })
  }

  return { rows, invalidRows }
}

function buildBreakdown(rows: OperationsRequestRow[], key: keyof Pick<OperationsRequestRow, "category" | "supplier" | "requester">): OperationsBreakdownRow[] {
  const grouped = new Map<string, OperationsBreakdownRow>()
  for (const row of rows) {
    const groupKey = row[key] || "Unspecified"
    const current = grouped.get(groupKey) ?? { key: groupKey, amount: 0, count: 0 }
    current.amount += row.amount
    current.count += 1
    grouped.set(groupKey, current)
  }
  return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount).slice(0, 8)
}

export function computeOperationsMetrics(rows: OperationsRequestRow[]): OperationsMetrics {
  if (!rows.length) return EMPTY_METRICS

  const byStatus: OperationsMetrics["byStatus"] = {
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    cancelled: { count: 0, amount: 0 },
    declined: { count: 0, amount: 0 },
  }

  let totalAmount = 0
  for (const row of rows) {
    totalAmount += row.amount
    byStatus[row.status].count += 1
    byStatus[row.status].amount += row.amount
  }

  return {
    totalCount: rows.length,
    totalAmount,
    byStatus,
    topCategories: buildBreakdown(rows, "category"),
    topSuppliers: buildBreakdown(rows, "supplier"),
    topRequesters: buildBreakdown(rows, "requester"),
  }
}

export function filterRowsByScope(rows: OperationsRequestRow[], scope: RequestScope, monthStartIso: string): OperationsRequestRow[] {
  if (scope === "both") return rows
  if (scope === "mtd") return rows.filter((r) => r.requestDate >= monthStartIso)
  return rows.filter((r) => r.requestDate < monthStartIso)
}

export function useOperationsRequestMetrics(kind: Extract<OperationsSheetKind, "purchase_request" | "payment_request">) {
  const { data: link, isLoading: isLoadingLink } = useOperationsSheetLink(kind)

  const csvQuery = useQuery({
    queryKey: ["operations-request-csv", kind, link?.csv_export_url, link?.sheet_url],
    enabled: !!link?.csv_export_url,
    queryFn: async () => {
      const baseCsvUrl = link!.csv_export_url!
      const primaryResponse = await fetch(baseCsvUrl, { cache: "no-store" })
      if (!primaryResponse.ok) throw new Error(`Unable to fetch CSV (${primaryResponse.status})`)
      const primaryText = await primaryResponse.text()
      if (primaryText.trim().startsWith("<!")) {
        throw new Error("Sheet URL returned HTML instead of CSV. Publish sheet to web and use the published link.")
      }

      const parsedCsvUrl = new URL(baseCsvUrl)
      const primaryGid = parsedCsvUrl.searchParams.get("gid")

      const sheetUrl = link!.sheet_url
      const parsedSheet = parseGoogleSheetUrl(sheetUrl)
      const looksLikeGoogleSheet = !!parsedSheet.id || !!parsedSheet.publishId

      const hasClientApiKey = !!import.meta.env.VITE_GOOGLE_API_KEY

      if (!looksLikeGoogleSheet) {
        return {
          sources: [{ gid: primaryGid, tabName: null, text: primaryText }],
          discovery: {
            source: "primary_only" as TabDiscoverySource,
            discoveredCount: 0,
            hasClientApiKey,
            triedClientApi: false,
            triedEdgeFunction: false,
            edgeFunctionMissing: false,
            errorMessage: null,
          },
        }
      }

      const outcome = await discoverTabs(sheetUrl)
      const discovery: TabDiscoveryReport = {
        source: outcome.source,
        discoveredCount: outcome.tabs.length,
        hasClientApiKey,
        triedClientApi: outcome.triedClientApi,
        triedEdgeFunction: outcome.triedEdgeFunction,
        edgeFunctionMissing: outcome.edgeFunctionMissing,
        errorMessage: outcome.errorMessage,
      }

      if (!outcome.tabs.length) {
        return {
          sources: [{ gid: primaryGid, tabName: null, text: primaryText }],
          discovery,
        }
      }

      const primaryTabName = outcome.tabs.find((t) => t.gid === primaryGid)?.name ?? null
      const sources: Array<{ gid: string | null; tabName: string | null; text: string }> = []
      if (!isExcludedTabName(primaryTabName)) {
        sources.push({ gid: primaryGid, tabName: primaryTabName, text: primaryText })
      }

      const extraTabs = outcome.tabs.filter((tab) =>
        tab.gid !== primaryGid && !isExcludedTabName(tab.name),
      )

      const fetched = await Promise.all(extraTabs.map(async (tab) => {
        try {
          const response = await fetch(withGid(baseCsvUrl, tab.gid), { cache: "no-store" })
          if (!response.ok) return null
          const text = await response.text()
          if (!text || text.trim().startsWith("<!")) return null
          return { gid: tab.gid, tabName: tab.name || null, text }
        } catch {
          return null
        }
      }))

      for (const item of fetched) {
        if (item) sources.push(item)
      }

      // Fallback to primary if every tab got excluded/missed.
      if (!sources.length) {
        sources.push({ gid: primaryGid, tabName: primaryTabName, text: primaryText })
      }
      return { sources, discovery }
    },
  })

  const parsed = useMemo<OperationsRequestMetricsResult>(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const monthStartIso = `${todayIso.slice(0, 7)}-01`
    const emptyDiscovery: TabDiscoveryReport = {
      source: "primary_only",
      discoveredCount: 0,
      hasClientApiKey: !!import.meta.env.VITE_GOOGLE_API_KEY,
      triedClientApi: false,
      triedEdgeFunction: false,
      edgeFunctionMissing: false,
      errorMessage: null,
    }
    if (!csvQuery.data || !csvQuery.data.sources.length) {
      return {
        rows: [],
        quality: { invalidRows: 0, unknownStatuses: {} },
        monthStartIso,
        todayIso,
        pastRows: [],
        mtdRows: [],
        allRows: [],
        metricsPast: EMPTY_METRICS,
        metricsMtd: EMPTY_METRICS,
        metricsAll: EMPTY_METRICS,
        tabs: [],
        discovery: csvQuery.data?.discovery ?? emptyDiscovery,
      }
    }

    const unknownStatuses: Record<string, number> = {}
    let invalidRows = 0
    const combinedRows: OperationsRequestRow[] = []
    const tabs: OperationsTabSummary[] = []

    for (const source of csvQuery.data.sources) {
      const parsedCsv = parseCsvRows(source.text)
      invalidRows += parsedCsv.invalidRows
      const rowsFromTable: OperationsRequestRow[] = []

      for (const row of parsedCsv.rows) {
        const requestDate = parseIsoDate(pick(row, HEADER_KEYS.date))
        const amount = parseAmount(pick(row, HEADER_KEYS.amount))
        const rawStatus = pick(row, HEADER_KEYS.status)
        const status = normalizeStatus(rawStatus)

        if (!requestDate || amount == null) {
          invalidRows++
          continue
        }
        if (rawStatus && !status) {
          unknownStatuses[rawStatus] = (unknownStatuses[rawStatus] ?? 0) + 1
        }
        const resolvedStatus = status ?? "pending"

        rowsFromTable.push({
          documentId: pick(row, HEADER_KEYS.documentId),
          requestDate,
          amount,
          status: resolvedStatus,
          category: pick(row, HEADER_KEYS.category) ?? "Unspecified",
          supplier: pick(row, HEADER_KEYS.supplier) ?? "Unspecified",
          requester: pick(row, HEADER_KEYS.requester) ?? "Unspecified",
          rawStatus: rawStatus ?? resolvedStatus,
        })
      }

      const fallback = rowsFromTable.length === 0 ? parseTemplateForms(source.text, kind) : null
      if (fallback) {
        // In form-template mode, do not treat every non-tabular sheet row as invalid.
        invalidRows -= parsedCsv.invalidRows
        invalidRows += fallback.invalidRows
      }
      const selected = fallback ? fallback.rows : rowsFromTable
      combinedRows.push(...selected)
      tabs.push({
        gid: source.gid ?? null,
        tabName: source.tabName ?? null,
        rowsParsed: selected.length,
        usedTemplateFallback: !!fallback,
      })
    }

    const deduped = new Map<string, OperationsRequestRow>()
    for (const row of combinedRows) {
      const key = `${row.documentId || "na"}|${row.requestDate}|${row.amount}|${row.requester}`
      deduped.set(key, row)
    }
    const rows = Array.from(deduped.values())

    rows.sort((a, b) => a.requestDate.localeCompare(b.requestDate))

    const pastRows = rows.filter((r) => r.requestDate < monthStartIso)
    const mtdRows = rows.filter((r) => r.requestDate >= monthStartIso && r.requestDate <= todayIso)

    return {
      rows,
      quality: { invalidRows, unknownStatuses },
      monthStartIso,
      todayIso,
      pastRows,
      mtdRows,
      allRows: rows,
      metricsPast: computeOperationsMetrics(pastRows),
      metricsMtd: computeOperationsMetrics(mtdRows),
      metricsAll: computeOperationsMetrics(rows),
      tabs,
      discovery: csvQuery.data.discovery,
    }
  }, [csvQuery.data, kind])

  return {
    link,
    parsed,
    isLoading: isLoadingLink || csvQuery.isLoading,
    isError: csvQuery.isError,
    error: csvQuery.error as Error | null,
    refetch: csvQuery.refetch,
  }
}

