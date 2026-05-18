import { differenceInCalendarDays, format, parseISO, startOfDay, subDays } from "date-fns"

export const RUNWAY_FLOOR_DAYS = 30
export const LARGE_OUTFLOW_VND = 80_000_000

export type DebtCategory = "inventory" | "rent" | "capex" | "utilities" | "dividend" | "other"
export type DebtItemStatus = "pending" | "stopped" | "paid"

/** True when iso is YYYY-MM-DD and a real calendar date (avoids date-fns "Invalid time value"). */
export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return false
  return format(d, "yyyy-MM-dd") === iso
}

export function formatIsoDateLabel(iso: string, pattern: string, fallback = "—"): string {
  if (!isValidIsoDate(iso)) return fallback
  try {
    return format(parseISO(iso), pattern)
  } catch {
    return fallback
  }
}

export function mostRecentFridayIso(date = new Date()): string {
  const d = startOfDay(date)
  const dow = d.getDay()
  const offset = (dow + 2) % 7
  return format(subDays(d, offset), "yyyy-MM-dd")
}

export function computeFreeCashFlow(liquidity: number, debt: number): number {
  return liquidity - debt
}

export function computeRunwayDays(freeCashFlow: number, avgDailyBurn: number): number | null {
  if (freeCashFlow <= 0) return 0
  const burn = Math.max(avgDailyBurn, 1_000_000)
  return Math.round(freeCashFlow / burn)
}

export function formatCompactVnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—"
  const abs = Math.abs(amount)
  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B đ`
  if (abs >= 1_000_000) return `${Math.round(amount / 1_000_000)}M đ`
  return `${amount.toLocaleString()} đ`
}

export function formatVnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—"
  return formatVndDigits(amount) + " đ"
}

/** Vietnamese thousands separators for inputs (e.g. 12.420.000). */
export function formatVndDigits(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return ""
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)
}

export function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, "")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function supabaseErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string }
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    if (parts.length) return parts.join(" — ")
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function formatDueRelative(dueDateIso: string, today = startOfDay(new Date())): string {
  const due = startOfDay(parseISO(dueDateIso))
  const diff = differenceInCalendarDays(due, today)
  if (diff < 0) return `Overdue ${Math.abs(diff)}d`
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff <= 7) return `In ${diff} days`
  return format(due, "MMM d")
}

export function dueUrgency(dueDateIso: string, today = startOfDay(new Date())): "today" | "soon" | "normal" | "overdue" {
  const diff = differenceInCalendarDays(startOfDay(parseISO(dueDateIso)), today)
  if (diff < 0) return "overdue"
  if (diff === 0) return "today"
  if (diff <= 7) return "soon"
  return "normal"
}

export type DebtRibbonBuckets = {
  total: number
  dueTodayOrOverdue: number
  pendingTotal: number
  stoppedTotal: number
  vendorCount: number
}

export type DebtRibbonItem = {
  amount_vnd: number
  due_date: string
  status: DebtItemStatus
}

export function computeDebtRibbonBuckets(items: DebtRibbonItem[]): DebtRibbonBuckets {
  const open = items.filter((i) => i.status === "pending" || i.status === "stopped")
  const pendingItems = items.filter((i) => i.status === "pending")
  const stoppedItems = items.filter((i) => i.status === "stopped")
  const total = pendingItems.reduce((s, i) => s + Number(i.amount_vnd), 0)
  const today = startOfDay(new Date())

  let dueTodayOrOverdue = 0
  let pendingTotal = 0
  let stoppedTotal = 0

  for (const item of pendingItems) {
    const amt = Number(item.amount_vnd)
    pendingTotal += amt
    const urgency = dueUrgency(item.due_date, today)
    if (urgency === "today" || urgency === "overdue") dueTodayOrOverdue += amt
  }

  stoppedTotal = stoppedItems.reduce((s, i) => s + Number(i.amount_vnd), 0)

  return {
    total,
    dueTodayOrOverdue,
    pendingTotal,
    stoppedTotal,
    vendorCount: open.length,
  }
}

export function categoryLabel(category: DebtCategory): string {
  const labels: Record<DebtCategory, string> = {
    inventory: "Inventory",
    rent: "Rent",
    capex: "Capex / Furniture",
    utilities: "Utilities",
    dividend: "Dividend / Owner draw",
    other: "Other",
  }
  return labels[category] ?? category
}

export function forwardFillLiquidity(
  dates: string[],
  snapshots: { report_date: string; total_vnd: number }[],
): number[] {
  const byDate = new Map(snapshots.map((s) => [s.report_date, Number(s.total_vnd)]))
  let last: number | null = null
  return dates.map((d) => {
    if (byDate.has(d)) last = byDate.get(d)!
    return last ?? 0
  })
}
