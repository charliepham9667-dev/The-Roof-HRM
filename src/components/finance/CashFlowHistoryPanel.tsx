import { useMemo, useState } from "react"
import { format, parseISO, subDays } from "date-fns"
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FinancePill, formatCompactVnd, formatVnd } from "@/components/finance/finance-ui"
import { parseNumberInput, type DebtCategory } from "@/lib/finance-headroom"
import {
  categoryLabel,
  MANUAL_CASHFLOW_CATEGORIES,
  useDeleteManualCashflow,
  useInsertManualCashflow,
  useManualCashflow,
  type ManualCashflowCategory,
  type ManualCashflowDirection,
} from "@/hooks/useFinanceManualCashflow"
import { useUpdateDebtItemCategory } from "@/hooks/useFinanceSupplierDebtItems"

// ── Types ────────────────────────────────────────────────────────────────────

type UnifiedRow = {
  key: string
  date: string
  direction: "in" | "out"
  amount: number
  categoryRaw: string
  category: string
  description: string
  notes: string | null
  source: "manual" | "debt"
  manualId?: string
  debtItemId?: string
}

// ── Paid debt items query ────────────────────────────────────────────────────

type PaidDebtItem = {
  id: string
  vendor: string
  category: string
  amount_vnd: number
  due_date: string
  paid_at: string | null
  notes: string | null
  updated_at: string
}

