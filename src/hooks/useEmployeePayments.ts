import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"

export type EmployeeBankingDetails = {
  employee_id: string
  bank_name: string | null
  account_name: string | null
  account_number: string | null
  bsb_swift: string | null
  updated_at: string
}

export type EmployeePayDetail = {
  id: string
  employee_id: string
  pay_type: "hourly" | "salary"
  rate_value: number
  currency: string
  effective_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type EmployeeBenefit = {
  id: string
  employee_id: string
  benefit_type: string
  amount: number | null
  notes: string | null
  created_at: string
}

export function useEmployeeBanking(userId: string | undefined) {
  return useQuery({
    queryKey: ["employee-banking", userId],
    queryFn: async (): Promise<EmployeeBankingDetails | null> => {
      if (!userId) throw new Error("Missing userId")
      const { data, error } = await supabase
        .from("employee_banking_details")
        .select("employee_id, bank_name, account_name, account_number, bsb_swift, updated_at")
        .eq("employee_id", userId)
        .maybeSingle()

      if (error) throw error
      return data as EmployeeBankingDetails | null
    },
    enabled: !!userId,
  })
}

export function useUpsertEmployeeBanking(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: {
      bank_name?: string
      account_name?: string
      account_number?: string
      bsb_swift?: string
    }) => {
      const payload = {
        employee_id: userId,
        bank_name: patch.bank_name ?? null,
        account_name: patch.account_name ?? null,
        account_number: patch.account_number ?? null,
        bsb_swift: patch.bsb_swift ?? null,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from("employee_banking_details")
        .upsert(payload, { onConflict: "employee_id" })
        .select("employee_id, bank_name, account_name, account_number, bsb_swift, updated_at")
        .single()

      if (error) throw error
      return data as EmployeeBankingDetails
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-banking", userId] })
    },
  })
}

export function useEmployeePayDetails(userId: string | undefined) {
  return useQuery({
    queryKey: ["employee-pay-details", userId],
    queryFn: async (): Promise<EmployeePayDetail[]> => {
      if (!userId) throw new Error("Missing userId")
      const { data, error } = await supabase
        .from("employee_pay_details")
        .select("id, employee_id, pay_type, rate_value, currency, effective_date, notes, created_at, updated_at")
        .eq("employee_id", userId)
        .order("effective_date", { ascending: false })

      if (error) throw error
      return (data || []).map((r: any) => ({
        ...r,
        rate_value: Number(r.rate_value),
      })) as EmployeePayDetail[]
    },
    enabled: !!userId,
  })
}

export function useAddEmployeePayDetail(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      pay_type: "hourly" | "salary"
      rate_value: number
      currency?: string
      effective_date: string
      notes?: string
    }) => {
      const { data, error } = await supabase
        .from("employee_pay_details")
        .insert({
          employee_id: userId,
          pay_type: input.pay_type,
          rate_value: input.rate_value,
          currency: input.currency ?? "VND",
          effective_date: input.effective_date,
          notes: input.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .select("id, employee_id, pay_type, rate_value, currency, effective_date, notes, created_at, updated_at")
        .single()

      if (error) throw error
      return { ...data, rate_value: Number(data.rate_value) } as EmployeePayDetail
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-pay-details", userId] })
    },
  })
}

export function useUpdateEmployeePayDetail(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      pay_type?: "hourly" | "salary"
      rate_value?: number
      currency?: string
      effective_date?: string
      notes?: string | null
    }) => {
      const { id, ...patch } = input
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.pay_type != null) payload.pay_type = patch.pay_type
      if (patch.rate_value != null) payload.rate_value = patch.rate_value
      if (patch.currency != null) payload.currency = patch.currency
      if (patch.effective_date != null) payload.effective_date = patch.effective_date
      if (patch.notes !== undefined) payload.notes = patch.notes ?? null

      const { data, error } = await supabase
        .from("employee_pay_details")
        .update(payload)
        .eq("id", id)
        .eq("employee_id", userId)
        .select("id, employee_id, pay_type, rate_value, currency, effective_date, notes, created_at, updated_at")
        .single()

      if (error) throw error
      return { ...data, rate_value: Number(data.rate_value) } as EmployeePayDetail
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-pay-details", userId] })
    },
  })
}

export function useDeleteEmployeePayDetail(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_pay_details")
        .delete()
        .eq("id", id)
        .eq("employee_id", userId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-pay-details", userId] })
    },
  })
}

export function useEmployeeBenefits(userId: string | undefined) {
  return useQuery({
    queryKey: ["employee-benefits", userId],
    queryFn: async (): Promise<EmployeeBenefit[]> => {
      if (!userId) throw new Error("Missing userId")
      const { data, error } = await supabase
        .from("employee_benefits")
        .select("id, employee_id, benefit_type, amount, notes, created_at")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return (data || []).map((r: any) => ({
        ...r,
        amount: r.amount != null ? Number(r.amount) : null,
      })) as EmployeeBenefit[]
    },
    enabled: !!userId,
  })
}

export function useAddEmployeeBenefit(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { benefit_type: string; amount?: number | null; notes?: string | null }) => {
      const { data, error } = await supabase
        .from("employee_benefits")
        .insert({
          employee_id: userId,
          benefit_type: input.benefit_type,
          amount: input.amount ?? null,
          notes: input.notes ?? null,
        })
        .select("id, employee_id, benefit_type, amount, notes, created_at")
        .single()

      if (error) throw error
      return { ...data, amount: data.amount != null ? Number(data.amount) : null } as EmployeeBenefit
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-benefits", userId] })
    },
  })
}

export function useDeleteEmployeeBenefit(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_benefits")
        .delete()
        .eq("id", id)
        .eq("employee_id", userId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-benefits", userId] })
    },
  })
}
