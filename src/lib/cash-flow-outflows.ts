/** Aggregate paid debt ledger lines into daily cash-out totals. */

export type PaidDebtOutflowRow = {
  amount_vnd: number
  paid_at: string | null
  due_date: string
  updated_at?: string | null
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
