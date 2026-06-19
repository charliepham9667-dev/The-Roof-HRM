import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  ChevronDown,
  ChevronUp,
  Download,
  History as HistoryIcon,
  ImageUp,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DebtStatusBadge,
  FinanceKpiCard,
  FinancePill,
  formatCompactVnd,
  formatVnd,
} from "@/components/finance/finance-ui"
import {
  categoryLabel,
  dueUrgency,
  formatDueRelative,
  formatIsoDateLabel,
  mostRecentFridayIso,
  parseNumberInput,
  type DebtCategory,
  type DebtItemStatus,
} from "@/lib/finance-headroom"
import { DebtImportDialog } from "@/components/finance/DebtImportDialog"
import { CashFlowHistoryPanel } from "@/components/finance/CashFlowHistoryPanel"
import {
  nextStatusForAction,
  useDebtCategoryBreakdown,
  useDebtRibbonMetrics,
  useDeleteDebtItem,
  useUpdateDebtItemStatus,
  useUpsertDebtItem,
  type FinanceSupplierDebtItem,
  type PaymentChannel,
} from "@/hooks/useFinanceSupplierDebtItems"
import {
  getSupplierDebtSignedUrl,
  useDeleteSupplierDebtHistory,
  useSupplierDebtHistory,
  useUploadSupplierDebtSource,
  useUpsertSupplierDebt,
  type FinanceSupplierDebtReport,
} from "@/hooks/useFinanceSupplierDebt"

const CATEGORY_OPTIONS: DebtCategory[] = ["inventory", "rent", "capex", "utilities", "dividend", "other"]

const catBarColor: Record<DebtCategory, string> = {
  inventory: "#C74C3C",
  rent: "#6C2B29",
  capex: "#4A1F1C",
  utilities: "#2563EB",
  dividend: "#7C3AED",
  other: "#78716C",
}

