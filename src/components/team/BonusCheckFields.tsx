import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatVnd, formatVndDigits, parseNumberInput } from "@/lib/finance-headroom"
import {
  bonusStatusMeta,
  computeBonusCheck,
  defaultTargetVnd,
  FOUNDATION_RATE,
  SURPLUS_BONUS_RATE,
} from "@/lib/bonus-check"

/** String-backed form state so inputs stay controlled while typing. */
export type BonusForm = {
  target: string
  qualifyingRevenue: string
  rating: string
  newReviews: string
  surplusBonusPaid: string
}

export const EMPTY_BONUS_FORM: BonusForm = {
  target: "",
  qualifyingRevenue: "",
  rating: "",
  newReviews: "",
  surplusBonusPaid: "",
}

export function bonusFormFromRow(row: {
  monthly_target_vnd: number | null
  qualifying_revenue_vnd: number | null
  google_rating: number | null
  new_reviews: number | null
  surplus_bonus_paid_vnd: number | null
}): BonusForm {
  return {
    target: row.monthly_target_vnd ? formatVndDigits(row.monthly_target_vnd) : "",
    qualifyingRevenue: row.qualifying_revenue_vnd ? formatVndDigits(row.qualifying_revenue_vnd) : "",
    rating: row.google_rating != null ? String(row.google_rating) : "",
    newReviews: row.new_reviews != null ? String(row.new_reviews) : "",
    surplusBonusPaid: row.surplus_bonus_paid_vnd ? formatVndDigits(row.surplus_bonus_paid_vnd) : "",
  }
}

/** Convert the string form to the numeric payload the hooks expect. */
export function bonusFormToPayload(form: BonusForm) {
  const rating = form.rating.trim() === "" ? null : Number(form.rating)
  const newReviews = parseNumberInput(form.newReviews)
  return {
    monthlyTargetVnd: parseNumberInput(form.target),
    qualifyingRevenueVnd: parseNumberInput(form.qualifyingRevenue),
    googleRating: rating != null && Number.isFinite(rating) ? rating : null,
    newReviews: newReviews,
    surplusBonusPaidVnd: parseNumberInput(form.surplusBonusPaid),
  }
}

export function BonusCheckFields({
  values,
  onChange,
  year,
  month,
  pnlNetSales,
}: {
  values: BonusForm
  onChange: (next: BonusForm) => void
  year: number
  month: number
  /** Qualifying revenue pulled from P&L Net Sales, or null if the month isn't synced. */
  pnlNetSales?: number | null
}) {
  const check = useMemo(() => {
    const p = bonusFormToPayload(values)
    return computeBonusCheck({
      target: p.monthlyTargetVnd,
      qualifyingRevenue: p.qualifyingRevenueVnd,
      rating: p.googleRating,
      newReviews: p.newReviews,
      paid: p.surplusBonusPaidVnd,
    })
  }, [values])

  const meta = bonusStatusMeta(check.status)
  const suggestedTarget = defaultTargetVnd(year, month)

  const setVnd = (key: keyof BonusForm, raw: string) => {
    const n = parseNumberInput(raw)
    onChange({ ...values, [key]: n == null ? "" : formatVndDigits(n) })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Monthly target</Label>
          <Input
            className="h-9 font-mono text-right"
            value={values.target}
            onChange={(e) => setVnd("target", e.target.value)}
            placeholder="0"
          />
          {suggestedTarget != null && parseNumberInput(values.target) !== suggestedTarget && (
            <button
              type="button"
              onClick={() => onChange({ ...values, target: formatVndDigits(suggestedTarget) })}
              className="text-[10.5px] text-primary hover:underline"
            >
              Use AIOS target {formatVnd(suggestedTarget)}
            </button>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Qualifying revenue</Label>
          <Input
            className="h-9 font-mono text-right"
            value={values.qualifyingRevenue}
            onChange={(e) => setVnd("qualifyingRevenue", e.target.value)}
            placeholder="after svc, FOC, VAT"
          />
          {pnlNetSales != null ? (
            parseNumberInput(values.qualifyingRevenue) !== pnlNetSales && (
              <button
                type="button"
                onClick={() => onChange({ ...values, qualifyingRevenue: formatVndDigits(pnlNetSales) })}
                className="text-[10.5px] text-primary hover:underline"
              >
                Use P&L Net Sales {formatVnd(pnlNetSales)}
              </button>
            )
          ) : (
            <span className="text-[10.5px]" style={{ color: "#A89E8C" }}>
              P&L not synced — enter manually
            </span>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Google rating</Label>
          <Input
            className="h-9 text-right"
            inputMode="decimal"
            value={values.rating}
            onChange={(e) => onChange({ ...values, rating: e.target.value.replace(/[^\d.]/g, "") })}
            placeholder="4.8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">New reviews</Label>
          <Input
            className="h-9 text-right"
            inputMode="numeric"
            value={values.newReviews}
            onChange={(e) => onChange({ ...values, newReviews: e.target.value.replace(/[^\d]/g, "") })}
            placeholder="100"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Bonus paid (total — Phase 1 + Phase 2)</Label>
          <Input
            className="h-9 font-mono text-right"
            value={values.surplusBonusPaid}
            onChange={(e) => setVnd("surplusBonusPaid", e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Live policy result */}
      <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "#E0D8C8", background: "#FBF8F2" }}>
        {/* Phase 1 — Foundation */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: "#7A7260" }}>
            Phase 1 · Foundation ({Math.round(FOUNDATION_RATE * 100)}% of target)
            <span className="ml-1 font-normal" style={{ color: "#A89E8C" }}>
              {check.targetHit ? "target hit" : "target not hit"}
            </span>
          </span>
          <span className="font-mono text-sm" style={{ color: "#1A1814" }}>
            {formatVnd(check.foundationPool)}
          </span>
        </div>
        {/* Phase 2 — Hustle */}
        <div className="flex items-center justify-between text-xs" style={{ color: "#7A7260" }}>
          <span>Surplus over target</span>
          <span className="font-mono" style={{ color: check.surplus > 0 ? "#2E7D52" : "#8B3030" }}>
            {check.surplus >= 0 ? "" : "−"}
            {formatVnd(Math.abs(check.surplus))}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs" style={{ color: "#7A7260" }}>
          <span>Review gate (Phase 2 only)</span>
          <span>{check.gate.label}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: "#7A7260" }}>
            Phase 2 · Hustle ({Math.round(SURPLUS_BONUS_RATE * 100)}% of surplus × gate)
          </span>
          <span className="font-mono text-sm" style={{ color: "#1A1814" }}>
            {formatVnd(check.hustlePool)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5" style={{ borderColor: "#E0D8C8" }}>
          <span className="text-xs font-bold" style={{ color: "#1A1814" }}>
            Policy bonus (Phase 1 + Phase 2)
          </span>
          <span className="font-mono text-sm font-bold" style={{ color: "#1A1814" }}>
            {formatVnd(check.policyPool)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: "#7A7260" }}>
            Paid vs policy
          </span>
          <span
            className="font-mono text-sm font-semibold"
            style={{ color: check.delta === 0 ? "#1A1814" : check.delta > 0 ? "#8B3030" : "#B8922A" }}
          >
            {check.delta === 0 ? "—" : `${check.delta > 0 ? "+" : "−"}${formatVnd(Math.abs(check.delta))}`}
          </span>
        </div>
        <div
          className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: meta.color, background: meta.bg }}
        >
          {meta.label}
        </div>
      </div>
    </div>
  )
}
