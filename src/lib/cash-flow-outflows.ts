/** Aggregate paid debt ledger lines into daily cash-out totals. */

export type PaidDebtOutflowRow = {
  amount_vnd: number
  paid_at: string | null
  due_date: string
  updated_at?: string | null
  category?: string | null
  vendor?: string | null
}

/**
 * Date cash left the business. Prefer due_date (payment-list / accountant day)
 * over paid_at (when someone clicked Paid in the app).
 */
export function paidDebtOutflowDate(row: PaidDebtOutflowRow): string {
  if (row.due_date) return row.due_date.slice(0, 10)
  if (row.paid_at) return row.paid_at.slice(0, 10)
  if (row.updated_at) return row.updated_at.slice(0, 10)
  return ""
}

export function buildPaidDebtOutflowsByDate(rows: PaidDebtOutflowRow[]): Map<string, number> {
  const byDate = new Map<string, number>()
  for (const row of rows) {
    const date = paidDebtOutflowDate(row)
    const amt = Number(row.amount_vnd) || 0
    if (!date || amt <= 0) continue
    byDate.set(date, (byDate.get(date) ?? 0) + amt)
  }
  return byDate
}

const CATEGORY_LABEL: Record<string, string> = {
  inventory: "Inventory",
  rent: "Rent",
  capex: "CapEx",
  utilities: "Utilities",
  other: "Other",
}

/**
 * Build a human-readable event label from the actual categories paid on a day.
 * Falls back to "Cash out" rather than guessing based on amount.
 */
export function buildOutflowEventLabel(rows: PaidDebtOutflowRow[], date: string): string {
  const dayRows = rows.filter((r) => paidDebtOutflowDate(r) === date && Number(r.amount_vnd) > 0)
  if (dayRows.length === 0) return "Cash out"

  // Tally amount per category
  const catTotals = new Map<string, number>()
  for (const r of dayRows) {
    const cat = r.category?.toLowerCase() ?? "other"
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + Number(r.amount_vnd))
  }

  // Sort categories by amount desc
  const sorted = [...catTotals.entries()].sort((a, b) => b[1] - a[1])

  if (sorted.length === 1) {
    const label = CATEGORY_LABEL[sorted[0][0]] ?? sorted[0][0]
    return `${label} paid`
  }

  // Show top two categories, e.g. "Rent · Inventory"
  const top = sorted.slice(0, 2).map(([cat]) => CATEGORY_LABEL[cat] ?? cat)
  const extra = sorted.length - 2
  return extra > 0 ? `${top.join(" · ")} +${extra}` : top.join(" · ")
}