function usePaidDebtItems() {
  return useQuery<PaidDebtItem[]>({
    queryKey: ["cash-flow-paid-debt-full"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_supplier_debt_items")
        .select("id,vendor,category,amount_vnd,due_date,paid_at,notes,updated_at")
        .eq("status", "paid")
        .order("due_date", { ascending: false })
      if (error) throw error
      return (data ?? []) as PaidDebtItem[]
    },
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const todayIso = () => new Date().toISOString().slice(0, 10)
const defaultFrom = () => subDays(new Date(), 90).toISOString().slice(0, 10)

function debtCatLabel(raw: string): string {
  if (!raw) return "Other"
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, " ")
}

// All unique categories that can appear in the unified list (debt + manual)
const ALL_CATEGORIES = [
  "all",
  "inventory",
  "rent",
  "capex",
  "utilities",
  "dividend",
  "salary",
  "other",
] as const

type CategoryFilter = (typeof ALL_CATEGORIES)[number]

function categoryFilterLabel(c: CategoryFilter): string {
  if (c === "all") return "All categories"
  return MANUAL_CASHFLOW_CATEGORIES.find((x) => x.value === c)?.label ?? debtCatLabel(c)
}

// ── Component ────────────────────────────────────────────────────────────────

export function CashFlowHistoryPanel() {
  const { data: manualEntries = [], isLoading: manualLoading } = useManualCashflow()
  const { data: debtItems = [], isLoading: debtLoading } = usePaidDebtItems()
  const insert = useInsertManualCashflow()
  const remove = useDeleteManualCashflow()
  const updateCategory = useUpdateDebtItemCategory()

  // Track which debt row is being category-edited
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<DebtCategory>("other")

  const startEditCategory = (row: UnifiedRow) => {
    setEditingDebtId(row.debtItemId!)
    setEditingCategory(row.categoryRaw as DebtCategory)
  }

  const saveEditCategory = async () => {
    if (!editingDebtId) return
    try {
      await updateCategory.mutateAsync({ id: editingDebtId, category: editingCategory })
      toast.success("Category updated.")
      setEditingDebtId(null)
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to update")
    }
  }

  // ── Panel collapse ────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false)

  // ── Add-entry form ────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [direction, setDirection] = useState<ManualCashflowDirection>("out")
  const [flowDate, setFlowDate] = useState(todayIso)
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ManualCashflowCategory>("other")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>("all")
  const [filterFrom, setFilterFrom] = useState(defaultFrom)
  const [filterTo, setFilterTo] = useState(todayIso)
  const [filterMinAmt, setFilterMinAmt] = useState("")
  const [filterMaxAmt, setFilterMaxAmt] = useState("")

  const handleResetFilters = () => {
    setFilterCategory("all")
    setFilterFrom(defaultFrom())
    setFilterTo(todayIso())
    setFilterMinAmt("")
    setFilterMaxAmt("")
  }

  // ── Save manual entry ─────────────────────────────────────────────────────
  const handleSave = async () => {
    const amt = parseNumberInput(amount)
    if (amt == null || amt <= 0) { toast.error("Enter a valid amount."); return }
    try {
      await insert.mutateAsync({ flowDate, direction, amountVnd: amt, category, description, notes: notes || null })
      toast.success("Entry saved.")
      setAmount(""); setDescription(""); setNotes("")
      setAddOpen(false)
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to save")
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this manual entry?")) return
    try { await remove.mutateAsync(id); toast.success("Deleted.") }
    catch (err) { toast.error((err as Error)?.message || "Failed to delete") }
  }

  // ── Merge & sort ──────────────────────────────────────────────────────────
  const allRows = useMemo((): UnifiedRow[] => {
    const rows: UnifiedRow[] = []

    for (const e of manualEntries) {
      rows.push({
        key: `m-${e.id}`,
        date: e.flow_date.slice(0, 10),
        direction: e.direction,
        amount: Number(e.amount_vnd),
        categoryRaw: e.category,
        category: categoryLabel(e.category),
        description: e.description || e.category,
        notes: e.notes,
        source: "manual",
        manualId: e.id,
      })
    }

    for (const d of debtItems) {
      const date = (d.paid_at || d.due_date || d.updated_at || "").slice(0, 10)
      if (!date) continue
      rows.push({
        key: `d-${d.id}`,
        date,
        direction: "out",
        amount: Number(d.amount_vnd),
        categoryRaw: d.category || "other",
        category: debtCatLabel(d.category),
        description: d.vendor || debtCatLabel(d.category),
        notes: d.notes,
        source: "debt",
        debtItemId: d.id,
      })
    }

    return rows.sort((a, b) => b.date.localeCompare(a.date))
  }, [manualEntries, debtItems])

  // ── Apply filters ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const minAmt = parseNumberInput(filterMinAmt)
    const maxAmt = parseNumberInput(filterMaxAmt)
    return allRows.filter((r) => {
      if (filterCategory !== "all" && r.categoryRaw !== filterCategory) return false
      if (r.date < filterFrom) return false
      if (r.date > filterTo) return false
      if (minAmt != null && r.amount < minAmt) return false
      if (maxAmt != null && r.amount > maxAmt) return false
      return true
    })
  }, [allRows, filterCategory, filterFrom, filterTo, filterMinAmt, filterMaxAmt])

  const totalOut = filtered.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0)
  const totalIn  = filtered.filter((r) => r.direction === "in").reduce((s, r) => s + r.amount, 0)
  const isLoading = manualLoading || debtLoading

  const filtersActive =
    filterCategory !== "all" ||
    filterFrom !== defaultFrom() ||
    filterTo !== todayIso() ||
    filterMinAmt !== "" ||
    filterMaxAmt !== ""

  return (
    <div className="rounded-card border border-border bg-muted/30">
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 p-4">
        <button
          type="button"
          className="flex items-center gap-2 text-left flex-1 min-w-0 group"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          }
          <div>
            <span className="text-sm font-semibold group-hover:underline">Cash flow history</span>
            {!isLoading && (
              <span className="ml-2 text-xs text-muted-foreground">
                {allRows.length} {allRows.length === 1 ? "entry" : "entries"}
                {filtersActive && ` · ${filtered.length} shown`}
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              All paid items from the Debt Tracker + manually logged entries
            </p>
          </div>
        </button>

        <Button
          type="button" size="sm" variant="outline"
          onClick={(e) => { e.stopPropagation(); setAddOpen((v) => !v); if (!expanded) setExpanded(true) }}
        >
          {addOpen
            ? <><ChevronUp className="h-3.5 w-3.5 mr-1" />Close</>
            : <><Plus className="h-3.5 w-3.5 mr-1" />Log manual entry</>
          }
        </Button>
      </div>

      {/* ── Expandable body ─────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 space-y-4 pt-4">

          {/* Add-entry form */}
          {addOpen && (
            <div className="rounded-md border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Log manual entry</p>
              <div className="grid gap-3 md:grid-cols-5">
                <div className="space-y-1">
                  <Label>Direction</Label>
                  <Select value={direction} onValueChange={(v) => setDirection(v as ManualCashflowDirection)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="out">Cash out ↓</SelectItem>
                      <SelectItem value="in">Cash in ↑</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={flowDate} onChange={(e) => setFlowDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Amount (VND)</Label>
                  <Input inputMode="decimal" placeholder="440000000" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as ManualCashflowCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MANUAL_CASHFLOW_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input placeholder="e.g. Q1 dividend, May salary" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Input placeholder="Any extra context" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button onClick={handleSave} disabled={insert.isPending}>
                {insert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save entry
              </Button>
            </div>
          )}

          {/* Filters */}
          <div className="rounded-md border border-border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</span>
              {filtersActive && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleResetFilters}
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as CategoryFilter)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">{categoryFilterLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From date</Label>
                <Input
                  type="date" className="h-8 text-xs"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To date</Label>
                <Input
                  type="date" className="h-8 text-xs"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Min amount</Label>
                  <Input
                    inputMode="decimal" placeholder="0" className="h-8 text-xs"
                    value={filterMinAmt}
                    onChange={(e) => setFilterMinAmt(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max amount</Label>
                  <Input
                    inputMode="decimal" placeholder="∞" className="h-8 text-xs"
                    value={filterMaxAmt}
                    onChange={(e) => setFilterMaxAmt(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40">
                  <tr className="text-xs uppercase text-muted-foreground text-left">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Description / Vendor</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Notes</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.key} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {format(parseISO(row.date), "EEE, MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-2">
                        <FinancePill tone={row.source === "manual" ? "warn" : "neutral"}>
                          {row.source === "manual" ? "Manual" : "Debt tracker"}
                        </FinancePill>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {editingDebtId === row.debtItemId ? (
                          <Select
                            value={editingCategory}
                            onValueChange={(v) => setEditingCategory(v as DebtCategory)}
                          >
                            <SelectTrigger className="h-7 text-xs w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_CATEGORIES.filter((c) => c !== "all").map((c) => (
                                <SelectItem key={c} value={c} className="text-xs">
                                  {categoryFilterLabel(c as CategoryFilter)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          row.category
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{row.description}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        <span className={row.direction === "out" ? "text-[#6C2B29]" : "text-success"}>
                          {row.direction === "out" ? "−" : "+"}{formatVnd(row.amount)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate">
                        {row.notes || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.source === "manual" && row.manualId ? (
                          <Button
                            type="button" size="sm" variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(row.manualId!)}
                            disabled={remove.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : row.source === "debt" && row.debtItemId ? (
                          editingDebtId === row.debtItemId ? (
                            <div className="flex gap-1">
                              <Button
                                type="button" size="sm" variant="ghost"
                                className="text-success hover:text-success"
                                onClick={saveEditCategory}
                                disabled={updateCategory.isPending}
                              >
                                {updateCategory.isPending
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Save className="h-3.5 w-3.5" />
                                }
                              </Button>
                              <Button
                                type="button" size="sm" variant="ghost"
                                className="text-muted-foreground"
                                onClick={() => setEditingDebtId(null)}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button" size="sm" variant="ghost"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => startEditCategory(row)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground px-2">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 text-xs font-semibold">
                    <td className="px-3 py-2" colSpan={4}>
                      {filtersActive ? `Filtered total (${filtered.length} rows)` : `Total (${filtered.length} rows)`}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {totalIn > 0 && <span className="text-success mr-2">+{formatCompactVnd(totalIn)}</span>}
                      {totalOut > 0 && <span className="text-[#6C2B29]">−{formatCompactVnd(totalOut)}</span>}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-1">
              {allRows.length > 0 ? "No entries match the current filters." : "No cash flow entries yet."}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
