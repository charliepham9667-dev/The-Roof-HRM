import { useEffect, useMemo, useState } from "react"
import { format, parseISO, startOfDay, subDays } from "date-fns"
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Save,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getSupplierDebtSignedUrl,
  useLatestSupplierDebt,
  useSupplierDebtHistory,
  useUploadSupplierDebtSource,
  useUpsertSupplierDebt,
  type FinanceSupplierDebtReport,
} from "@/hooks/useFinanceSupplierDebt"

function formatVnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—"
  return new Intl.NumberFormat("vi-VN", { style: "decimal", maximumFractionDigits: 0 }).format(amount) + " đ"
}

function formatCompactVnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—"
  if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B đ`
  if (Math.abs(amount) >= 1_000_000) return `${Math.round(amount / 1_000_000)}M đ`
  return `${amount.toLocaleString()} đ`
}

function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Return the most recent Friday on or before `date`, as an ISO yyyy-MM-dd string. */
function mostRecentFridayIso(date = new Date()): string {
  const d = startOfDay(date)
  const dow = d.getDay() // 0=Sun, 5=Fri
  const offset = (dow + 2) % 7 // days back to Friday
  const friday = subDays(d, offset)
  return format(friday, "yyyy-MM-dd")
}

export function SupplierDebt() {
  const { data: latest } = useLatestSupplierDebt()
  const { data: history = [] } = useSupplierDebtHistory(12)
  const upsert = useUpsertSupplierDebt()
  const uploadSource = useUploadSupplierDebtSource()

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
  }, [existingForDate, reportDate])

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

  const delta = useMemo(() => {
    if (history.length < 2) return null
    const [current, previous] = history
    const diff = Number(current.total_debt_vnd) - Number(previous.total_debt_vnd)
    return { diff, previous }
  }, [history])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Supplier Debt Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Friday snapshot of supplier liabilities. Upload your accountant screenshot and key totals
            to track debt exposure week over week.
          </p>
        </div>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="text-xs text-muted-foreground">Total owed (latest)</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {latest ? formatCompactVnd(Number(latest.total_debt_vnd)) : "—"}
          </div>
          {latest?.report_date && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              As of {format(parseISO(latest.report_date), "EEE, MMM d, yyyy")}
            </div>
          )}
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="text-xs text-muted-foreground">Overdue exposure</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {latest?.total_overdue_vnd != null
              ? formatCompactVnd(Number(latest.total_overdue_vnd))
              : "—"}
          </div>
          {latest?.total_overdue_vnd != null && Number(latest.total_overdue_vnd) > 0 && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-warning">
              <AlertTriangle className="h-3 w-3" /> needs follow-up
            </div>
          )}
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="text-xs text-muted-foreground">Weekly change</div>
          {delta ? (
            <>
              <div
                className={
                  "mt-1 text-2xl font-bold flex items-center gap-1.5 " +
                  (delta.diff > 0 ? "text-error" : delta.diff < 0 ? "text-success" : "text-foreground")
                }
              >
                {delta.diff > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : delta.diff < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : null}
                {delta.diff > 0 ? "+" : ""}
                {formatCompactVnd(delta.diff)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                vs {format(parseISO(delta.previous.report_date), "MMM d")}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">Need 2+ weeks of data</div>
          )}
        </div>
      </div>

      {/* Entry form */}
      <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-3">
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
            <Label htmlFor="debt-file">Accountant screenshot / PDF</Label>
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

      {/* Trend chart (simple bars) */}
      <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">Last {history.length} weeks</div>
          <div className="text-xs text-muted-foreground">All figures in VND</div>
        </div>
        {history.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No snapshots yet. Log your first one above.
          </div>
        ) : (
          <TrendBars data={history} />
        )}
      </div>

      {/* History table */}
      <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold text-foreground">History</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Total owed</th>
                <th className="px-4 py-2 text-right">Overdue</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2">Attachment</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <HistoryRow key={row.id} row={row} />
              ))}
              {history.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground text-center" colSpan={5}>
                    No entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function TrendBars({ data }: { data: FinanceSupplierDebtReport[] }) {
  const ordered = [...data].reverse() // oldest -> newest
  const max = Math.max(...ordered.map((d) => Number(d.total_debt_vnd) || 0), 1)
  return (
    <div className="flex items-end gap-2 h-40">
      {ordered.map((d) => {
        const v = Number(d.total_debt_vnd) || 0
        const heightPct = Math.max(4, Math.round((v / max) * 100))
        return (
          <div key={d.id} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
            <div
              className="w-full bg-primary/30 rounded-t"
              style={{ height: `${heightPct}%` }}
              title={`${format(parseISO(d.report_date), "MMM d")} — ${formatVnd(v)}`}
            />
            <div className="text-[10px] text-muted-foreground truncate w-full text-center">
              {format(parseISO(d.report_date), "MMM d")}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HistoryRow({ row }: { row: FinanceSupplierDebtReport }) {
  const [downloading, setDownloading] = useState(false)

  const handleOpen = async () => {
    if (!row.source_file_path) return
    setDownloading(true)
    try {
      const url = await getSupplierDebtSignedUrl(row.source_file_path)
      if (url) window.open(url, "_blank", "noopener,noreferrer")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2 whitespace-nowrap">
        {format(parseISO(row.report_date), "EEE, MMM d, yyyy")}
      </td>
      <td className="px-4 py-2 text-right font-medium text-foreground">
        {formatVnd(Number(row.total_debt_vnd))}
      </td>
      <td className="px-4 py-2 text-right">
        {row.total_overdue_vnd != null ? formatVnd(Number(row.total_overdue_vnd)) : "—"}
      </td>
      <td className="px-4 py-2 text-muted-foreground">{row.notes || "—"}</td>
      <td className="px-4 py-2">
        {row.source_file_path ? (
          <Button type="button" size="sm" variant="ghost" onClick={handleOpen} disabled={downloading}>
            {downloading ? (
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

export default SupplierDebt