export function SupplierDebtPanel() {
  const { buckets, items, isLoading } = useDebtRibbonMetrics()
  const breakdown = useDebtCategoryBreakdown()
  const upsertItem = useUpsertDebtItem()
  const updateStatus = useUpdateDebtItemStatus()
  const deleteItem = useDeleteDebtItem()

  const { data: history = [] } = useSupplierDebtHistory(24)
  const upsertWeekly = useUpsertSupplierDebt()
  const uploadSource = useUploadSupplierDebtSource()

  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [channelFilter, setChannelFilter] = useState<PaymentChannel | "all">("all")
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editItem, setEditItem] = useState<FinanceSupplierDebtItem | null>(null)

  const filteredItems = useMemo(() => {
    if (channelFilter === "all") return items
    return items.filter((i) => i.payment_channel === channelFilter)
  }, [items, channelFilter])

  const filteredTotal = useMemo(
    () => filteredItems.reduce((s, i) => s + Number(i.amount_vnd), 0),
    [filteredItems],
  )

  const [vendor, setVendor] = useState("")
  const [category, setCategory] = useState<DebtCategory>("inventory")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [itemNotes, setItemNotes] = useState("")
  const [itemStatus, setItemStatus] = useState<DebtItemStatus>("pending")

  const [reportDate, setReportDate] = useState(mostRecentFridayIso())
  const [totalDebt, setTotalDebt] = useState("")
  const [totalOverdue, setTotalOverdue] = useState("")
  const [weeklyNotes, setWeeklyNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [weeklyMessage, setWeeklyMessage] = useState<string | null>(null)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)

  const existingWeekly = useMemo(
    () => history.find((h) => h.report_date === reportDate),
    [history, reportDate],
  )

  useEffect(() => {
    if (!weeklyOpen) return
    if (existingWeekly) {
      setTotalDebt(String(existingWeekly.total_debt_vnd ?? ""))
      setTotalOverdue(
        existingWeekly.total_overdue_vnd != null ? String(existingWeekly.total_overdue_vnd) : "",
      )
      setWeeklyNotes(existingWeekly.notes ?? "")
    } else {
      setTotalDebt("")
      setTotalOverdue("")
      setWeeklyNotes("")
    }
    setFile(null)
    setWeeklyMessage(null)
    setWeeklyError(null)
  }, [existingWeekly, reportDate, weeklyOpen])

  const openAdd = (item?: FinanceSupplierDebtItem) => {
    if (item) {
      setEditItem(item)
      setVendor(item.vendor)
      setCategory(item.category)
      setAmount(String(item.amount_vnd))
      setDueDate(item.due_date)
      setItemNotes(item.notes ?? "")
      setItemStatus(item.status)
    } else {
      setEditItem(null)
      setVendor("")
      setCategory("inventory")
      setAmount("")
      setDueDate(format(new Date(), "yyyy-MM-dd"))
      setItemNotes("")
      setItemStatus("pending")
    }
    setAddOpen(true)
  }

  const handleSaveItem = async () => {
    const amt = parseNumberInput(amount)
    if (!vendor.trim() || amt == null) return
    await upsertItem.mutateAsync({
      id: editItem?.id,
      vendor,
      category,
      amountVnd: amt,
      dueDate,
      status: itemStatus,
      notes: itemNotes,
    })
    setAddOpen(false)
  }

  const handleRowAction = async (item: FinanceSupplierDebtItem) => {
    const next = nextStatusForAction(item.status)
    if (next === item.status) return
    await updateStatus.mutateAsync({ id: item.id, status: next, dueDate: item.due_date })
  }

  const handleMarkStopped = async (item: FinanceSupplierDebtItem) => {
    await updateStatus.mutateAsync({ id: item.id, status: "stopped" })
  }

  const handleWeeklySave = async () => {
    setWeeklyError(null)
    setWeeklyMessage(null)
    const debtValue = parseNumberInput(totalDebt)
    if (debtValue == null) {
      setWeeklyError("Enter the total supplier debt (VND).")
      return
    }
    try {
      let uploaded: Awaited<ReturnType<typeof uploadSource.mutateAsync>> | null = null
      if (file) {
        uploaded = await uploadSource.mutateAsync({ reportDate, file })
      }
      await upsertWeekly.mutateAsync({
        reportDate,
        totalDebtVnd: debtValue,
        totalOverdueVnd: parseNumberInput(totalOverdue),
        notes: weeklyNotes || null,
        sourceFilePath: uploaded?.path ?? existingWeekly?.source_file_path ?? null,
        sourceFileName: uploaded?.fileName ?? existingWeekly?.source_file_name ?? null,
        sourceFileMimeType: uploaded?.mimeType ?? existingWeekly?.source_file_mime_type ?? null,
        sourceFileSizeBytes: uploaded?.sizeBytes ?? existingWeekly?.source_file_size_bytes ?? null,
      })
      setWeeklyMessage(`Saved ${format(parseISO(reportDate), "EEE, MMM d, yyyy")}.`)
      setFile(null)
    } catch (err) {
      setWeeklyError(err instanceof Error ? err.message : "Failed to save")
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <FinanceKpiCard
          label="Total Owed"
          value={formatCompactVnd(buckets.total)}
          sublabel={`${buckets.vendorCount} vendors`}
          variant="active"
        />
        <FinanceKpiCard
          label="Due today / overdue"
          value={formatCompactVnd(buckets.dueTodayOrOverdue)}
          pill={<FinancePill tone="error">!</FinancePill>}
        />
        <FinanceKpiCard
          label="Pending"
          value={formatCompactVnd(buckets.pendingTotal)}
          pill={<FinancePill tone="info">?</FinancePill>}
        />
        <FinanceKpiCard
          label="Stopped"
          value={formatCompactVnd(buckets.stoppedTotal)}
          pill={<FinancePill tone="neutral">⏸</FinancePill>}
        />
      </div>

      <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-border sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
          <h3 className="text-base font-semibold text-foreground sm:text-lg">Supplier ledger · who, what, when</h3>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              {(["all", "bank", "cash"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={`px-2.5 py-1 capitalize ${
                    channelFilter === ch
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setChannelFilter(ch)}
                >
                  {ch === "all" ? "All" : ch}
                </button>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <ImageUp className="h-3.5 w-3.5 mr-1" />
              Import from screenshot
            </Button>
            <Button type="button" size="sm" onClick={() => openAdd()}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add debt
            </Button>
          </div>
        </div>
        {/* Mobile card list */}
        <div className="space-y-2 p-3 md:hidden">
          {isLoading && (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Loading ledger…
            </div>
          )}
          {!isLoading && filteredItems.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "No line items yet. Add vendors from your Friday accountant notes."
                : "No items match this channel filter."}
            </div>
          )}
          {filteredItems.map((d) => {
            const urgency = dueUrgency(d.due_date)
            const dueClass =
              urgency === "today" || urgency === "overdue"
                ? "text-[#6C2B29] font-bold"
                : urgency === "soon"
                  ? "text-warning font-semibold"
                  : "text-muted-foreground"
            return (
              <div key={d.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium">
                      {d.vendor_code && (
                        <span className="font-mono text-[10px] text-muted-foreground">{d.vendor_code}</span>
                      )}
                      <span className="break-words">{d.vendor}</span>
                      {d.payment_channel && (
                        <FinancePill tone="neutral">{d.payment_channel}</FinancePill>
                      )}
                    </div>
                    <span
                      className="mt-1 inline-flex items-center gap-1.5 text-xs"
                      style={{ color: catBarColor[d.category] }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: catBarColor[d.category] }} />
                      {categoryLabel(d.category)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="whitespace-nowrap font-mono font-semibold tabular-nums">
                      {formatCompactVnd(Number(d.amount_vnd))}
                    </div>
                    <div className={`mt-0.5 text-[11px] ${dueClass}`}>{formatDueRelative(d.due_date)}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <DebtStatusBadge status={d.status} />
                  <div className="flex flex-wrap gap-1">
                    {d.status === "pending" && (
                      <>
                        <Button type="button" size="sm" className="h-7 text-xs" onClick={() => handleRowAction(d)} disabled={updateStatus.isPending}>
                          Paid
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMarkStopped(d)} disabled={updateStatus.isPending}>
                          Stop
                        </Button>
                      </>
                    )}
                    {d.status === "stopped" && (
                      <>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRowAction(d)} disabled={updateStatus.isPending}>
                          Resume
                        </Button>
                        <Button type="button" size="sm" className="h-7 text-xs" onClick={() => updateStatus.mutateAsync({ id: d.id, status: "paid", dueDate: d.due_date })} disabled={updateStatus.isPending}>
                          Paid
                        </Button>
                      </>
                    )}
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAdd(d)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
                {d.notes && (
                  <p className="mt-1.5 text-xs text-muted-foreground">{d.notes}</p>
                )}
              </div>
            )
          })}
          {filteredItems.length > 0 && (
            <div className="flex items-center justify-between rounded-md border-2 border-[#C74C3C] bg-primary/5 px-3 py-2 font-bold">
              <span>Total{channelFilter !== "all" ? ` (${channelFilter})` : ""}</span>
              <span className="whitespace-nowrap font-mono tabular-nums">{formatCompactVnd(filteredTotal)}</span>
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-[#FAF4EF]">
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-[#6C2B29] font-bold">
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading ledger…
                  </td>
                </tr>
              )}
              {!isLoading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    {items.length === 0
                      ? "No line items yet. Add vendors from your Friday accountant notes."
                      : "No items match this channel filter."}
                  </td>
                </tr>
              )}
              {filteredItems.map((d) => {
                const urgency = dueUrgency(d.due_date)
                const dueClass =
                  urgency === "today" || urgency === "overdue"
                    ? "text-[#6C2B29] font-bold"
                    : urgency === "soon"
                      ? "text-warning font-semibold"
                      : "text-muted-foreground"
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">
                      {d.vendor_code && (
                        <span className="text-[10px] font-mono text-muted-foreground mr-1.5">
                          {d.vendor_code}
                        </span>
                      )}
                      {d.vendor}
                      {d.payment_channel && (
                        <FinancePill tone="neutral" className="ml-1.5 align-middle">
                          {d.payment_channel}
                        </FinancePill>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                        style={{ color: catBarColor[d.category] }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: catBarColor[d.category] }}
                        />
                        {categoryLabel(d.category)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold tabular-nums">
                      {formatCompactVnd(Number(d.amount_vnd))}
                    </td>
                    <td className={`px-3 py-3 text-xs ${dueClass}`}>
                      {formatDueRelative(d.due_date)}
                    </td>
                    <td className="px-3 py-3">
                      <DebtStatusBadge status={d.status} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground max-w-[200px] line-clamp-2">
                      {d.notes || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {d.status === "pending" && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleRowAction(d)}
                              disabled={updateStatus.isPending}
                            >
                              Paid
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleMarkStopped(d)}
                              disabled={updateStatus.isPending}
                            >
                              Stop
                            </Button>
                          </>
                        )}
                        {d.status === "stopped" && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleRowAction(d)}
                              disabled={updateStatus.isPending}
                            >
                              Resume
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                updateStatus.mutateAsync({
                                  id: d.id,
                                  status: "paid",
                                  dueDate: d.due_date,
                                })
                              }
                              disabled={updateStatus.isPending}
                            >
                              Paid
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => openAdd(d)}
                          title="Edit or delete"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredItems.length > 0 && (
                <tr className="bg-primary/5 border-t-2 border-[#C74C3C]">
                  <td className="px-3 py-3 font-bold">
                    Total{channelFilter !== "all" ? ` (${channelFilter})` : ""}
                  </td>
                  <td />
                  <td className="px-3 py-3 text-right font-mono font-bold">
                    {formatCompactVnd(filteredTotal)}
                  </td>
                  <td colSpan={4} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {breakdown.slice(0, 3).map((o) => (
            <div key={o.key} className="rounded-card border border-border bg-card p-3 shadow-card">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: catBarColor[o.key] }}
                />
                {o.label}
                <span className="ml-auto text-muted-foreground">{o.count} vendors</span>
              </div>
              <div className="text-xl font-semibold mt-1">{formatCompactVnd(o.amount)}</div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${o.pct}%`, background: catBarColor[o.key] }}
                />
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-1">{o.pct.toFixed(0)}% of debt</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-card border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-sm font-semibold">Weekly reconciliation snapshot</span>
          <FinancePill tone="info">Friday · screenshot + totals</FinancePill>
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setHistoryOpen(true)}
              disabled={history.length === 0}
            >
              <HistoryIcon className="h-3.5 w-3.5 mr-1" />
              History
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setWeeklyOpen((v) => !v)}>
              {weeklyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span className="ml-1">Log Friday snapshot</span>
            </Button>
          </div>
        </div>
        {weeklyOpen && (
          <div className="space-y-3 border-t border-border pt-3 mt-2">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Snapshot date</Label>
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Total owed (VND)</Label>
                <Input value={totalDebt} onChange={(e) => setTotalDebt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Overdue (optional)</Label>
                <Input value={totalOverdue} onChange={(e) => setTotalOverdue(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Screenshot / PDF</Label>
                <Input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <Input
              placeholder="Notes — optional reconciliation context"
              value={weeklyNotes}
              onChange={(e) => setWeeklyNotes(e.target.value)}
            />
            <Button onClick={handleWeeklySave} disabled={upsertWeekly.isPending}>
              {upsertWeekly.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save weekly snapshot
            </Button>
            {weeklyMessage && <p className="text-xs text-success">{weeklyMessage}</p>}
            {weeklyError && <p className="text-xs text-destructive">{weeklyError}</p>}
          </div>
        )}
      </div>

      <DebtImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit debt" : "Add debt"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Vendor</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as DebtCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (VND)</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={itemStatus} onValueChange={(v) => setItemStatus(v as DebtItemStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="stopped">Stopped</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            {editItem && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  deleteItem.mutate(editItem.id)
                  setAddOpen(false)
                }}
              >
                Delete
              </Button>
            )}
            <Button onClick={handleSaveItem} disabled={upsertItem.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[min(96vw,80rem)] sm:max-w-[min(96vw,80rem)] max-h-[min(92dvh,720px)] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Debt import & snapshot history</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">
            Payment-list screenshots and Friday reconciliation totals. Re-importing the same date
            and channel updates that row. Delete duplicates you no longer need.
          </p>
          {/* Mobile card list */}
          <div className="space-y-2 md:hidden">
            {history.length === 0 ? (
              <div className="rounded-md border border-border px-3 py-8 text-center text-muted-foreground">No history yet.</div>
            ) : (
              history.map((row) => <WeeklyHistoryCard key={row.id} row={row} />)
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-md border border-border md:block">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-secondary/40">
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Overdue</th>
                  <th className="px-3 py-2 text-left min-w-[200px]">Notes</th>
                  <th className="px-3 py-2 text-center w-20">File</th>
                  <th className="px-3 py-2 text-center w-16" />
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <WeeklyHistoryRow key={row.id} row={row} />
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      No history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <CashFlowHistoryPanel />
    </div>
  )
}

function weeklyChannelLabel(channel: FinanceSupplierDebtReport["payment_channel"]): string {
  if (channel === "bank") return "Payment list · Bank"
  if (channel === "cash") return "Payment list · Cash"
  return "Friday snapshot"
}

function WeeklyHistoryRow({ row }: { row: FinanceSupplierDebtReport }) {
  const deleteHistory = useDeleteSupplierDebtHistory()
  const [busy, setBusy] = useState(false)

  const handleOpen = async () => {
    if (!row.source_file_path) return
    setBusy(true)
    try {
      const url = await getSupplierDebtSignedUrl(row.source_file_path)
      if (url) window.open(url, "_blank", "noopener,noreferrer")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    const label = `${formatIsoDateLabel(row.report_date, "MMM d, yyyy")} · ${weeklyChannelLabel(row.payment_channel)}`
    if (!window.confirm(`Delete this history entry?\n\n${label}`)) return
    try {
      await deleteHistory.mutateAsync(row.id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete entry")
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 whitespace-nowrap">
        {formatIsoDateLabel(row.report_date, "EEE, MMM d")}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
        {weeklyChannelLabel(row.payment_channel)}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
        {formatVnd(Number(row.total_debt_vnd))}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {row.total_overdue_vnd != null ? formatVnd(Number(row.total_overdue_vnd)) : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground max-w-md">{row.notes || "—"}</td>
      <td className="px-3 py-2 text-center">
        {row.source_file_path ? (
          <Button type="button" size="sm" variant="ghost" onClick={handleOpen} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
          disabled={deleteHistory.isPending}
          title="Delete this entry"
        >
          {deleteHistory.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </td>
    </tr>
  )
}

function WeeklyHistoryCard({ row }: { row: FinanceSupplierDebtReport }) {
  const deleteHistory = useDeleteSupplierDebtHistory()
  const [busy, setBusy] = useState(false)

  const handleOpen = async () => {
    if (!row.source_file_path) return
    setBusy(true)
    try {
      const url = await getSupplierDebtSignedUrl(row.source_file_path)
      if (url) window.open(url, "_blank", "noopener,noreferrer")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    const label = `${formatIsoDateLabel(row.report_date, "MMM d, yyyy")} · ${weeklyChannelLabel(row.payment_channel)}`
    if (!window.confirm(`Delete this history entry?\n\n${label}`)) return
    try {
      await deleteHistory.mutateAsync(row.id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete entry")
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{formatIsoDateLabel(row.report_date, "EEE, MMM d")}</div>
          <div className="text-xs text-muted-foreground">{weeklyChannelLabel(row.payment_channel)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="whitespace-nowrap font-mono tabular-nums">{formatVnd(Number(row.total_debt_vnd))}</div>
          {row.total_overdue_vnd != null && (
            <div className="whitespace-nowrap text-[11px] text-muted-foreground">Overdue {formatVnd(Number(row.total_overdue_vnd))}</div>
          )}
        </div>
      </div>
      {row.notes && <p className="mt-1.5 text-xs text-muted-foreground">{row.notes}</p>}
      <div className="mt-2 flex items-center gap-2">
        {row.source_file_path && (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={handleOpen} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="ml-1">File</span>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleDelete}
          disabled={deleteHistory.isPending}
        >
          {deleteHistory.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          <span className="ml-1">Delete</span>
        </Button>
      </div>
    </div>
  )
}

export default SupplierDebtPanel
