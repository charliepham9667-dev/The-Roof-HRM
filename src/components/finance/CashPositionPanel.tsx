import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Download,
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
  getCashPositionSignedUrl,
  useCashPositionHistory,
  useLatestCashPosition,
  useUploadCashPositionSource,
  useUpsertCashPosition,
  type FinanceCashPosition,
} from "@/hooks/useFinanceCashPosition"

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

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd")
}

export function CashPositionPanel() {
  const { data: latest } = useLatestCashPosition()
  const { data: history = [] } = useCashPositionHistory(30)
  const upsert = useUpsertCashPosition()
  const uploadSource = useUploadCashPositionSource()

  const [formOpen, setFormOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reportDate, setReportDate] = useState<string>(todayIso())
  const [bank, setBank] = useState<string>("")
  const [cash, setCash] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const existingForDate = useMemo(
    () => history.find((h) => h.report_date === reportDate),
    [history, reportDate],
  )

  useEffect(() => {
    if (!formOpen) return
    if (existingForDate) {
      setBank(String(existingForDate.bank_balance_vnd ?? ""))
      setCash(String(existingForDate.cash_balance_vnd ?? ""))
      setNotes(existingForDate.notes ?? "")
      setFileName(existingForDate.source_file_name ?? "")
    } else {
      setBank("")
      setCash("")
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
    const diff = Number(current.total_vnd) - Number(previous.total_vnd)
    return { diff, previous }
  }, [history])

  const handleSave = async () => {
    setError(null)
    setMessage(null)
    const bankValue = parseNumberInput(bank)
    const cashValue = parseNumberInput(cash)
    if (bankValue == null && cashValue == null) {
      setError("Enter at least one of bank or cash balance.")
      return
    }
    try {
      let uploaded: Awaited<ReturnType<typeof uploadSource.mutateAsync>> | null = null
      if (file) {
        uploaded = await uploadSource.mutateAsync({ reportDate, file })
      }
      await upsert.mutateAsync({
        reportDate,
        bankBalanceVnd: bankValue ?? 0,
        cashBalanceVnd: cashValue ?? 0,
        notes: notes || null,
        sourceFilePath: uploaded?.path ?? existingForDate?.source_file_path ?? null,
        sourceFileName: uploaded?.fileName ?? existingForDate?.source_file_name ?? null,
        sourceFileMimeType: uploaded?.mimeType ?? existingForDate?.source_file_mime_type ?? null,
        sourceFileSizeBytes: uploaded?.sizeBytes ?? existingForDate?.source_file_size_bytes ?? null,
      })
      setMessage(`Saved ${format(parseISO(reportDate), "EEE, MMM d, yyyy")}.`)
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cash position")
    }
  }

  return (
    <section className="rounded-card border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Banknote className="h-4 w-4 text-muted-foreground" />
            Cashflow Snapshot
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily liquidity view from the accountant screenshot. Keep this fresh with Debt Tracker
            to understand current financial headroom.
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
                <ChevronDown className="h-3.5 w-3.5 mr-1.5" /> Log cash snapshot
              </>
            )}
          </Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 pt-3">
        <KpiTile
          label="Bank balance"
          icon={<Banknote className="h-4 w-4" />}
          value={latest ? formatCompactVnd(Number(latest.bank_balance_vnd)) : "—"}
          sub={latest?.report_date ? `As of ${format(parseISO(latest.report_date), "MMM d")}` : "No data yet"}
        />
        <KpiTile
          label="Cash on hand"
          icon={<Wallet className="h-4 w-4" />}
          value={latest ? formatCompactVnd(Number(latest.cash_balance_vnd)) : "—"}
          sub={latest?.report_date ? `As of ${format(parseISO(latest.report_date), "MMM d")}` : "No data yet"}
        />
        <KpiTile
          label="Total liquidity"
          icon={<TrendingUp className="h-4 w-4" />}
          value={latest ? formatCompactVnd(Number(latest.total_vnd)) : "—"}
          sub={
            delta ? (
              <span
                className={
                  "inline-flex items-center gap-1 " +
                  (delta.diff > 0
                    ? "text-success"
                    : delta.diff < 0
                      ? "text-error"
                      : "text-muted-foreground")
                }
              >
                {delta.diff > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : delta.diff < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                {delta.diff > 0 ? "+" : ""}
                {formatCompactVnd(delta.diff)} vs {format(parseISO(delta.previous.report_date), "MMM d")}
              </span>
            ) : (
              "Need 2+ entries"
            )
          }
        />
      </div>

      {/* Sparkline */}
      <div className="px-4">
        {history.length > 1 ? (
          <Sparkline data={history} />
        ) : (
          <div className="rounded-sm border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Log at least two snapshots to see the 30-day trend.
          </div>
        )}
      </div>

      {/* Inline form */}
      {formOpen && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border mt-3">
          <div className="text-sm font-semibold text-foreground">Log today&apos;s cashflow snapshot</div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="cash-date">Date</Label>
              <Input
                id="cash-date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cash-bank">Bank balance (VND)</Label>
              <Input
                id="cash-bank"
                inputMode="decimal"
                placeholder="0"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cash-cash">Cash on hand (VND)</Label>
              <Input
                id="cash-cash"
                inputMode="decimal"
                placeholder="0"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cash-file">Screenshot / PDF</Label>
              <Input
                id="cash-file"
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
            <Label htmlFor="cash-notes">Notes (optional)</Label>
            <Input
              id="cash-notes"
              placeholder="e.g. included MB_8333 payable, tech deposit unchanged"
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
            <DialogTitle>Cash position history</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Bank</th>
                  <th className="px-3 py-2 text-right">Cash</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">File</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <HistoryRow key={row.id} row={row} />
                ))}
                {history.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-sm text-muted-foreground text-center" colSpan={6}>
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

function Sparkline({ data }: { data: FinanceCashPosition[] }) {
  // data is newest -> oldest; flip for chronological plot
  const series = [...data].reverse()
  const totals = series.map((d) => Number(d.total_vnd) || 0)
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
        <span>30-day total liquidity</span>
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

function HistoryRow({ row }: { row: FinanceCashPosition }) {
  const [busy, setBusy] = useState(false)

  const handleOpen = async () => {
    if (!row.source_file_path) return
    setBusy(true)
    try {
      const url = await getCashPositionSignedUrl(row.source_file_path)
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
      <td className="px-3 py-2 text-right">{formatVnd(Number(row.bank_balance_vnd))}</td>
      <td className="px-3 py-2 text-right">{formatVnd(Number(row.cash_balance_vnd))}</td>
      <td className="px-3 py-2 text-right font-medium">{formatVnd(Number(row.total_vnd))}</td>
      <td className="px-3 py-2 text-muted-foreground max-w-[240px] truncate">{row.notes || "—"}</td>
      <td className="px-3 py-2">
        {row.source_file_path ? (
          <Button type="button" size="sm" variant="ghost" onClick={handleOpen} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                View
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

export default CashPositionPanel
