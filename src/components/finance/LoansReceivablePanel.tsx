import { useMemo, useState } from "react"
import { differenceInCalendarMonths, format, parseISO } from "date-fns"
import { FileText, Loader2, Pencil, Plus } from "lucide-react"
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
  FinanceKpiCard,
  FinancePill,
  formatCompactVnd,
  formatVnd,
} from "@/components/finance/finance-ui"
import {
  dueUrgency,
  formatDueRelative,
  formatIsoDateLabel,
  isValidIsoDate,
  parseNumberInput,
} from "@/lib/finance-headroom"
import {
  getLoanContractSignedUrl,
  isLoanOverdue,
  loanExpectedBack,
  useDeleteLoan,
  useLoansReceivableSummary,
  useMarkLoanRepaid,
  useReopenLoan,
  useUploadLoanContract,
  useUpsertLoan,
  type FinanceLoanReceivable,
} from "@/hooks/useFinanceLoansReceivable"

function LoanStatusBadge({ loan }: { loan: FinanceLoanReceivable }) {
  if (loan.status === "repaid") return <FinancePill tone="success">Repaid</FinancePill>
  if (isLoanOverdue(loan)) return <FinancePill tone="error">Overdue</FinancePill>
  return <FinancePill tone="warn">Outstanding</FinancePill>
}

function computeInterest(principal: number, ratePct: number, startIso: string, maturityIso: string): number {
  if (!isValidIsoDate(startIso) || !isValidIsoDate(maturityIso)) return 0
  const months = differenceInCalendarMonths(parseISO(maturityIso), parseISO(startIso))
  if (months <= 0) return 0
  return Math.round((principal * (ratePct / 100) * months) / 12)
}

