import { useCallback, useMemo, useState } from "react"
import { AlertTriangle, FileText, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  formatVnd,
  formatVndDigits,
  parseNumberInput,
  supabaseErrorMessage,
} from "@/lib/finance-headroom"
import { SALARY_CATEGORIES, type ParsedSalary, type SalaryCategoryKey } from "@/lib/parse-salary"
import { useParseSalarySheet } from "@/hooks/useParseSalarySheet"
import { useUpsertSalaryMonthly, useUploadSalarySource } from "@/hooks/useSalaryMonthly"

type Step = "upload" | "parsing" | "review"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

type Amounts = Record<SalaryCategoryKey, string>

const EMPTY_AMOUNTS: Amounts = {
  fixedSalaryVnd: "",
  svcVnd: "",
  insuranceVnd: "",
  foodVnd: "",
  bonusesVnd: "",
  overtimeVnd: "",
  otherVnd: "",
}

export function SalaryImportDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (label: string) => void
}) {
  const parseSheet = useParseSalarySheet()
  const uploadSource = useUploadSalarySource()
  const upsert = useUpsertSalaryMonthly()

  const now = new Date()
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [headcount, setHeadcount] = useState("")
  const [amounts, setAmounts] = useState<Amounts>(EMPTY_AMOUNTS)
  const [insuranceBase, setInsuranceBase] = useState(0)
  const [gross, setGross] = useState(0)
  const [net, setNet] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const isImage = file?.type.startsWith("image/") ?? false

  const total = useMemo(
    () =>
      SALARY_CATEGORIES.reduce((sum, c) => sum + (parseNumberInput(amounts[c.key]) ?? 0), 0),
    [amounts],
  )

  const reset = useCallback(() => {
    setStep("upload")
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setWarnings([])
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
    setHeadcount("")
    setAmounts(EMPTY_AMOUNTS)
    setInsuranceBase(0)
    setGross(0)
    setNet(0)
    setError(null)
    parseSheet.reset()
    upsert.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl])

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleFile = (f: File | null) => {
    if (!f) return
    setFile(f)
    setError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null)
  }

  const applyParsed = (p: ParsedSalary) => {
    setYear(p.year)
    setMonth(p.month)
    setHeadcount(p.headcount != null ? String(p.headcount) : "")
    setAmounts({
      fixedSalaryVnd: p.fixedSalaryVnd ? formatVndDigits(p.fixedSalaryVnd) : "",
      svcVnd: p.svcVnd ? formatVndDigits(p.svcVnd) : "",
      insuranceVnd: p.insuranceVnd ? formatVndDigits(p.insuranceVnd) : "",
      foodVnd: p.foodVnd ? formatVndDigits(p.foodVnd) : "",
      bonusesVnd: p.bonusesVnd ? formatVndDigits(p.bonusesVnd) : "",
      overtimeVnd: p.overtimeVnd ? formatVndDigits(p.overtimeVnd) : "",
      otherVnd: p.otherVnd ? formatVndDigits(p.otherVnd) : "",
    })
    setInsuranceBase(p.insuranceBaseVnd)
    setGross(p.grossIncomeVnd)
    setNet(p.netPaidVnd)
    setWarnings(p.warnings ?? [])
  }

  const handleParse = async () => {
    if (!file) return
    setError(null)
    setStep("parsing")
    try {
      const result = await parseSheet.mutateAsync(file)
      applyParsed(result)
      setStep("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed")
      setStep("upload")
    }
  }

  const handleSave = async () => {
    setError(null)
    const nums = {
      fixedSalaryVnd: parseNumberInput(amounts.fixedSalaryVnd) ?? 0,
      svcVnd: parseNumberInput(amounts.svcVnd) ?? 0,
      insuranceVnd: parseNumberInput(amounts.insuranceVnd) ?? 0,
      foodVnd: parseNumberInput(amounts.foodVnd) ?? 0,
      bonusesVnd: parseNumberInput(amounts.bonusesVnd) ?? 0,
      overtimeVnd: parseNumberInput(amounts.overtimeVnd) ?? 0,
      otherVnd: parseNumberInput(amounts.otherVnd) ?? 0,
    }
    try {
      let uploaded: Awaited<ReturnType<typeof uploadSource.mutateAsync>> | null = null
      if (file) {
        try {
          uploaded = await uploadSource.mutateAsync({ year, month, file })
        } catch {
          uploaded = null
        }
      }
      await upsert.mutateAsync({
        year,
        month,
        ...nums,
        insuranceBaseVnd: insuranceBase,
        grossIncomeVnd: gross,
        netPaidVnd: net,
        headcount: parseNumberInput(headcount),
        notes: "Salary sheet import",
        sourceFilePath: uploaded?.path ?? null,
        sourceFileName: uploaded?.fileName ?? null,
        sourceFileMimeType: uploaded?.mimeType ?? null,
        sourceFileSizeBytes: uploaded?.sizeBytes ?? null,
      })
      onSaved?.(`${MONTHS[month - 1]} ${year}`)
      handleClose(false)
    } catch (err) {
      setError(supabaseErrorMessage(err, "Failed to save salary"))
    }
  }

  const updateAmount = (key: SalaryCategoryKey, raw: string) => {
    const n = parseNumberInput(raw)
    setAmounts((prev) => ({ ...prev, [key]: n == null ? "" : formatVndDigits(n) }))
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[min(92dvh,720px)] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import monthly salary
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload the salary sheet the accountant sends (PDF, or a screenshot). We read the totals
              for each category so you can review before saving.
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
              <span className="text-sm font-medium">Drop PDF or image, or click to browse</span>
              <input
                type="file"
                className="sr-only"
                accept=".pdf,application/pdf,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && !isImage && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{file.name}</span>
              </div>
            )}
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Salary sheet preview"
                className="max-h-48 mx-auto rounded border border-border object-contain"
              />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleParse} disabled={!file || parseSheet.isPending}>
                {parseSheet.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Read salary
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "parsing" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Reading salary sheet…</p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            {warnings.length > 0 && (
              <ul className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 space-y-1 text-xs text-warning">
                {warnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Month</Label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || year)}
                />
              </div>
              <div className="space-y-1">
                <Label>Headcount</Label>
                <Input
                  inputMode="numeric"
                  value={headcount}
                  onChange={(e) => setHeadcount(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="—"
                />
              </div>
            </div>

            <div className="grid gap-2">
              {SALARY_CATEGORIES.map((c) => (
                <div key={c.key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <Label className="flex items-center gap-2 text-sm font-normal">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: c.color }}
                    />
                    {c.label}
                  </Label>
                  <Input
                    className="h-9 w-[170px] font-mono text-right"
                    value={amounts[c.key]}
                    onChange={(e) => updateAmount(c.key, e.target.value)}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground -mt-1">
              Insurance is the employer contribution (~21.5% of the {formatVnd(insuranceBase)} base). Adjust any line if the sheet differs.
            </p>

            <div className="border-t border-border pt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Full company cost</span>
                <span className="font-mono text-base font-semibold">{formatVnd(total)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Gross earnings (sheet)</span>
                <span className="font-mono">{formatVnd(gross)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Net paid to staff (sheet)</span>
                <span className="font-mono">{formatVnd(net)}</span>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button type="button" onClick={handleSave} disabled={upsert.isPending || total <= 0}>
                {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save {MONTHS[month - 1]} {year}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
