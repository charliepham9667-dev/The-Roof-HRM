import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"
import {
  categoryLabel,
  computeDebtRibbonBuckets,
  supabaseErrorMessage,
  type DebtCategory,
  type DebtItemStatus,
} from "@/lib/finance-headroom"

export type PaymentChannel = "bank" | "cash"

export type FinanceSupplierDebtItem = {
  id: string
  vendor: string
  vendor_code: string | null
  category: DebtCategory
  amount_vnd: number
  due_date: string
  status: DebtItemStatus
  notes: string | null
  paid_at: string | null
  payment_channel: PaymentChannel | null
  source_import_path: string | null
  source_weekly_report_id: string | null
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  "id,vendor,vendor_code,category,amount_vnd,due_date,status,notes,paid_at,payment_channel,source_import_path,source_weekly_report_id,created_at,updated_at"

const SOURCE_BUCKET = "finance-attachments"
const DEBT_IMPORT_PREFIX = "debt-import"

export function useSupplierDebtItems() {
  return useQuery({
    queryKey: ["finance-supplier-debt-items"],
    staleTime: 0,
    queryFn: async (): Promise<FinanceSupplierDebtItem[]> => {
      const { data, error } = await supabase
        .from("finance_supplier_debt_items")
        .select(SELECT_COLS)
        .in("status", ["pending", "stopped"])
        .order("due_date", { ascending: true })
      if (error) throw error
      return (data as FinanceSupplierDebtItem[]) || []
    },
  })
}

export function useAllSupplierDebtItems() {
  return useQuery({
    queryKey: ["finance-supplier-debt-items-all"],
    queryFn: async (): Promise<FinanceSupplierDebtItem[]> => {
      const { data, error } = await supabase
        .from("finance_supplier_debt_items")
        .select(SELECT_COLS)
        .order("due_date", { ascending: true })
      if (error) throw error
      return (data as FinanceSupplierDebtItem[]) || []
    },
  })
}

export function useOpenDebtTotal() {
  const { data: items = [] } = useSupplierDebtItems()
  return items.reduce((s, i) => s + Number(i.amount_vnd), 0)
}

export function useDebtRibbonMetrics() {
  const { data: items = [], ...rest } = useSupplierDebtItems()
  return {
    ...rest,
    buckets: computeDebtRibbonBuckets(items),
    items,
  }
}

export function useDebtCategoryBreakdown() {
  const { data: items = [] } = useSupplierDebtItems()
  const total = items.reduce((s, i) => s + Number(i.amount_vnd), 0) || 1

  const groups: { key: DebtCategory; label: string; amount: number; count: number; pct: number }[] = []
  const cats: DebtCategory[] = ["inventory", "rent", "capex", "utilities", "other"]

  for (const cat of cats) {
    const rows = items.filter((i) => i.category === cat)
    const amount = rows.reduce((s, i) => s + Number(i.amount_vnd), 0)
    if (amount > 0) {
      groups.push({
        key: cat,
        label: categoryLabel(cat),
        amount,
        count: rows.length,
        pct: (amount / total) * 100,
      })
    }
  }

  return groups.sort((a, b) => b.amount - a.amount)
}

export function useUpsertDebtItem() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      id?: string
      vendor: string
      category: DebtCategory
      amountVnd: number
      dueDate: string
      status?: DebtItemStatus
      notes?: string | null
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const row = {
        vendor: input.vendor.trim(),
        category: input.category,
        amount_vnd: input.amountVnd,
        due_date: input.dueDate,
        status: input.status ?? "pending",
        notes: input.notes?.trim() || null,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      }

      if (input.id) {
        const { data, error } = await supabase
          .from("finance_supplier_debt_items")
          .update(row)
          .eq("id", input.id)
          .select(SELECT_COLS)
          .single()
        if (error) throw error
        return data as FinanceSupplierDebtItem
      }

      const { data, error } = await supabase
        .from("finance_supplier_debt_items")
        .insert({ ...row, created_by: profile.id })
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as FinanceSupplierDebtItem
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items"] })
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items-all"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
    },
  })
}

