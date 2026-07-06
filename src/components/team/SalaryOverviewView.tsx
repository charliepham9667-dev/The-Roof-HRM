import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Banknote, Loader2, Pencil, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatVnd, formatVndDigits } from "@/lib/finance-headroom"
import { SALARY_CATEGORIES } from "@/lib/parse-salary"
import {
  bonusStatusMeta,
  computeBonusCheck,
  defaultTargetVnd,
  FOUNDATION_RATE,
  SURPLUS_BONUS_RATE,
  type BonusCheck,
} from "@/lib/bonus-check"
import {
  useSalaryMonthly,
  useUpdateSalaryBonus,
  type SalaryMonthly,
} from "@/hooks/useSalaryMonthly"
import {
  BonusCheckFields,
  bonusFormFromRow,
  bonusFormToPayload,
  EMPTY_BONUS_FORM,
  type BonusForm,
} from "./BonusCheckFields"
import { SalaryImportDialog } from "./SalaryImportDialog"

function rowBonusCheck(r: SalaryMonthly): BonusCheck {
  return computeBonusCheck({
    target: r.monthly_target_vnd,
    qualifyingRevenue: r.qualifying_revenue_vnd,
    rating: r.google_rating,
    newReviews: r.new_reviews,
    paid: r.surplus_bonus_paid_vnd,
  })
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const ROW_CAP = 24

function monthLabel(r: { year: number; month: number }) {
  return `${MONTH_ABBR[r.month - 1]} ${String(r.year).slice(2)}`
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
}) {
  return (
    <div style={{ padding: "12px 16px", border: "1px solid #E0D8C8", borderRadius: 10, background: "#FDFAF5" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <span>{icon}</span>
        <span style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".09em", color: "#7A7260", fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, lineHeight: 1, color: "#1A1814" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#A89E8C", marginTop: 3, lineHeight: 1.3 }}>{sub}</div>}
    </div>
  )
}

export function SalaryOverviewView() {
  const { data: rows = [], isLoading } = useSalaryMonthly(ROW_CAP)
  const [importOpen, setImportOpen] = useState(false)
  const updateBonus = useUpdateSalaryBonus()
  const [editRow, setEditRow] = useState<SalaryMonthly | null>(null)
  const [bonusForm, setBonusForm] = useState<BonusForm>(EMPTY_BONUS_FORM)

  const openEdit = (r: SalaryMonthly) => {
    const form = bonusFormFromRow(r)
    // Prefill the target from the AIOS schedule when the row has none saved.
    if (!form.target) {
      const t = defaultTargetVnd(r.year, r.month)
      if (t != null) form.target = formatVndDigits(t)
    }
    setBonusForm(form)
    setEditRow(r)
  }

  const saveBonus = async () => {
    if (!editRow) return
    await updateBonus.mutateAsync({ id: editRow.id, ...bonusFormToPayload(bonusForm) })
    setEditRow(null)
  }

  // rows are newest-first from the hook.
  const latest = rows[0]
  const prev = rows[1]

  const momPct = useMemo(() => {
    if (!latest || !prev || prev.total_vnd <= 0) return null
    return ((latest.total_vnd - prev.total_vnd) / prev.total_vnd) * 100
  }, [latest, prev])

  // Chart wants oldest → newest.
  const chartData = useMemo(
    () =>
      [...rows].reverse().map((r) => ({
        label: monthLabel(r),
        ...Object.fromEntries(SALARY_CATEGORIES.map((c) => [c.key, r[c.col]])),
      })),
    [rows],
  )

  return (
    <div style={{ padding: "16px 24px 32px" }}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1A1814", margin: 0 }}>Salary overview</h2>
          <p style={{ fontSize: 12.5, color: "#7A7260", marginTop: 2 }}>
            Monthly salary spend by category. Import the accountant's sheet each month.
          </p>
        </div>
        <Button type="button" onClick={() => setImportOpen(true)} className="shrink-0">
          <Plus size={14} />
          Import salary PDF
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Loader2 className="animate-spin" size={24} color="#A89E8C" />
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 56, color: "#A89E8C" }}>
          <Banknote size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: 14, margin: 0, color: "#7A7260" }}>No salary data yet</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Import your first month to see the breakdown.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12, marginBottom: 20 }}>
            <StatCard
              label={latest ? `${MONTH_ABBR[latest.month - 1]} ${latest.year} cost` : "Company cost"}
              value={formatVnd(latest?.total_vnd ?? 0)}
              sub="Gross + employer insurance"
              icon={<Banknote size={13} color="#B8922A" />}
            />
            <StatCard
              label="Net paid to staff"
              value={formatVnd(latest?.net_paid_vnd ?? 0)}
              sub="After insurance + tax"
              icon={<Banknote size={13} color="#7A7260" />}
            />
            <StatCard
              label="Headcount"
              value={latest?.headcount != null ? String(latest.headcount) : "—"}
              sub="Staff on the latest sheet"
              icon={<Users size={13} color="#7A7260" />}
            />
            <StatCard
              label="Month on month"
              value={momPct == null ? "—" : `${momPct >= 0 ? "+" : ""}${momPct.toFixed(1)}%`}
              sub={prev ? `vs ${MONTH_ABBR[prev.month - 1]} ${prev.year} cost` : "Need 2 months"}
              icon={<Banknote size={13} color="#7A7260" />}
            />
          </div>

          {/* Trend chart */}
          {chartData.length > 1 && (
            <div style={{ background: "#FDFAF5", border: "1px solid #E0D8C8", borderRadius: 10, padding: "16px 12px 8px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#7A7260", padding: "0 8px 8px" }}>
                Monthly company cost by category
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="#EBE3D5" strokeDasharray="2 4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7A7260" }} tickLine={false} axisLine={{ stroke: "#E0D8C8" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#7A7260" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : String(v))}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const cat = SALARY_CATEGORIES.find((c) => c.key === name)
                      return [formatVnd(value), cat?.label ?? name]
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E0D8C8" }}
                  />
                  {SALARY_CATEGORIES.map((c) => (
                    <Bar key={c.key} dataKey={c.key} stackId="salary" fill={c.color} maxBarSize={44} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E0D8C8", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: "#FBF8F2", borderBottom: "1px solid #E0D8C8" }}>
                    <th style={thStyle("left")}>Month</th>
                    {SALARY_CATEGORIES.map((c) => (
                      <th key={c.key} style={thStyle("right")}>{c.label}</th>
                    ))}
                    <th style={thStyle("right")}>Company cost</th>
                    <th style={thStyle("right")}>Net paid</th>
                    <th style={thStyle("right")}>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #F0EAE0" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1A1814" }}>
                        {MONTH_ABBR[r.month - 1]} {r.year}
                      </td>
                      {SALARY_CATEGORIES.map((c) => (
                        <td key={c.key} style={numCell}>{cellVnd(r[c.col])}</td>
                      ))}
                      <td style={{ ...numCell, fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 600, color: "#1A1814" }}>
                        {formatVnd(r.total_vnd)}
                      </td>
                      <td style={numCell}>{cellVnd(r.net_paid_vnd)}</td>
                      <td style={numCell}>{r.headcount ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {rows.length >= ROW_CAP && (
            <div style={{ fontSize: 11.5, color: "#A89E8C", marginTop: 8, textAlign: "right" }}>
              Showing the latest {ROW_CAP} months.
            </div>
          )}

          {/* Bonus vs policy */}
          <div style={{ marginTop: 28 }}>
            <div style={{ marginBottom: 10 }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: "#1A1814", margin: 0 }}>
                Bonus vs policy
              </h3>
              <p style={{ fontSize: 12, color: "#7A7260", marginTop: 2 }}>
                Two-phase pool — Phase 1: {Math.round(FOUNDATION_RATE * 100)}% of target when target is hit · Phase 2: {Math.round(SURPLUS_BONUS_RATE * 100)}% of surplus (review-gated).
                Compare what policy says to what the sheet actually paid. Click <Pencil size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> to fill a month.
              </p>
            </div>

            <div style={{ background: "#FFFFFF", border: "1px solid #E0D8C8", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ background: "#FBF8F2", borderBottom: "1px solid #E0D8C8" }}>
                      <th style={thStyle("left")}>Month</th>
                      <th style={thStyle("right")}>Target</th>
                      <th style={thStyle("right")}>Qual. revenue</th>
                      <th style={thStyle("right")}>Surplus</th>
                      <th style={thStyle("left")}>Gate</th>
                      <th style={thStyle("right")}>Policy bonus</th>
                      <th style={thStyle("right")}>Paid</th>
                      <th style={thStyle("right")}>Δ</th>
                      <th style={thStyle("left")}>Status</th>
                      <th style={thStyle("right")}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const c = rowBonusCheck(r)
                      const meta = bonusStatusMeta(c.status)
                      const hasData = c.status !== "incomplete"
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid #F0EAE0" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1A1814" }}>
                            {MONTH_ABBR[r.month - 1]} {r.year}
                          </td>
                          {hasData ? (
                            <>
                              <td style={numCell}>{cellVnd(c.target)}</td>
                              <td style={numCell}>{cellVnd(c.qualifyingRevenue)}</td>
                              <td style={{ ...numCell, color: c.surplus > 0 ? "#2E7D52" : "#8B3030" }}>
                                {signedVnd(c.surplus)}
                              </td>
                              <td style={{ padding: "10px 14px", color: "#7A7260", fontSize: 12 }}>
                                {Math.round(c.gate.pct * 100)}%
                                {r.google_rating != null && (
                                  <span style={{ color: "#A89E8C" }}> · {r.google_rating}★·{r.new_reviews ?? 0}</span>
                                )}
                              </td>
                              <td style={numCell}>{cellVnd(c.policyPool)}</td>
                              <td style={numCell}>{cellVnd(c.paid)}</td>
                              <td style={{ ...numCell, color: c.delta === 0 ? "#4A4538" : c.delta > 0 ? "#8B3030" : "#B8922A" }}>
                                {c.delta === 0 ? "—" : signedVnd(c.delta)}
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: meta.color,
                                    background: meta.bg,
                                  }}
                                >
                                  {meta.label}
                                </span>
                              </td>
                            </>
                          ) : (
                            <td colSpan={8} style={{ padding: "10px 14px", color: "#A89E8C", fontStyle: "italic" }}>
                              No bonus data — add target + revenue
                            </td>
                          )}
                          <td style={{ padding: "6px 12px", textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              title="Edit bonus check"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: 7,
                                border: "1px solid #E0D8C8",
                                background: "#FDFAF5",
                                color: "#7A7260",
                                cursor: "pointer",
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit bonus drawer */}
      <Sheet open={editRow != null} onOpenChange={(o) => !o && setEditRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Bonus check — {editRow ? `${MONTH_ABBR[editRow.month - 1]} ${editRow.year}` : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {editRow && (
              <BonusCheckFields
                values={bonusForm}
                onChange={setBonusForm}
                year={editRow.year}
                month={editRow.month}
              />
            )}
          </div>
          <SheetFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveBonus} disabled={updateBonus.isPending}>
              {updateBonus.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <SalaryImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}

function thStyle(align: "left" | "right"): React.CSSProperties {
  return {
    textAlign: align,
    padding: "10px 14px",
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    color: "#7A7260",
  }
}

const numCell: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "right",
  fontFamily: "'DM Mono', ui-monospace, monospace",
  color: "#4A4538",
}

function cellVnd(n: number): string {
  return n > 0 ? formatVnd(n) : "—"
}

/** Signed VND for surplus/delta cells: "+12M" / "−12M". */
function signedVnd(n: number): string {
  if (n === 0) return "—"
  return `${n > 0 ? "+" : "−"}${formatVnd(Math.abs(n))}`
}
