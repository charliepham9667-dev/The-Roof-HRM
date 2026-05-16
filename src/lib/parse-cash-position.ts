import { normalizeVndAmount } from "@/lib/parse-payment-list"
import { isValidIsoDate } from "@/lib/finance-headroom"

export type ParsedCashPositionDay = {
  reportDate: string
  bankBalanceVnd: number | null
  cashBalanceVnd: number | null
  totalVnd: number | null
  cardPendingVnd: number | null
}

export type ParsedCashPosition = {
  sheetYear: number | null
  sheetMonth: number | null
  days: ParsedCashPositionDay[]
  warnings: string[]
  isDailySeries: boolean
  reportDate: string
  bankBalanceVnd: number | null
  cashBalanceVnd: number | null
  cardPendingVnd: number | null
}

export { normalizeVndAmount }

const MONTH_ABBR: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

function monthFromToken(token: string): number | null {
  const key = token.toLowerCase().replace(/\./g, "").slice(0, 3)
  return MONTH_ABBR[key] ?? null
}

/**
 * Parse spreadsheet column headers like "18-Mar" → 2026-03-18.
 * The month in the header is literal (Mar = March). sheetMonth is only a fallback
 * when the header has no month token.
 */
export function resolveSheetColumnDate(
  columnLabel: string,
  sheetYear: number,
  sheetMonthFallback?: number | null,
): string | null {
  const m = String(columnLabel).trim().match(/^(\d{1,2})[-/\s]+([A-Za-z]{3,9})/i)
  if (!m) return null
  const day = Number(m[1])
  if (!Number.isFinite(day) || day < 1 || day > 31) return null
  const month = monthFromToken(m[2]) ?? sheetMonthFallback ?? null
  if (!month || !sheetYear) return null
  const iso = `${sheetYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  return isValidIsoDate(iso) ? iso : null
}

function parseAmount(value: unknown): number | null {
  if (value == null) return null
  const n = normalizeVndAmount(value as string | number)
  return n > 0 ? n : null
}

function normalizeDay(
  raw: Record<string, unknown>,
  sheetYear: number | null,
  sheetMonth: number | null,
): ParsedCashPositionDay | null {
  let reportDate = ""

  if (raw.columnLabel && sheetYear) {
    const fromLabel = resolveSheetColumnDate(String(raw.columnLabel), sheetYear, sheetMonth)
    if (fromLabel) reportDate = fromLabel
  }

  const fromModel = String(raw.reportDate ?? "").slice(0, 10)
  if (!reportDate && /^\d{4}-\d{2}-\d{2}$/.test(fromModel) && isValidIsoDate(fromModel)) {
    reportDate = fromModel
  }

  if (!reportDate) return null

  let bankBalanceVnd = parseAmount(raw.bankBalanceVnd)
  let cashBalanceVnd = parseAmount(raw.cashBalanceVnd)
  const totalVnd = parseAmount(raw.totalVnd)
  const cardPendingVnd = parseAmount(raw.cardPendingVnd)

  if (totalVnd != null) {
    if (bankBalanceVnd == null && cashBalanceVnd == null) {
      bankBalanceVnd = totalVnd
      cashBalanceVnd = 0
    } else if (bankBalanceVnd != null && cashBalanceVnd == null && totalVnd >= bankBalanceVnd) {
      cashBalanceVnd = totalVnd - bankBalanceVnd
    }
  }

  if (bankBalanceVnd == null && cashBalanceVnd == null && totalVnd == null) return null

  return {
    reportDate,
    bankBalanceVnd,
    cashBalanceVnd,
    totalVnd,
    cardPendingVnd,
  }
}

function firstDayFields(day: ParsedCashPositionDay | undefined) {
  const today = new Date().toISOString().slice(0, 10)
  return {
    reportDate: day?.reportDate && isValidIsoDate(day.reportDate) ? day.reportDate : today,
    bankBalanceVnd: day?.bankBalanceVnd ?? null,
    cashBalanceVnd: day?.cashBalanceVnd ?? null,
    cardPendingVnd: day?.cardPendingVnd ?? null,
  }
}

export function postProcessParsedCashPosition(raw: unknown): ParsedCashPosition {
  const input = (raw ?? {}) as Record<string, unknown>
  const warnings = Array.isArray(input.warnings)
    ? input.warnings.map((w) => String(w))
    : []

  const sheetYear =
    typeof input.sheetYear === "number"
      ? input.sheetYear
      : Number(String(input.sheetYear ?? "")) || new Date().getFullYear()
  const sheetMonth =
    typeof input.sheetMonth === "number"
      ? input.sheetMonth
      : Number(String(input.sheetMonth ?? "")) || null

  let days: ParsedCashPositionDay[] = []

  if (Array.isArray(input.days)) {
    for (const row of input.days) {
      const day = normalizeDay((row ?? {}) as Record<string, unknown>, sheetYear, sheetMonth)
      if (day) days.push(day)
    }
  }

  if (days.length === 0) {
    const single = normalizeDay(input, sheetYear, sheetMonth)
    if (single) days = [single]
  }

  days.sort((a, b) => a.reportDate.localeCompare(b.reportDate))

  const seen = new Set<string>()
  days = days.filter((d) => {
    if (seen.has(d.reportDate)) return false
    seen.add(d.reportDate)
    return true
  })

  if (days.length === 0) {
    warnings.push("No daily balances detected — check the screenshot or enter manually.")
  }

  const first = firstDayFields(days[0])

  return {
    sheetYear,
    sheetMonth,
    days,
    warnings,
    isDailySeries: days.length > 1,
    ...first,
  }
}

export { prepareImageForParse } from "@/lib/parse-payment-list"
