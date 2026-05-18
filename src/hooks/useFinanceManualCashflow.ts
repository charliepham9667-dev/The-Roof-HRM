import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type ManualCashflowDirection = "in" | "out"

export type ManualCashflowCategory =
  | "dividend"
  | "salary"
  | "rent"
  | "inventory"
  | "capex"
  | "utilities"
  | "other"

export const MANUAL_CASHFLOW_CATEGORIES: { value: ManualCashflowCategory; label: string }[] = [
  { value: "dividend", label: "Dividend / Owner draw" },
  { value: "salary", label: "Salary run" },
  { value: "rent", label: "Rent" },
  { value: "inventory", label: "Inventory" },
  { value: "capex", label: "CapEx" },
  { value: "utilities", label: "Utilities" },
  { value: "other", label: "Other" },
]

export function categoryLabel(cat: ManualCashflowCategory): string {
  return MANUAL_CASHFLOW_CATEGORIES.find((c) => c.value === cat)?.label ?? cat
}

export type ManualCashflowEntry = {
  id: string
  flow_date: string
  direction: ManualCashflowDirection
  amount_vnd: number
  category: ManualCashflowCategory
  description: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  "id,flow_date,direction,amount_vnd,category,description,notes,created_by,created_at,updated_at"

export function useManualCashflow(startIso?: string, endIso?: string) {
  return useQuery({
    queryKey: ["finance-manual-cashflow", startIso, endIso],
    staleTime: 0,
    queryFn: async (): Promise<ManualCashflowEntry[]> => {
      let q = supabase
        .from("finance_manual_cashflow")
        .select(SELECT_COLS)
        .order("flow_date", { ascending: false })
      if (startIso) q = q.gte("flow_date", startIso)
      if (endIso) q = q.lte("flow_date", endIso)
      const { data, error } = await q
      if (error) throw error
      return (data as ManualCashflowEntry[]) || []
    },
  })
}

export function useManualCashflowRange(startIso: string, endIso: string) {
  return useManualCashflow(startIso, endIso)
}

export function useInsertManualCashflow() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      flowDate: string
      direction: ManualCashflowDirection
      amountVnd: number
      category: ManualCashflowCategory
      description: string
      notes?: string | null
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("finance_manual_cashflow")
        .insert({
          flow_date: input.flowDate,
          direction: input.direction,
          amount_vnd: input.amountVnd,
          category: input.category,
          description: input.description.trim() || input.category,
          notes: input.notes?.trim() || null,
          created_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as ManualCashflowEntry
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-manual-cashflow"] })
      qc.invalidateQueries({ queryKey: ["cash-flow-manual"] })
    },
  })
}

export function useDeleteManualCashflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_manual_cashflow").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-manual-cashflow"] })
      qc.invalidateQueries({ queryKey: ["cash-flow-manual"] })
    },
  })
}
