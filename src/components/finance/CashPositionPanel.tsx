import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  ChevronDown,
  ChevronUp,
  Download,
  History as HistoryIcon,
  ImageUp,
  Loader2,
  Save,
  Upload,
} from "lucide-react"
import { CashImportDialog } from "@/components/finance/CashImportDialog"
import type { ParsedCashPosition } from "@/lib/parse-cash-position"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CashFlowChart } from "@/components/finance/CashFlowChart"
import {
  FinanceKpiCard,
  FinancePill,
  MiniSparkline,
  formatCompactVnd,
  formatVnd,
} from "@/components/finance/finance-ui"
import { FINANCE_FLOW_COLORS } from "@/lib/chart-colors"
import { mostRecentFridayIso, parseNumberInput } from "@/lib/finance-headroom"
import { useFinancialHeadroom } from "@/hooks/useFinancialHeadroom"
import {
  getCashPositionSignedUrl,
  useCashPositionHistory,
  useLatestCashPosition,
  useUploadCashPositionSource,
  useUpsertCashPosition,
  type FinanceCashPosition,
} from "@/hooks/useFinanceCashPosition"

export function CashPositionPanel() {
  const { data: latest } = useLatestCashPosition()
  const { data: history = [] } = useCashPositionHistory(30)
  const { cashFlow } = useFinancialHeadroom()
  const upsert = useUpsertCashPosition()
  const uploadSource = useUploadCashPositionSource()

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reportDate, setReportDate] = useState<string>(mostRecentFridayIso())
  const [bank, setBank] = useState<string>("")
  const [cash, setCash] = useState<string>("")
  const [cardPending, setCardPending] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const existingForDate = useMemo(
    () => history.find((h) => h.report_date === reportDate),
    [history, reportDate],
  )

  const cashOnHandTracked = useMemo(() => {
    if (!latest) return false
    return history.some((h) => Number(h.cash_balance_vnd) > 0)
  }, [history, latest])

  useEffect(() => {
    if (!formOpen) return
    if (existingForDate) {
      setBank(String(existingForDate.bank_balance_vnd ?? ""))
      setCash(String(existingForDate.cash_balance_vnd ?? ""))
      setCardPending(String(existingForDate.card_pending_vnd ?? ""))
      setNotes(existingForDate.notes ?? "")
      setFileName(existingForDate.source_file_name ?? "")
    } else {
      setBank("")
      setCash("")
      setCardPending("")
      setNotes("")
      setFileName("")
    }
    setFile(null)
    setMessage(null)
    setError(null)
  }, [existingForDate, reportDate, formOpen])

  const handleImportApply = (parsed: ParsedCashPosition, importFile: File | null) => {
    setReportDate(parsed.reportDate)
    setBank(parsed.bankBalanceVnd != null ? String(parsed.bankBalanceVnd) : "")
    setCash(parsed.cashBalanceVnd != null ? String(parsed.cashBalanceVnd) : "")
    setCardPending(parsed.cardPendingVnd != null ? String(parsed.cardPendingVnd) : "")
    if (importFile) {
      setFile(importFile)
      setFileName(importFile.name)
    }
    setFormOpen(true)
    setMessage("Imported from screenshot — review and save.")
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    setMessage(null)
    const bankValue = parseNumberInput(bank)
    const cashValue = parseNumberInput(cash)
    const cardValue = parseNumberInput(cardPending)
    if (bankValue == null && cashValue == null && cardValue == null) {
      setError("Enter at least one balance field.")
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
        cardPendingVnd: cardValue ?? 0,
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

  const { weekSummary, liquidityDeltaWeek } = cashFlow
  const inSpark = weekSummary.last7.map((d) => d.inflow)
  const liquiditySpark = weekSummary.last7.map((d) => d.liquidity)
  const outSpark = weekSummary.last7.map((d) => d.outflow)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FinanceKpiCard
          label="Cash In · week"
          value={`+${formatCompactVnd(weekSummary.inTotal)}`}
          variant="success"
          pill={<FinancePill tone="success">↑ Sales26</FinancePill>}
          footer={
            <div className="space-y-1">
              <span>Last 7 days · daily revenue (sync)</span>
              <MiniSparkline data={inSpark} color={FINANCE_FLOW_COLORS.inflow} />
            </div>
          }
        />
        <FinanceKpiCard
          label="Cash Out · week"
          value={`−${formatCompactVnd(weekSummary.outTotal)}`}
          footer={
            <div className="space-y-1">
              <span className="text-[#6C2B29]">Paid supplier debt (Debt Tracker)</span>
              <MiniSparkline data={outSpark} color={FINANCE_FLOW_COLORS.outflow} />
            </div>
          }
        />
        <FinanceKpiCard
          label="Change · week"
          value={
            liquidityDeltaWeek != null
              ? `${liquidityDeltaWeek >= 0 ? "+" : "−"}${formatCompactVnd(Math.abs(liquidityDeltaWeek))}`
              : "—"
          }
          variant="success"
          pill={
            <FinancePill tone={(liquidityDeltaWeek ?? 0) >= 0 ? "success" : "burg"}>
              {(liquidityDeltaWeek ?? 0) >= 0 ? "Up" : "Down"}
            </FinancePill>
          }
          footer={
            <div className="space-y-1">
              <span>Total liquidity vs start of week</span>
              <MiniSparkline data={liquiditySpark} color={FINANCE_FLOW_COLORS.cashOnHand} />
            </div>
          }
        />
      </div>

      <CashFlowChart
        series={cashFlow.series}
        events={cashFlow.events}
        rangeLabel={cashFlow.rangeLabel}
        isLoading={cashFlow.isLoading}
        hasLiquidityData={cashFlow.hasLiquidityData}
        hasPaidDebtData={cashFlow.hasPaidDebtData}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SplitTile
          label="Bank balance"
          value={latest ? formatCompactVnd(Number(latest.bank_balance_vnd)) : "—"}
          sub="BIDV main · MB business"
          pill={<FinancePill tone="info">main</FinancePill>}
        />
        <SplitTile
          label="Cash on hand"
          value={
            latest && (Number(latest.cash_balance_vnd) > 0 || cashOnHandTracked)
              ? formatCompactVnd(Number(latest.cash_balance_vnd))
              : "Not tracked"
          }
          sub="Till + safe · settled Tue/Fri"
          pill={<FinancePill tone="neutral">till</FinancePill>}
          muted={!cashOnHandTracked && Number(latest?.cash_balance_vnd ?? 0) === 0}
        />
        <SplitTile
          label="Card pending"
          value={
            latest && Number(latest.card_pending_vnd) > 0
              ? formatCompactVnd(Number(latest.card_pending_vnd))
              : latest
                ? formatCompactVnd(Number(latest.card_pending_vnd))
                : "—"
          }
          sub="POS settling +2 days"
          pill={<FinancePill tone="warn">+2d</FinancePill>}
        />
      </div>

      <div className="rounded-card border border-[#6C2B29]/15 bg-[#FAF4EF] p-3 sm:p-4">
        <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground">Log this Friday&apos;s snapshot</span>
            {existingForDate && <FinancePill tone="info">Already saved</FinancePill>}
          </div>
          <div className="flex flex-wrap gap-1.5 sm:ml-auto sm:gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <ImageUp className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Import from screenshot</span>
            </Button>
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
                  <ChevronDown className="h-3.5 w-3.5 mr-1.5" /> Log snapshot
                </>
              )}
            </Button>
          </div>
        </div>

        {formOpen && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-1">
                <Label htmlFor="cash-date">Date (Friday)</Label>
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
                <Label htmlFor="cash-card">Card pending (VND)</Label>
                <Input
                  id="cash-card"
                  inputMode="decimal"
                  placeholder="0"
                  value={cardPending}
                  onChange={(e) => setCardPending(e.target.value)}
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
              <Button
                type="button"
                onClick={handleSave}
                disabled={upsert.isPending || uploadSource.isPending}
              >
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
            </div>
            {message && <p className="text-xs text-success">{message}</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[min(96vw,72rem)] sm:max-w-[min(96vw,72rem)]">
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
                  <th className="px-3 py-2 text-right">Card pending</th>
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
                    <td className="px-3 py-6 text-sm text-muted-foreground text-center" colSpan={7}>
                      No entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <CashImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onApply={handleImportApply}
        onSaved={(count) =>
          setMessage(`Saved ${count} day${count === 1 ? "" : "s"} of cash on hand — chart updated.`)
        }
      />

    </div>
  )
}

function SplitTile({
  label,
  value,
  sub,
  pill,
  muted,
}: {
  label: string
  value: string
  sub: string
  pill: React.ReactNode
  muted?: boolean
}) {
  return (
    <div className="rounded-card border border-border bg-card p-3 shadow-card">
      <div className="flex justify-between items-start">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {pill}
      </div>
      <div
        className={`mt-1 text-xl font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {value}
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
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
      <td className="px-3 py-2 text-right">{formatVnd(Number(row.card_pending_vnd ?? 0))}</td>
      <td className="px-3 py-2 text-right font-medium">{formatVnd(Number(row.total_vnd))}</td>
      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{row.notes || "—"}</td>
      <td className="px-3 py-2">
        {row.source_file_path ? (
          <Button type="button" size="sm" variant="ghost" onClick={handleOpen} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

export default CashPositionPanel