export function LoansReceivablePanel() {
  const {
    loans,
    principalOut,
    expectedBack,
    expectedInterest,
    interestEarned,
    nextDue,
    overdueCount,
    isLoading,
  } = useLoansReceivableSummary()
  const upsertLoan = useUpsertLoan()
  const markRepaid = useMarkLoanRepaid()
  const reopenLoan = useReopenLoan()
  const deleteLoan = useDeleteLoan()
  const uploadContract = useUploadLoanContract()

  const [addOpen, setAddOpen] = useState(false)
  const [editLoan, setEditLoan] = useState<FinanceLoanReceivable | null>(null)
  const [borrower, setBorrower] = useState("")
  const [principal, setPrincipal] = useState("")
  const [rate, setRate] = useState("12")
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [maturityDate, setMaturityDate] = useState("")
  const [interest, setInterest] = useState("")
  const [interestTouched, setInterestTouched] = useState(false)
  const [notes, setNotes] = useState("")
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const autoInterest = useMemo(() => {
    const p = parseNumberInput(principal) ?? 0
    const r = Number(rate) || 0
    return computeInterest(p, r, startDate, maturityDate)
  }, [principal, rate, startDate, maturityDate])

  const effectiveInterest = interestTouched ? parseNumberInput(interest) ?? 0 : autoInterest

  const openAdd = (loan?: FinanceLoanReceivable) => {
    if (loan) {
      setEditLoan(loan)
      setBorrower(loan.borrower)
      setPrincipal(String(loan.principal_vnd))
      setRate(String(loan.interest_rate_pct))
      setStartDate(loan.start_date)
      setMaturityDate(loan.maturity_date)
      setInterest(String(loan.expected_interest_vnd))
      setInterestTouched(true)
    } else {
      setEditLoan(null)
      setBorrower("")
      setPrincipal("")
      setRate("12")
      setStartDate(format(new Date(), "yyyy-MM-dd"))
      setMaturityDate("")
      setInterest("")
      setInterestTouched(false)
    }
    setNotes(loan?.notes ?? "")
    setContractFile(null)
    setFormError(null)
    setAddOpen(true)
  }

  const handleSave = async () => {
    setFormError(null)
    const principalVnd = parseNumberInput(principal)
    if (!borrower.trim() || principalVnd == null) {
      setFormError("Borrower and principal are required.")
      return
    }
    if (!isValidIsoDate(startDate) || !isValidIsoDate(maturityDate)) {
      setFormError("Enter valid start and due-back dates.")
      return
    }
    try {
      let uploaded: { path: string; fileName: string } | null = null
      if (contractFile) {
        uploaded = await uploadContract.mutateAsync({ startDate, file: contractFile })
      }
      await upsertLoan.mutateAsync({
        id: editLoan?.id,
        borrower,
        principalVnd,
        interestRatePct: Number(rate) || 0,
        startDate,
        maturityDate,
        expectedInterestVnd: effectiveInterest,
        notes,
        ...(uploaded && {
          contractFilePath: uploaded.path,
          contractFileName: uploaded.fileName,
        }),
      })
      setAddOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save loan")
    }
  }

  const handleMarkRepaid = async (loan: FinanceLoanReceivable) => {
    await markRepaid.mutateAsync({ id: loan.id, repaidAmountVnd: loanExpectedBack(loan) })
  }

  const handleViewContract = async (loan: FinanceLoanReceivable) => {
    if (!loan.contract_file_path) return
    const url = await getLoanContractSignedUrl(loan.contract_file_path)
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  const nextDueFooter = nextDue
    ? `${nextDue.borrower} · ${formatCompactVnd(loanExpectedBack(nextDue))}`
    : "Nothing outstanding"

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <FinanceKpiCard
          label="Lent out"
          value={formatCompactVnd(principalOut)}
          sublabel={`${loans.filter((l) => l.status === "outstanding").length} active loans`}
          variant="active"
        />
        <FinanceKpiCard
          label="Expected back"
          sublabel="Principal + interest"
          value={formatCompactVnd(expectedBack)}
          variant="hero"
        />
        <FinanceKpiCard
          label="Interest income"
          sublabel="Agreed on open loans"
          value={formatCompactVnd(expectedInterest)}
          footer={interestEarned > 0 ? `${formatCompactVnd(interestEarned)} already earned` : undefined}
          pill={<FinancePill tone="success">+</FinancePill>}
        />
        <FinanceKpiCard
          label="Next due back"
          value={nextDue ? formatIsoDateLabel(nextDue.maturity_date, "MMM d, yyyy") : "—"}
          footer={nextDueFooter}
          pill={
            overdueCount > 0 ? (
              <FinancePill tone="error">{overdueCount} overdue</FinancePill>
            ) : undefined
          }
        />
      </div>

      <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-border sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <h3 className="text-base font-semibold text-foreground sm:text-lg">
            Loans receivable · who owes us
          </h3>
          <Button type="button" size="sm" onClick={() => openAdd()}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add loan
          </Button>
        </div>

        {/* Mobile card list */}
        <div className="space-y-2 p-3 md:hidden">
          {isLoading && (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Loading loans…
            </div>
          )}
          {!isLoading && loans.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No loans logged. Money The Roof lends out gets tracked here so it never reads as spend.
            </div>
          )}
          {loans.map((l) => {
            const urgency = dueUrgency(l.maturity_date)
            const dueClass =
              l.status === "outstanding" && (urgency === "today" || urgency === "overdue")
                ? "text-[#6C2B29] font-bold"
                : "text-muted-foreground"
            return (
              <div key={l.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium break-words">{l.borrower}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatCompactVnd(Number(l.principal_vnd))} at {Number(l.interest_rate_pct)}%/yr ·
                      back {formatCompactVnd(loanExpectedBack(l))}
                    </div>
                    <div className={`mt-0.5 text-xs ${dueClass}`}>
                      {l.status === "repaid"
                        ? `Repaid ${l.repaid_at ? formatIsoDateLabel(l.repaid_at, "MMM d") : ""}`
                        : `Due ${formatDueRelative(l.maturity_date)}`}
                    </div>
                  </div>
                  <LoanStatusBadge loan={l} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {l.status === "outstanding" && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleMarkRepaid(l)}
                      disabled={markRepaid.isPending}
                    >
                      Repaid
                    </Button>
                  )}
                  {l.contract_file_path && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleViewContract(l)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Contract
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => openAdd(l)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Borrower</th>
                <th className="px-3 py-2 text-right">Principal</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2">Term</th>
                <th className="px-3 py-2">Due back</th>
                <th className="px-3 py-2 text-right">Expected back</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading loans…
                  </td>
                </tr>
              )}
              {!isLoading && loans.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    No loans logged. Money The Roof lends out gets tracked here so it never reads as spend.
                  </td>
                </tr>
              )}
              {loans.map((l) => {
                const urgency = dueUrgency(l.maturity_date)
                const dueClass =
                  l.status === "outstanding" && (urgency === "today" || urgency === "overdue")
                    ? "text-[#6C2B29] font-bold"
                    : l.status === "outstanding" && urgency === "soon"
                      ? "text-warning font-semibold"
                      : "text-muted-foreground"
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">
                      {l.borrower}
                      {l.notes && (
                        <p className="mt-0.5 max-w-[260px] text-[11px] font-normal text-muted-foreground line-clamp-1">
                          {l.notes}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold tabular-nums">
                      {formatCompactVnd(Number(l.principal_vnd))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-xs text-muted-foreground">
                      {Number(l.interest_rate_pct)}%/yr
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {formatIsoDateLabel(l.start_date, "MMM d")} →{" "}
                      {formatIsoDateLabel(l.maturity_date, "MMM d, yyyy")}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-3 text-xs ${dueClass}`}>
                      {l.status === "repaid"
                        ? l.repaid_at
                          ? `Repaid ${formatIsoDateLabel(l.repaid_at, "MMM d")}`
                          : "Repaid"
                        : formatDueRelative(l.maturity_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">
                      {formatVnd(loanExpectedBack(l))}
                    </td>
                    <td className="px-3 py-3">
                      <LoanStatusBadge loan={l} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {l.status === "outstanding" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleMarkRepaid(l)}
                            disabled={markRepaid.isPending}
                          >
                            Repaid
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => reopenLoan.mutateAsync(l.id)}
                            disabled={reopenLoan.isPending}
                          >
                            Reopen
                          </Button>
                        )}
                        {l.contract_file_path && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleViewContract(l)}
                            title={l.contract_file_name ?? "View contract"}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => openAdd(l)}
                          title="Edit or delete"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editLoan ? "Edit loan" : "Add loan"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Borrower</Label>
              <Input
                value={borrower}
                onChange={(e) => setBorrower(e.target.value)}
                placeholder="e.g. East West Mui Ne"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Principal (VND)</Label>
                <Input value={principal} onChange={(e) => setPrincipal(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Interest rate (%/year)</Label>
                <Input value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Loan date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Due back</Label>
                <Input
                  type="date"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Interest (VND)</Label>
              <Input
                value={interestTouched ? interest : autoInterest ? String(autoInterest) : ""}
                onChange={(e) => {
                  setInterest(e.target.value)
                  setInterestTouched(true)
                }}
                placeholder="Auto from rate × term"
              />
              <p className="text-[11px] text-muted-foreground">
                Total due back: {formatVnd((parseNumberInput(principal) ?? 0) + effectiveInterest)}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Contract (PDF / image, optional)</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
              />
              {editLoan?.contract_file_name && !contractFile && (
                <p className="text-[11px] text-muted-foreground">
                  Attached: {editLoan.contract_file_name}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            {editLoan && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  deleteLoan.mutate(editLoan.id)
                  setAddOpen(false)
                }}
              >
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={upsertLoan.isPending || uploadContract.isPending}>
              {(upsertLoan.isPending || uploadContract.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default LoansReceivablePanel
