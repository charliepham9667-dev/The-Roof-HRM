import type { DebtCategory } from "@/lib/finance-headroom"

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
  /** Tracker sheets: per-row Status column (Paid / Pending Approval). */
  status: ParsedRowStatus | null
  /** Tracker sheets: Submitted Date column (when the request entered the list). */
  submittedDate: string | null
  /** Tracker sheets: Paid Date column (when cash actually left). */
  paidDate: string | null
  skip?: boolean
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

/** Strip VND formatting: 110.000.000 or 110,000,000 */
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
    r.includes("capex") ||
    r.includes("furniture") ||
    r.includes("bàn ghế") ||
    r.includes("ban ghe")
  )
    return "capex"

  if (r.includes("điện") || r.includes("dien") || r.includes("utilities") || r.includes("điện lực"))
    return "utilities"

  // Entertainment / payroll / statutory (DJ, BHXH, bonuses, VAT, design)
  if (
    /\bdj\b/.test(r) ||
    r.includes("tien dj") ||
    r.includes("entertainment") ||
    r.includes("bhxh") ||
    r.includes("bao hiem") ||
    r.includes("bảo hiểm") ||
    r.includes("thuong quy") ||
    r.includes("thưởng quý") ||
    r.includes("thuong ") ||
    r.includes("vat") ||
    r.includes("design") ||
    r.includes("thiet ke")
  )
    return "other"

  // Beverage, food, bar supplies, general supplier invoices
  if (
    r.includes("bia") ||
    r.includes("beer") ||
    r.includes("corona") ||
    r.includes("heineken") ||
    r.includes("east west") ||
    r.includes("gia vi") ||
    r.includes("gia vị") ||
    r.includes("quay bar") ||
    r.includes("food") ||
    r.includes("thực phẩm") ||
    r.includes("ruou") ||
    r.includes("rượu") ||
    r.includes("alcohol") ||
    r.includes("glasia") ||
    r.includes("mua hang") ||
    r.includes("mua hàng") ||
    r.includes("hoa don") ||
    r.includes("hóa đơn") ||
    r.includes("inventory") ||
    r.includes("đồ uống") ||
    r.includes("ice") ||
    r.includes("đá") ||
    r.includes("thanh toan tien")
  )
    return "inventory"

  return "other"
}

/** Short English hint for the review table (from Remarks column text). */
export function remarksPaymentHint(remarks: string | null): string | null {
  const r = (remarks ?? "").trim()
  if (!r) return null
  const lower = r.toLowerCase()
  if (/\bdj\b/.test(lower) || lower.includes("tien dj")) return "Entertainment (DJ)"
  if (lower.includes("beer") || lower.includes("bia") || lower.includes("corona"))
    return "Beer / beverage supplier"
  if (lower.includes("gia vi") || lower.includes("gia vị") || lower.includes("quay bar"))
    return "Bar ingredients / spices"
  if (lower.includes("bhxh") || lower.includes("bao hiem")) return "Social insurance (BHXH)"
  if (lower.includes("thuong")) return "Staff bonus"
  if (lower.includes("mua hang") || lower.includes("hoa don")) return "Supplier invoice"
  if (lower.includes("thue nha")) return "Rent"
  const cat = inferCategoryFromRemarks(remarks)
  if (cat === "inventory") return "Inventory / supplies"
  if (cat === "capex") return "Equipment / capex"
  if (cat === "rent") return "Rent"
  if (cat === "utilities") return "Utilities"
  return null
}

function coerceCategory(raw: unknown, remarks: string | null): DebtCategory {
  // Remarks column on the sheet describes what the payment is for — prefer it over model category.
  if (remarks?.trim()) return inferCategoryFromRemarks(remarks)
  const s = String(raw ?? "").toLowerCase() as DebtCategory
  if (VALID_CATEGORIES.has(s)) return s
  return "other"
}

function coerceChannel(raw: unknown): PaymentChannel {
  const s = String(raw ?? "bank").toLowerCase()
  return s === "cash" ? "cash" : "bank"
}

function coerceRowStatus(raw: unknown): ParsedRowStatus | null {
  const s = String(raw ?? "").toLowerCase()
  if (s.includes("paid")) return "paid"
  if (s.includes("pending") || s.includes("approval")) return "pending"
  return null
}

/** Accept YYYY-MM-DD (model output contract); anything else → null. */
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
    const skipFlag = row.skip === true || isInternalTransfer(vendor, remarks)
    if (skipFlag) continue

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

export function composeDebtNotes(parts: {
  remarks?: string | null
  bankName?: string | null
  bankAccount?: string | null
}): string | null {
  const lines: string[] = []
  const remarks = parts.remarks?.trim()
  const bankName = parts.bankName?.trim()
  const bankAccount = parts.bankAccount?.trim()
  if (remarks) lines.push(remarks)
  if (bankName) lines.push(bankName)
  if (bankAccount) lines.push(`Acct ${bankAccount}`)
  return lines.length ? lines.join(" · ") : null
}

export function buildDebtNotes(row: ParsedPaymentListRow): string | null {
  return composeDebtNotes({
    remarks: row.remarks,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
  })
}

const MAX_PARSE_IMAGE_BYTES = 3_500_000
const MAX_PARSE_IMAGE_WIDTH = 2200

/** Downscale large screenshots so the edge request stays under gateway limits. */
export async function prepareImageForParse(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files (PNG, JPG, WEBP) are supported.")
  }

  if (file.size <= 900_000) {
    return fileToBase64(file)
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_PARSE_IMAGE_WIDTH / bitmap.width)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not prepare image for upload")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not compress image"))),
      "image/jpeg",
      0.88,
    )
  })

  if (blob.size > MAX_PARSE_IMAGE_BYTES) {
    throw new Error(
      "Image is too large after compression. Try a smaller screenshot or crop the sheet.",
    )
  }

  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return { base64: btoa(binary), mimeType: "image/jpeg" }
}

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const mimeType = file.type || "image/png"
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return { base64: btoa(binary), mimeType }
}
