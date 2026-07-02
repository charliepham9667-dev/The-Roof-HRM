/** Deno-shared post-processing for parse-payment-list (keep in sync with src/lib/parse-payment-list.ts) */

export type DebtCategory = "inventory" | "rent" | "capex" | "utilities" | "other"
export type PaymentChannel = "bank" | "cash"

export type ParsedRowStatus = "paid" | "pending"

export type ParsedPaymentListRow = {
  vendorCode: string | null
  vendor: string
  amountVnd: number
  category: DebtCategory
  remarks: string | null
  bankAccount: string | null
  bankName: string | null
  status: ParsedRowStatus | null
  submittedDate: string | null
  paidDate: string | null
}

export type ParsedPaymentList = {
  listDate: string
  paymentChannel: PaymentChannel
  totalPaymentVnd: number | null
  beforeBalanceVnd: number | null
  rows: ParsedPaymentListRow[]
  warnings: string[]
}

const VALID_CATEGORIES = new Set<DebtCategory>([
  "inventory",
  "rent",
  "capex",
  "utilities",
  "other",
])

export function normalizeVndAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : 0
  if (value == null) return 0
  const cleaned = String(value)
    .replace(/[đ₫VND\s$,]/gi, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? Math.round(n) : 0
}

export function isInternalTransfer(vendor: string, remarks: string | null): boolean {
  const text = `${vendor} ${remarks ?? ""}`.toLowerCase()
  if (!text.includes("the roof")) return false
  return (
    text.includes("chuyen khoan") ||
    text.includes("chuyển khoản") ||
    text.includes("internal") ||
    text.includes("giua cac tai khoan") ||
    text.includes("giữa các tài khoản") ||
    (text.includes("tmdv the roof") && text.includes("mb"))
  )
}

export function inferCategoryFromRemarks(remarks: string | null): DebtCategory {
  const r = (remarks ?? "").toLowerCase()
  if (!r) return "other"
  if (r.includes("thuê nhà") || r.includes("thue nha") || r.includes("rent") || r.includes("leasing"))
    return "rent"
  if (
    r.includes("quạt") ||
    r.includes("quat") ||
    r.includes("loa") ||
    r.includes("speaker") ||
    r.includes("máy tính") ||
    r.includes("may tinh") ||
    r.includes("computer") ||
    r.includes("đợt") ||
    r.includes("dot ") ||
    r.includes("capex")
  )
    return "capex"
  if (r.includes("điện") || r.includes("dien") || r.includes("utilities")) return "utilities"
  if (
    /\bdj\b/.test(r) ||
    r.includes("tien dj") ||
    r.includes("bhxh") ||
    r.includes("bao hiem") ||
    r.includes("thuong")
  )
    return "other"
  if (
    r.includes("bia") ||
    r.includes("beer") ||
    r.includes("corona") ||
    r.includes("gia vi") ||
    r.includes("mua hang") ||
    r.includes("hoa don") ||
    r.includes("thanh toan tien")
  )
    return "inventory"
  return "other"
}

function coerceCategory(raw: unknown, remarks: string | null): DebtCategory {
  if (remarks?.trim()) return inferCategoryFromRemarks(remarks)
  const s = String(raw ?? "").toLowerCase() as DebtCategory
  if (VALID_CATEGORIES.has(s)) return s
  return "other"
}

function coerceChannel(raw: unknown): PaymentChannel {
  return String(raw ?? "bank").toLowerCase() === "cash" ? "cash" : "bank"
}

function coerceRowStatus(raw: unknown): ParsedRowStatus | null {
  const s = String(raw ?? "").toLowerCase()
  if (s.includes("paid")) return "paid"
  if (s.includes("pending") || s.includes("approval")) return "pending"
  return null
}

function coerceIsoDate(raw: unknown): string | null {
  const s = String(raw ?? "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export function postProcessParsedPaymentList(raw: unknown): ParsedPaymentList {
  const input = (raw ?? {}) as Record<string, unknown>
  const warnings = Array.isArray(input.warnings)
    ? input.warnings.map((w) => String(w))
    : []

  const listDate = String(input.listDate ?? "").slice(0, 10)
  const paymentChannel = coerceChannel(input.paymentChannel)
  const totalPaymentVnd =
    input.totalPaymentVnd != null ? normalizeVndAmount(input.totalPaymentVnd as string | number) : null
  const beforeBalanceVnd =
    input.beforeBalanceVnd != null ? normalizeVndAmount(input.beforeBalanceVnd as string | number) : null

  const rawRows = Array.isArray(input.rows) ? input.rows : []
  const rows: ParsedPaymentListRow[] = []

  for (const item of rawRows) {
    const row = item as Record<string, unknown>
    const vendor = String(row.vendor ?? "").trim()
    if (!vendor) continue

    const remarks = row.remarks != null ? String(row.remarks).trim() : null
    if (row.skip === true || isInternalTransfer(vendor, remarks)) continue

    const amountVnd = normalizeVndAmount(row.amountVnd as string | number)
    if (amountVnd <= 0) continue

    const status = coerceRowStatus(row.status)
    const paidDate = coerceIsoDate(row.paidDate)
    if (status === "paid" && !paidDate) {
      warnings.push(`"${vendor}": marked Paid but no Paid Date read — verify before import.`)
    }

    rows.push({
      vendorCode: row.vendorCode != null ? String(row.vendorCode).trim() : null,
      vendor,
      amountVnd,
      category: coerceCategory(row.category, remarks),
      remarks,
      bankAccount: row.bankAccount != null ? String(row.bankAccount).trim() : null,
      bankName: row.bankName != null ? String(row.bankName).trim() : null,
      status,
      submittedDate: coerceIsoDate(row.submittedDate),
      paidDate,
    })
  }

  if (totalPaymentVnd != null && rows.length > 0) {
    const sum = rows.reduce((s, r) => s + r.amountVnd, 0)
    const diff = Math.abs(sum - totalPaymentVnd)
    if (diff > Math.max(1000, totalPaymentVnd * 0.01)) {
      warnings.push(
        `Row sum (${sum.toLocaleString()} đ) differs from footer total (${totalPaymentVnd.toLocaleString()} đ).`,
      )
    }
  }

  if (!listDate || !/^\d{4}-\d{2}-\d{2}$/.test(listDate)) {
    warnings.push("Could not parse list date from title — verify due date before import.")
  }

  return {
    listDate: listDate || new Date().toISOString().slice(0, 10),
    paymentChannel,
    totalPaymentVnd,
    beforeBalanceVnd,
    rows,
    warnings,
  }
}
