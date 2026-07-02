import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FinancePill, formatVnd } from "@/components/finance/finance-ui"
import { useLogPaymentListImport } from "@/hooks/useFinanceSupplierDebt"
import {
  useBulkImportDebtItems,
  useUploadDebtImportSource,
  type PaymentChannel,
} from "@/hooks/useFinanceSupplierDebtItems"
import type { DebtItemStatus } from "@/lib/finance-headroom"
import { useParsePaymentListImage } from "@/hooks/useParsePaymentListImage"
import {
  composeDebtNotes,
  inferCategoryFromRemarks,
  remarksPaymentHint,
  type ParsedPaymentList,
} from "@/lib/parse-payment-list"
import {
  categoryLabel,
  formatVndDigits,
  parseNumberInput,
  supabaseErrorMessage,
  type DebtCategory,
} from "@/lib/finance-headroom"

const CATEGORY_OPTIONS: DebtCategory[] = ["inventory", "rent", "capex", "utilities", "other"]

type ReviewRow = {
  key: string
  selected: boolean
  vendor: string
  vendorCode: string
  amountVnd: number
  category: DebtCategory
  dueDate: string
  status: DebtItemStatus
  paidDate: string
  channel: PaymentChannel
  remarks: string
  bankName: string
  bankAccount: string
}

type Step = "upload" | "parsing" | "review"

function parsedToReviewRows(parsed: ParsedPaymentList): ReviewRow[] {
  return parsed.rows.map((r, i) => ({
    key: `${i}-${r.vendor}`,
    selected: true,
    vendor: r.vendor,
    vendorCode: r.vendorCode ?? "",
    amountVnd: r.amountVnd,
    category: r.category,
    // Tracker sheets carry a per-row Submitted Date; older list sheets only have the title date
    dueDate: r.submittedDate ?? parsed.listDate,
    status: r.status ?? "pending",
    paidDate: r.paidDate ?? "",
    channel: parsed.paymentChannel,
    remarks: r.remarks ?? "",
    bankName: r.bankName ?? "",
    bankAccount: r.bankAccount ?? "",
  }))
}

function ImportAmountInput({
  value,
  onChange,
}: {
  value: number
  onChange: (amountVnd: number) => void
}) {
  const [text, setText] = useState(() => formatVndDigits(value))

  useEffect(() => {
    setText(formatVndDigits(value))
  }, [value])

  return (
    <Input
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseNumberInput(e.target.value)
        if (n != null) onChange(n)
      }}
      onBlur={() => setText(formatVndDigits(value))}
      inputMode="numeric"
      className="h-8 text-xs text-right font-mono w-full tabular-nums"
    />
  )
}

