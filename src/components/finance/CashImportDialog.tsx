import { useCallback, useMemo, useState } from "react"
import { AlertTriangle, ImageUp, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  formatIsoDateLabel,
  formatVnd,
  formatVndDigits,
  isValidIsoDate,
  parseNumberInput,
  supabaseErrorMessage,
} from "@/lib/finance-headroom"
import type { ParsedCashPosition, ParsedCashPositionDay } from "@/lib/parse-cash-position"
import {
  useBulkUpsertCashPositions,
  useUploadCashImportSource,
} from "@/hooks/useFinanceCashPosition"
import { useParseCashPositionImage } from "@/hooks/useParseCashPositionImage"

type Step = "upload" | "parsing" | "review"

type ReviewDay = ParsedCashPositionDay & {
  key: string
  selected: boolean
}

function toReviewDays(parsed: ParsedCashPosition): ReviewDay[] {
  return parsed.days.map((d) => ({
    ...d,
    key: d.reportDate,
    selected: true,
  }))
}

function amountDisplay(n: number | null): string {
  if (n == null) return ""
  return formatVndDigits(n)
}

export function CashImportDialog({
  open,
  onOpenChange,
  onApply,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Single-day only: pre-fill Friday form */
  onApply?: (parsed: ParsedCashPosition, file: File | null) => void
  onSaved?: (count: number) => void
}) {
  const parseImage = useParseCashPositionImage()
  const uploadSource = useUploadCashImportSource()
  const bulkSave = useBulkUpsertCashPositions()

  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedCashPosition | null>(null)
  const [reviewDays, setReviewDays] = useState<ReviewDay[]>([])
  const [reportDate, setReportDate] = useState("")
  const [bank, setBank] = useState("")
  const [cash, setCash] = useState("")
  const [cardPending, setCardPending] = useState("")
  const [error, setError] = useState<string | null>(null)

  const isSeries = parsed?.isDailySeries ?? false
  const selectedDays = useMemo(() => reviewDays.filter((d) => d.selected), [reviewDays])

  const reset = useCallback(() => {
    setStep("upload")
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setParsed(null)
    setReviewDays([])
    setReportDate("")
    setBank("")
    setCash("")
    setCardPending("")
    setError(null)
    parseImage.reset()
    bulkSave.reset()
  }, [previewUrl, parseImage, bulkSave])

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleFile = (f: File | null) => {
    if (!f) return
    setFile(f)
    setError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const handleParse = async () => {
    if (!file) return
    setError(null)
    setStep("parsing")
    try {
      const result = await parseImage.mutateAsync(file)
      setParsed(result)
      setReviewDays(toReviewDays(result))
      setReportDate(result.reportDate)
      setBank(amountDisplay(result.bankBalanceVnd))
      setCash(amountDisplay(result.cashBalanceVnd))
      setCardPending(amountDisplay(result.cardPendingVnd))
      setStep("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed")
      setStep("upload")
    }
  }

  const updateDay = (key: string, patch: Partial<ReviewDay>) => {
    setReviewDays((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  const buildSourceMeta = async (days: ReviewDay[]) => {
    if (!file || days.length === 0) return null
    const range =
      days.length === 1
        ? days[0].reportDate
        : `${days[0].reportDate}_to_${days[days.length - 1].reportDate}`
    try {
      return await uploadSource.mutateAsync({ reportDate: range, file })
    } catch {
      return null
    }
  }

  const handleSaveAll = async () => {
    if (!parsed) return
    const toSave: ReviewDay[] = (
      isSeries
        ? selectedDays
        : [
            {
              key: reportDate,
              selected: true,
              reportDate,
              bankBalanceVnd: parseNumberInput(bank) ?? parsed.bankBalanceVnd,
              cashBalanceVnd: parseNumberInput(cash) ?? parsed.cashBalanceVnd,
              cardPendingVnd: parseNumberInput(cardPending) ?? parsed.cardPendingVnd,
              totalVnd: null,
            },
          ]
    ).filter((d) => isValidIsoDate(d.reportDate))
    if (toSave.length === 0) {
      setError("Fix invalid dates before saving (use YYYY-MM-DD).")
      return
    }
    setError(null)
    try {
      const uploaded = await buildSourceMeta(toSave)
      const note =
        toSave.length > 1
          ? `THE ROOF daily sheet import (${toSave.length} days)`
          : "Cash position screenshot import"

      await bulkSave.mutateAsync(
        toSave.map((d) => ({
          reportDate: d.reportDate,
          bankBalanceVnd: d.bankBalanceVnd ?? 0,
          cashBalanceVnd: d.cashBalanceVnd ?? 0,
          cardPendingVnd: d.cardPendingVnd ?? 0,
          notes: note,
          sourceFilePath: uploaded?.path ?? null,
          sourceFileName: uploaded?.fileName ?? null,
          sourceFileMimeType: uploaded?.mimeType ?? null,
          sourceFileSizeBytes: uploaded?.sizeBytes ?? null,
        })),
      )
      onSaved?.(toSave.length)
      handleClose(false)
    } catch (err) {
      setError(supabaseErrorMessage(err, "Failed to save cash positions"))
    }
  }

  const handleApply = () => {
    if (!parsed || !onApply) return
    onApply(
      {
        ...parsed,
        reportDate,
        bankBalanceVnd: bank ? Number(bank.replace(/\D/g, "")) : parsed.bankBalanceVnd,
        cashBalanceVnd: cash ? Number(cash.replace(/\D/g, "")) : parsed.cashBalanceVnd,
        cardPendingVnd: cardPending
          ? Number(cardPending.replace(/\D/g, ""))
          : parsed.cardPendingVnd,
        days: parsed.days,
      },
      file,
    )
    handleClose(false)
  }

  const rangeLabel =
    selectedDays.length > 0 &&
    isValidIsoDate(selectedDays[0].reportDate) &&
    isValidIsoDate(selectedDays[selectedDays.length - 1].reportDate)
      ? `${formatIsoDateLabel(selectedDays[0].reportDate, "d MMM")} – ${formatIsoDateLabel(selectedDays[selectedDays.length - 1].reportDate, "d MMM yyyy")}`
      : selectedDays.length > 0
        ? `${selectedDays.length} days`
        : ""

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={
          isSeries
            ? "w-[calc(100vw-1rem)] max-w-[min(96vw,80rem)] sm:max-w-[min(96vw,80rem)] max-h-[min(92dvh,960px)] overflow-y-auto p-4 sm:p-6"
            : "w-[calc(100vw-1rem)] max-w-lg max-h-[min(92dvh,640px)] overflow-y-auto p-4 sm:p-6"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageUp className="h-5 w-5" />
            Import cash on hand from screenshot
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload your THE ROOF daily cash spreadsheet (dates across the top) or a single MISA
              snapshot. Multi-day sheets fill the cash-on-hand chart for every column we can read.
            </p>
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 cursor-pointer hover:bg-muted/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) handleFile(f)
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Drop image or click to browse</span>
              <input
                type="file"
                className="sr-only"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Cash position preview"
                className="max-h-48 mx-auto rounded border border-border object-contain"
              />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleParse} disabled={!file || parseImage.isPending}>
                {parseImage.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Read balances
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "parsing" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Reading balances…</p>
          </div>
        )}

        {step === "review" && parsed && isSeries && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {reviewDays.length} days detected · {rangeLabel}
              {parsed.sheetMonth != null && (
                <span className="ml-1">
                  (sheet month {parsed.sheetMonth}/{parsed.sheetYear ?? "?"})
                </span>
              )}
            </p>
            {parsed.warnings.length > 0 && (
              <ul className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 space-y-1 text-xs text-warning">
                {parsed.warnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40">
                  <tr>
                    <th className="px-2 py-2 w-8" />
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-right">Bank</th>
                    <th className="px-2 py-2 text-right">Cash</th>
                    <th className="px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewDays.map((d) => {
                    const total =
                      (d.bankBalanceVnd ?? 0) + (d.cashBalanceVnd ?? 0) || d.totalVnd || 0
                    return (
                      <tr key={d.key} className="border-t border-border">
                        <td className="px-2 py-1.5">
                          <Checkbox
                            checked={d.selected}
                            onCheckedChange={(v) => updateDay(d.key, { selected: !!v })}
                          />
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <Input
                            type="date"
                            className="h-8 w-[130px]"
                            value={d.reportDate}
                            onChange={(e) => updateDay(d.key, { reportDate: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 font-mono text-right"
                            value={amountDisplay(d.bankBalanceVnd)}
                            onChange={(e) => {
                              const n = parseNumberInput(e.target.value)
                              updateDay(d.key, { bankBalanceVnd: n })
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 font-mono text-right"
                            value={amountDisplay(d.cashBalanceVnd)}
                            onChange={(e) => {
                              const n = parseNumberInput(e.target.value)
                              updateDay(d.key, { cashBalanceVnd: n })
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                          {formatVnd(total)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                type="button"
                onClick={handleSaveAll}
                disabled={selectedDays.length === 0 || bulkSave.isPending}
              >
                {bulkSave.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save {selectedDays.length} day{selectedDays.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "review" && parsed && !isSeries && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Snapshot date: {formatIsoDateLabel(reportDate, "d MMM yyyy")}
            </p>
            {parsed.warnings.length > 0 && (
              <ul className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 space-y-1 text-xs text-warning">
                {parsed.warnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Snapshot date</Label>
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Bank balance (VND)</Label>
                <Input value={bank} onChange={(e) => setBank(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>Cash on hand (VND)</Label>
                <Input value={cash} onChange={(e) => setCash(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Card pending (VND)</Label>
                <Input
                  value={cardPending}
                  onChange={(e) => setCardPending(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              {onApply && (
                <Button type="button" variant="outline" onClick={handleApply}>
                  Apply to snapshot form
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSaveAll}
                disabled={bulkSave.isPending || !reportDate}
              >
                {bulkSave.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save snapshot
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
