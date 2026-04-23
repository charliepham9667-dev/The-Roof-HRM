import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useOperationsSheetLink, type OperationsSheetKind } from "@/hooks/useOperationsSheetLinks"

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
        if (!candidate) continue
        const candidateNorm = normalizeHeader(candidate)
        if (patterns.some((pattern) => candidateNorm.includes(pattern))) continue
        return candidate
      }
    }
  }
  return null
}

function findAmountForLabel(rows: string[][], patterns: string[]): number | null {
  for (const row of rows) {
    if (!rowMatchesAnyPattern(row, patterns)) continue
    const amounts = parseAmountsFromRow(row)
    if (amounts.length) return Math.max(...amounts)
  }
  return null
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
    queryKey: ["operations-request-csv", kind, link?.csv_export_url],
    enabled: !!link?.csv_export_url,
    queryFn: async () => {
      const response = await fetch(link!.csv_export_url!, { cache: "no-store" })
      if (!response.ok) throw new Error(`Unable to fetch CSV (${response.status})`)
      const text = await response.text()
      if (text.trim().startsWith("<!")) throw new Error("Sheet URL returned HTML instead of CSV. Publish sheet to web and use the published link.")
      return text
    },
  })

  const parsed = useMemo<OperationsRequestMetricsResult>(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const monthStartIso = `${todayIso.slice(0, 7)}-01`
    if (!csvQuery.data) {
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
      }
    }

    const parsedCsv = parseCsvRows(csvQuery.data)
    const unknownStatuses: Record<string, number> = {}
    let invalidRows = parsedCsv.invalidRows
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

    const fallback = rowsFromTable.length === 0 ? parseTemplateForms(csvQuery.data, kind) : null
    if (fallback) invalidRows += fallback.invalidRows
    const rows = fallback ? fallback.rows : rowsFromTable

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