export function DebtImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const parseImage = useParsePaymentListImage()
  const uploadSource = useUploadDebtImportSource()
  const bulkImport = useBulkImportDebtItems()
  const logPaymentList = useLogPaymentListImport()

  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedPaymentList | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [importStatus, setImportStatus] = useState<DebtItemStatus>("pending")
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep("upload")
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setParsed(null)
    setRows([])
    setReplaceExisting(false)
    setImportStatus("pending")
    setError(null)
    parseImage.reset()
    bulkImport.reset()
  }, [previewUrl, parseImage, bulkImport])

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
      setRows(parsedToReviewRows(result))
      setStep("review")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Parse failed"
      setError(msg)
      setStep("upload")
    }
  }

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows])
  const selectedSum = useMemo(
    () => selectedRows.reduce((s, r) => s + r.amountVnd, 0),
    [selectedRows],
  )

  const totalMatches = useMemo(() => {
    if (!parsed?.totalPaymentVnd) return null
    const diff = Math.abs(selectedSum - parsed.totalPaymentVnd)
    return diff <= Math.max(1000, parsed.totalPaymentVnd * 0.01)
  }, [parsed, selectedSum])

  const updateRow = (key: string, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const handleImport = async () => {
    if (!file || !parsed || selectedRows.length === 0) return
    setError(null)
    try {
      let sourceImportPath: string | null = null
      try {
        const uploaded = await uploadSource.mutateAsync({
          listDate: parsed.listDate,
          file,
        })
        sourceImportPath = uploaded.path
      } catch (uploadErr) {
        console.warn("[DebtImport] screenshot upload failed:", uploadErr)
        setError(
          `${supabaseErrorMessage(uploadErr, "Screenshot upload failed")} — importing lines without attachment.`,
        )
      }

      const weekly = await logPaymentList.mutateAsync({
        listDate: parsed.listDate,
        paymentChannel: parsed.paymentChannel,
        totalVnd: selectedSum,
        lineCount: selectedRows.length,
        footerTotalVnd: parsed.totalPaymentVnd,
        sourceFilePath: sourceImportPath,
        sourceFileName: file.name,
        sourceFileMimeType: file.type || null,
        sourceFileSizeBytes: file.size,
      })

      await bulkImport.mutateAsync({
        rows: selectedRows.map((r) => ({
          vendor: r.vendor,
          vendorCode: r.vendorCode || null,
          category: r.category,
          amountVnd: r.amountVnd,
          dueDate: r.dueDate,
          paymentChannel: r.channel,
          notes: composeDebtNotes({
            remarks: r.remarks,
            bankName: r.bankName,
            bankAccount: r.bankAccount,
          }),
          sourceImportPath,
          status: r.status,
          paidDate: r.status === "paid" ? r.paidDate || null : null,
        })),
        replaceForDateChannel: replaceExisting
          ? { dueDate: parsed.listDate, channel: parsed.paymentChannel }
          : undefined,
        weeklyReportId: weekly.id,
      })
      handleClose(false)
    } catch (err) {
      setError(supabaseErrorMessage(err, "Import failed"))
    }
  }

  const channelLabel = parsed?.paymentChannel === "cash" ? "Cash" : "Bank"
  const listDateLabel = parsed?.listDate
    ? format(parseISO(parsed.listDate), "d MMM yyyy")
    : ""

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[min(96vw,80rem)] sm:max-w-[min(96vw,80rem)] max-h-[min(92dvh,960px)] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageUp className="h-5 w-5" />
            Import from screenshot
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload your accountant&apos;s <strong>LIST OF PAYMENT REQUIRED</strong> sheet (BANK
              or CASH). We&apos;ll read each line and add them to the debt ledger for review before
              saving.
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
              <span className="text-xs text-muted-foreground">PNG, JPG, WEBP</span>
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
                alt="Payment list preview"
                className="max-h-48 mx-auto rounded border border-border object-contain"
              />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleParse} disabled={!file || parseImage.isPending}>
                {parseImage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Read payment list
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "parsing" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Reading payment list…</p>
            <p className="text-xs text-muted-foreground">This may take 15–30 seconds</p>
          </div>
        )}

        {step === "review" && parsed && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <FinancePill tone="brand">{channelLabel}</FinancePill>
              <span className="text-sm text-muted-foreground">Due {listDateLabel}</span>
            </div>
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

            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full min-w-[1300px] text-sm table-fixed">
                <thead className="bg-[#FAF4EF]">
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-[#6C2B29] font-bold">
                    <th className="px-2 py-2 w-10" />
                    <th className="px-2 py-2 w-[14%]">Vendor</th>
                    <th className="px-2 py-2 w-[6%]">Code</th>
                    <th className="px-2 py-2 w-[10%] text-right">Amount</th>
                    <th className="px-2 py-2 w-[9%]">Category</th>
                    <th className="px-2 py-2 w-[9%]">Submitted</th>
                    <th className="px-2 py-2 w-[9%]">Status</th>
                    <th className="px-2 py-2 w-[9%]">Paid date</th>
                    <th className="px-2 py-2 w-[22%]">Remarks</th>
                    <th className="px-2 py-2 w-[12%]">Bank</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-t border-border align-top">
                      <td className="px-2 py-2">
                        <Checkbox
                          checked={r.selected}
                          onCheckedChange={(v) => updateRow(r.key, { selected: v === true })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={r.vendor}
                          onChange={(e) => updateRow(r.key, { vendor: e.target.value })}
                          className="h-8 text-xs w-full"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={r.vendorCode}
                          onChange={(e) => updateRow(r.key, { vendorCode: e.target.value })}
                          className="h-8 text-xs font-mono w-full"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <ImportAmountInput
                          value={r.amountVnd}
                          onChange={(amountVnd) => updateRow(r.key, { amountVnd })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Select
                          value={r.category}
                          onValueChange={(v) => updateRow(r.key, { category: v as DebtCategory })}
                        >
                          <SelectTrigger className="h-8 text-xs w-full">
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
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="date"
                          value={r.dueDate}
                          onChange={(e) => updateRow(r.key, { dueDate: e.target.value })}
                          className="h-8 text-xs w-full"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Select
                          value={r.status}
                          onValueChange={(v) => updateRow(r.key, { status: v as DebtItemStatus })}
                        >
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="stopped">Stopped</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="date"
                          value={r.paidDate}
                          onChange={(e) => updateRow(r.key, { paidDate: e.target.value })}
                          disabled={r.status !== "paid"}
                          className="h-8 text-xs w-full"
                        />
                        {r.status === "paid" && !r.paidDate && (
                          <p className="text-[10px] text-warning mt-1 leading-snug">
                            No paid date — will use submitted date
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <textarea
                          value={r.remarks}
                          onChange={(e) => {
                            const remarks = e.target.value
                            updateRow(r.key, {
                              remarks,
                              category: inferCategoryFromRemarks(remarks),
                            })
                          }}
                          rows={2}
                          placeholder="From sheet Remarks column — e.g. thanh toan tien Beer East West"
                          className="flex w-full min-h-[52px] rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        {remarksPaymentHint(r.remarks) && (
                          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                            {remarksPaymentHint(r.remarks)}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={r.bankName}
                          onChange={(e) => updateRow(r.key, { bankName: e.target.value })}
                          placeholder="Bank name"
                          className="h-8 text-xs w-full mb-1"
                        />
                        <Input
                          value={r.bankAccount}
                          onChange={(e) => updateRow(r.key, { bankAccount: e.target.value })}
                          placeholder="Account"
                          className="h-8 text-xs w-full font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className={`rounded-lg border p-3 text-sm ${
                totalMatches === false
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-success/40 bg-success/5"
              }`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <span>
                  Selected: <strong>{selectedRows.length}</strong> lines ·{" "}
                  <strong>{formatVnd(selectedSum)}</strong>
                </span>
                {parsed.totalPaymentVnd != null && (
                  <span>
                    Sheet total: <strong>{formatVnd(parsed.totalPaymentVnd)}</strong>
                    {totalMatches === true && (
                      <span className="text-success ml-2">✓ matches</span>
                    )}
                    {totalMatches === false && (
                      <span className="text-destructive ml-2">≠ mismatch</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Set status for all rows (per-row Status above wins on import)
                </Label>
                <Select
                  value={importStatus}
                  onValueChange={(v) => {
                    const status = v as DebtItemStatus
                    setImportStatus(status)
                    setRows((prev) => prev.map((r) => ({ ...r, status })))
                  }}
                >
                  <SelectTrigger className="h-9 w-[240px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending — still owed</SelectItem>
                    <SelectItem value="stopped">Stopped — on hold</SelectItem>
                    <SelectItem value="paid">Paid — already transferred</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="replace-existing"
                checked={replaceExisting}
                onCheckedChange={(v) => setReplaceExisting(v === true)}
              />
              <Label htmlFor="replace-existing" className="text-sm font-normal leading-snug">
                Replace existing open items for this list date &amp; channel (
                {listDateLabel} · {channelLabel})
              </Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("upload")
                  setParsed(null)
                  setRows([])
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={
                  selectedRows.length === 0 ||
                  bulkImport.isPending ||
                  logPaymentList.isPending ||
                  uploadSource.isPending
                }
              >
                {(bulkImport.isPending || logPaymentList.isPending || uploadSource.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                Import {selectedRows.length} line{selectedRows.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