export function useUpdateDebtItemCategory() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: { id: string; category: DebtCategory }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("finance_supplier_debt_items")
        .update({ category: input.category, updated_at: new Date().toISOString(), updated_by: profile.id })
        .eq("id", input.id)
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as FinanceSupplierDebtItem
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items"] })
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items-all"] })
      qc.invalidateQueries({ queryKey: ["cash-flow-paid-debt-full"] })
    },
  })
}

export function useUpdateDebtItemStatus() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: { id: string; status: DebtItemStatus; dueDate?: string }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const patch: Record<string, unknown> = {
        status: input.status,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      }
      if (input.status === "paid") {
        patch.paid_at = input.dueDate ?? new Date().toISOString().slice(0, 10)
      } else {
        patch.paid_at = null
      }
      const { data, error } = await supabase
        .from("finance_supplier_debt_items")
        .update(patch)
        .eq("id", input.id)
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as FinanceSupplierDebtItem
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items"] })
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items-all"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
      qc.invalidateQueries({ queryKey: ["cash-flow-paid-debt"] })
      qc.invalidateQueries({ queryKey: ["cash-flow-revenue"] })
    },
  })
}

export function useDeleteDebtItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_supplier_debt_items").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items"] })
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items-all"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
      qc.invalidateQueries({ queryKey: ["cash-flow-paid-debt"] })
    },
  })
}

export type BulkDebtImportRow = {
  vendor: string
  vendorCode?: string | null
  category: DebtCategory
  amountVnd: number
  dueDate: string
  paymentChannel: PaymentChannel
  notes?: string | null
  sourceImportPath?: string | null
  status?: DebtItemStatus
}

export function useUploadDebtImportSource() {
  return useMutation({
    mutationFn: async (input: { listDate: string; file: File }) => {
      const safeName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const path = `${DEBT_IMPORT_PREFIX}/${input.listDate}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from(SOURCE_BUCKET).upload(path, input.file, {
        upsert: false,
        contentType: input.file.type || undefined,
      })
      if (error) throw error
      return { path }
    },
  })
}

export function useBulkImportDebtItems() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      rows: BulkDebtImportRow[]
      replaceForDateChannel?: { dueDate: string; channel: PaymentChannel }
      weeklyReportId?: string | null
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      if (input.rows.length === 0) throw new Error("No rows to import")

      if (input.replaceForDateChannel) {
        const { dueDate, channel } = input.replaceForDateChannel
        const { error: delError } = await supabase
          .from("finance_supplier_debt_items")
          .delete()
          .eq("due_date", dueDate)
          .eq("payment_channel", channel)
          .neq("status", "paid")
        if (delError) throw delError
      }

      const now = new Date().toISOString()
      const today = now.slice(0, 10)
      const payload = input.rows.map((r) => {
        const status: DebtItemStatus =
          r.status === "paid" || r.status === "stopped" ? r.status : "pending"
        return {
          vendor: r.vendor.trim(),
          vendor_code: r.vendorCode?.trim() || null,
          category: r.category,
          amount_vnd: r.amountVnd,
          due_date: r.dueDate,
          status,
          notes: r.notes?.trim() || null,
          payment_channel: r.paymentChannel,
          source_import_path: r.sourceImportPath ?? null,
          source_weekly_report_id: input.weeklyReportId ?? null,
          paid_at: status === "paid" ? r.dueDate || today : null,
          created_by: profile.id,
          updated_by: profile.id,
          updated_at: now,
        }
      })

      const { data, error } = await supabase
        .from("finance_supplier_debt_items")
        .insert(payload)
        .select(SELECT_COLS)
      if (error) {
        throw new Error(
          supabaseErrorMessage(error, "Could not save debt lines. Run supabase db push if columns are missing."),
        )
      }
      return (data as FinanceSupplierDebtItem[]) || []
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items"] })
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-items-all"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
      qc.invalidateQueries({ queryKey: ["cash-flow-paid-debt"] })
    },
  })
}

export function debtActionForStatus(status: DebtItemStatus): string | null {
  if (status === "pending") return "Paid"
  if (status === "stopped") return "Resume"
  return null
}

export function nextStatusForAction(status: DebtItemStatus): DebtItemStatus {
  if (status === "pending") return "paid"
  if (status === "stopped") return "pending"
  return status
}
