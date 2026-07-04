import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type LoanStatus = "outstanding" | "repaid"

export type FinanceLoanReceivable = {
  id: string
  borrower: string
  principal_vnd: number
  interest_rate_pct: number
  start_date: string
  maturity_date: string
  expected_interest_vnd: number
  status: LoanStatus
  repaid_at: string | null
  repaid_amount_vnd: number | null
  notes: string | null
  contract_file_path: string | null
  contract_file_name: string | null
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  "id,borrower,principal_vnd,interest_rate_pct,start_date,maturity_date,expected_interest_vnd,status,repaid_at,repaid_amount_vnd,notes,contract_file_path,contract_file_name,created_at,updated_at"

const SOURCE_BUCKET = "finance-attachments"
const LOAN_CONTRACT_PREFIX = "loan-contracts"

/** Principal + agreed interest — what the borrower owes us at maturity. */
export function loanExpectedBack(loan: Pick<FinanceLoanReceivable, "principal_vnd" | "expected_interest_vnd">): number {
  return Number(loan.principal_vnd) + Number(loan.expected_interest_vnd)
}

export function isLoanOverdue(
  loan: Pick<FinanceLoanReceivable, "status" | "maturity_date">,
  today = startOfDay(new Date()),
): boolean {
  if (loan.status !== "outstanding") return false
  return differenceInCalendarDays(startOfDay(parseISO(loan.maturity_date)), today) < 0
}

export function useLoansReceivable() {
  return useQuery({
    queryKey: ["finance-loans-receivable"],
    queryFn: async (): Promise<FinanceLoanReceivable[]> => {
      const { data, error } = await supabase
        .from("finance_loans_receivable")
        .select(SELECT_COLS)
        .order("maturity_date", { ascending: true })
      if (error) throw error
      return (data as FinanceLoanReceivable[]) || []
    },
  })
}

export function useLoansReceivableSummary() {
  const { data: loans = [], ...rest } = useLoansReceivable()
  const outstanding = loans.filter((l) => l.status === "outstanding")
  const principalOut = outstanding.reduce((s, l) => s + Number(l.principal_vnd), 0)
  const expectedBack = outstanding.reduce((s, l) => s + loanExpectedBack(l), 0)
  const expectedInterest = outstanding.reduce((s, l) => s + Number(l.expected_interest_vnd), 0)
  const interestEarned = loans
    .filter((l) => l.status === "repaid")
    .reduce((s, l) => s + Math.max(0, Number(l.repaid_amount_vnd ?? 0) - Number(l.principal_vnd)), 0)
  const nextDue = outstanding[0] ?? null
  const overdueCount = outstanding.filter((l) => isLoanOverdue(l)).length
  return {
    ...rest,
    loans,
    outstanding,
    principalOut,
    expectedBack,
    expectedInterest,
    interestEarned,
    nextDue,
    overdueCount,
  }
}

export function useUpsertLoan() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      id?: string
      borrower: string
      principalVnd: number
      interestRatePct: number
      startDate: string
      maturityDate: string
      expectedInterestVnd: number
      notes?: string | null
      contractFilePath?: string | null
      contractFileName?: string | null
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const row = {
        borrower: input.borrower.trim(),
        principal_vnd: input.principalVnd,
        interest_rate_pct: input.interestRatePct,
        start_date: input.startDate,
        maturity_date: input.maturityDate,
        expected_interest_vnd: input.expectedInterestVnd,
        notes: input.notes?.trim() || null,
        ...(input.contractFilePath !== undefined && {
          contract_file_path: input.contractFilePath,
          contract_file_name: input.contractFileName ?? null,
        }),
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      }

      if (input.id) {
        const { data, error } = await supabase
          .from("finance_loans_receivable")
          .update(row)
          .eq("id", input.id)
          .select(SELECT_COLS)
          .single()
        if (error) throw error
        return data as FinanceLoanReceivable
      }

      const { data, error } = await supabase
        .from("finance_loans_receivable")
        .insert({ ...row, created_by: profile.id })
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as FinanceLoanReceivable
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-loans-receivable"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
    },
  })
}

export function useMarkLoanRepaid() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: { id: string; repaidAmountVnd: number; repaidAt?: string }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("finance_loans_receivable")
        .update({
          status: "repaid",
          repaid_at: input.repaidAt ?? new Date().toISOString().slice(0, 10),
          repaid_amount_vnd: input.repaidAmountVnd,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id)
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as FinanceLoanReceivable
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-loans-receivable"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
    },
  })
}

export function useReopenLoan() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("finance_loans_receivable")
        .update({
          status: "outstanding",
          repaid_at: null,
          repaid_amount_vnd: null,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as FinanceLoanReceivable
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-loans-receivable"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
    },
  })
}

export function useDeleteLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_loans_receivable").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-loans-receivable"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
    },
  })
}

export function useUploadLoanContract() {
  return useMutation({
    mutationFn: async (input: { startDate: string; file: File }) => {
      const safeName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const path = `${LOAN_CONTRACT_PREFIX}/${input.startDate}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from(SOURCE_BUCKET).upload(path, input.file, {
        upsert: false,
        contentType: input.file.type || undefined,
      })
      if (error) throw error
      return { path, fileName: input.file.name }
    },
  })
}

export async function getLoanContractSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(SOURCE_BUCKET)
    .createSignedUrl(path, 60 * 30)
  if (error) return null
  return data?.signedUrl ?? null
}
