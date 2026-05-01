import { useEffect, useMemo, useState } from "react"
import { format, parseISO, startOfDay, subDays } from "date-fns"
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  History as HistoryIcon,
  Loader2,
  Save,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getSupplierDebtSignedUrl,
  useLatestSupplierDebt,
  useSupplierDebtHistory,
  useUploadSupplierDebtSource,
  useUpsertSupplierDebt,
  type FinanceSupplierDebtReport,
} from "@/hooks/useFinanceSupplierDebt"

function formatCompactVnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—"
  const abs = Math.abs(amount)
  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B đ`
  if (abs >= 1_000_000) return `${Math.round(amount / 1_000_000)}M đ`
  return `${amount.toLocaleString()} đ`
}

function formatVnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—"
  return new Intl.NumberFormat("vi-VN", { style: "decimal", maximumFractionDigits: 0 }).format(amount) + " đ"
}

function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Most recent Friday on or before `date`, as ISO yyyy-MM-dd. */
function mostRecentFridayIso(date = new Date()): string {
  const d = startOfDay(date)
  const dow = d.getDay() // 0=Sun, 5=Fri
  const offset = (dow + 2) % 7 // days back to Friday
  const friday = subDays(d, offset)
  return format(friday, "yyyy-MM-dd")
}

/**
 * Supplier Debt panel. Mirrors CashPositionPanel layout: compact KPI tiles +
 * trend sparkline + collapsible inline form + history dialog. Shared between
 * the standalone `/finance/debt` page and the Debt Tracker tab on the
 * Finance Snapshot Cash Position area.
 */
export function SupplierDebtPanel() {
  const { data: latest } = useLatestSupplierDebt()
  const { data: history = [] } = useSupplierDebtHistory(12)
  const upsert = useUpsertSupplierDebt()
  const uploadSource = useUploadSupplierDebtSource()

  const [formOpen, setFormOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reportDate, setReportDate] = useState<string>(mostRecentFridayIso())
  const [totalDebt, setTotalDebt] = useState<string>("")
  const [totalOverdue, setTotalOverdue] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const existingForDate = useMemo<FinanceSupplierDebtReport | undefined>(
    () => history.find((h) => h.report_date === reportDate),
    [history, reportDate],
  )

  useEffect(() => {
    if (!formOpen) return
    if (existingForDate) {
      setTotalDebt(String(existingForDate.total_debt_vnd ?? ""))
      setTotalOverdue(
        existingForDate.total_overdue_vnd != null ? String(existingForDate.total_overdue_vnd) : "",
      )
      setNotes(existingForDate.notes ?? "")
      setFileName(existingForDate.source_file_name ?? "")
    } else {
      setTotalDebt("")
      setTotalOverdue("")
      setNotes("")
      setFileName("")
    }
    setFile(null)
    setMessage(null)
    setError(null)
  }, [existingForDate, reportDate, formOpen])

  const delta = useMemo(() => {
    if (history.length < 2) return null
    const [current, previous] = history
    const diff = Number(current.total_debt_vnd) - Number(previous.total_debt_vnd)
    return { diff, previous }
  }, [history])

  const handleSave = async () => {
    setError(null)
    setMessage(null)
    const debtValue = parseNumberInput(totalDebt)
    if (debtValue == null) {
      setError("Enter the total supplier debt (VND).")
      return
    }
    try {
      let uploaded: Awaited<ReturnType<typeof uploadSource.mutateAsync>> | null = null
      if (file) {
        uploaded = await uploadSource.mutateAsync({ reportDate, file })
      }
      await upsert.mutateAsync({
        reportDate,
        totalDebtVnd: debtValue,
        totalOverdueVnd: parseNumberInput(totalOverdue),
        notes: notes || null,
        sourceFilePath: uploaded?.path ?? existingForDate?.source_file_path ?? null,
        sourceFileName: uploaded?.fileName ?? existingForDate?.source_file_name ?? null,
        sourceFileMimeType: uploaded?.mimeType ?? existingForDate?.source_file_mime_type ?? null,
        sourceFileSizeBytes: uploaded?.sizeBytes ?? existingForDate?.source_file_size_bytes ?? null,
      })
      setMessage(`Saved ${format(parseISO(reportDate), "EEE, MMM d, yyyy")}.`)
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save supplier debt report")
    }
  }

  return (
    <section className="rounded-card border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Supplier Debt Tracker
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Friday snapshot of supplier liabilities. Upload your accountant screenshot and key totals
            to track debt exposure week over week.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setHistoryOpen(true)}
            disabled={history.length === 0}
          >
            <HistoryIcon className="h-3.5 w-3.5 mr-1.5" />
            History
          </Button>
          <Button type="button" size="sm" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? (
              <>
                <ChevronUp className="h-3.5 w-3.5 mr-1.5" /> Close
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5 mr-1.5" /> Log debt snapshot
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 pt-3">
        <KpiTile
          label="Total owed (latest)"
          icon={<Wallet className="h-4 w-4" />}
          value={latest ? formatCompactVnd(Number(latest.total_debt_vnd)) : "—"}
          sub={latest?.report_date ? `As of ${format(parseISO(latest.report_date), "MMM d")}` : "No data yet"}
        />
        <KpiTile
          label="Overdue exposure"
          icon={<AlertTriangle className="h-4 w-4" />}
          value={
            latest?.total_overdue_vnd != null
              ? formatCompactVnd(Number(latest.total_overdue_vnd))
              : "—"
          }
          sub={
            latest?.total_overdue_vnd != null && Number(latest.total_overdue_vnd) > 0 ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3 w-3" /> needs follow-up
              </span>
            ) : (
              "No overdue logged"
            )
          }
        />
        <KpiTile
          label="Weekly change"
          icon={<TrendingDown className="h-4 w-4" />}
          value={delta ? `${delta.diff > 0 ? "+" : ""}${formatCompactVnd(delta.diff)}` : "—"}
          sub={
            delta ? (
              <span
                className={
                  "inline-flex items-center gap-1 " +
                  (delta.diff > 0
                    ? "text-error"
                    : delta.diff < 0
                      ? "text-success"
                      : "text-muted-foreground")
                }
              >
                {delta.diff > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : delta.diff < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                vs {format(parseISO(delta.previous.report_date), "MMM d")}
              </span>
            ) : (
              "Need 2+ snapshots"
            )
          }
        />
      </div>

      <div className="px-4">
        {history.length > 1 ? (
          <Sparkline data={history} />
        ) : (
          <div className="rounded-sm border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Log at least two Friday snapshots to see the weekly trend.
          </div>
        )}
      </div>

      {formOpen && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border mt-3">
          <div className="text-sm font-semibold text-foreground">Log Friday snapshot</div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="debt-date">Snapshot date (Friday)</Label>
              <Input
                id="debt-date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-total">Total owed (VND)</Label>
              <Input
                id="debt-total"
                inputMode="decimal"
                placeholder="0"
                value={totalDebt}
                onChange={(e) => setTotalDebt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-overdue">Overdue (optional)</Label>
              <Input
                id="debt-overdue"
                inputMode="decimal"
                placeholder="0"
                value={totalOverdue}
                onChange={(e) => setTotalOverdue(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-file">Screenshot / PDF</Label>
              <Input
                id="debt-file"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  if (f) setFileName(f.name)
                }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="debt-notes">Notes (optional)</Label>
            <Input
              id="debt-notes"
              placeholder="e.g. Heineken +12M this week, Pernod on hold"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleSave} disabled={upsert.isPending || uploadSource.isPending}>
              {upsert.isPending || uploadSource.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Save snapshot
                </>
              )}
            </Button>
            {fileName && (
              <span className="text-xs text-muted-foreground">
                <Upload className="h-3 w-3 inline-block mr-1" />
                {fileName}
              </span>
            )}
            {existingForDate && (
              <span className="text-xs text-muted-foreground">
                Already logged for this date — saving will update it.
              </span>
            )}
          </div>
          {message && <p className="text-xs text-success">{message}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Supplier debt history</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Total owed</th>
                  <th className="px-3 py-2 text-right">Overdue</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Attachment</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <HistoryRow key={row.id} row={row} />
                ))}
                {history.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-sm text-muted-foreground text-center" colSpan={5}>
                      No entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function KpiTile({
  label,
  icon,
  value,
  sub,
}: {
  label: string
  icon: React.ReactNode
  value: string
  sub: React.ReactNode
}) {
  return (
    <div className="rounded-card border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function Sparkline({ data }: { data: FinanceSupplierDebtReport[] }) {
  // data is newest -> oldest; flip for chronological plot
  const series = [...data].reverse()
  const totals = series.map((d) => Number(d.total_debt_vnd) || 0)
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const range = Math.max(1, max - min)

  const width = 600
  const height = 60
  const step = totals.length > 1 ? width / (totals.length - 1) : width

  const points = totals.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <div className="rounded-card border border-border bg-background p-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Last {series.length} weeks · supplier debt</span>
        <span>
          {series[0]?.report_date && format(parseISO(series[0].report_date), "MMM d")} –{" "}
          {series[series.length - 1]?.report_date &&
            format(parseISO(series[series.length - 1].report_date), "MMM d")}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 mt-1" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          className="text-primary"
          points={points.join(" ")}
        />
      </svg>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
        <span>min {formatCompactVnd(min)}</span>
        <span>max {formatCompactVnd(max)}</span>
      </div>
    </div>
  )
}

function HistoryRow({ row }: { row: FinanceSupplierDebtReport }) {
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

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 whitespace-nowrap">
        {format(parseISO(row.report_date), "EEE, MMM d, yyyy")}
      </td>
      <td className="px-3 py-2 text-right font-medium text-foreground">
        {formatVnd(Number(row.total_debt_vnd))}
      </td>
      <td className="px-3 py-2 text-right">
        {row.total_overdue_vnd != null ? formatVnd(Number(row.total_overdue_vnd)) : "—"}
      </td>
      <td className="px-3 py-2 text-muted-foreground max-w-[240px] truncate">{row.notes || "—"}</td>
      <td className="px-3 py-2">
        {row.source_file_path ? (
          <Button type="button" size="sm" variant="ghost" onClick={handleOpen} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {row.source_file_name ?? "View"}
              </>
            )}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

export default SupplierDebtPanel
