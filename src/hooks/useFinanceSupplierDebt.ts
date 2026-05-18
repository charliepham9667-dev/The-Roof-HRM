import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type WeeklyDebtChannel = "manual" | "bank" | "cash"

export type FinanceSupplierDebtReport = {
  id: string
  report_date: string
  payment_channel: WeeklyDebtChannel
  total_debt_vnd: number
  total_overdue_vnd: number | null
  notes: string | null
  source_file_path: string | null
  source_file_name: string | null
  source_file_mime_type: string | null
  source_file_size_bytes: number | null
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  "id,report_date,payment_channel,total_debt_vnd,total_overdue_vnd,notes,source_file_path,source_file_name,source_file_mime_type,source_file_size_bytes,created_at,updated_at"

const SOURCE_BUCKET = "finance-attachments"
const SOURCE_PREFIX = "supplier-debt"

export function useLatestSupplierDebt() {
  return useQuery({
    queryKey: ["finance-supplier-debt-latest"],
    staleTime: 0,
    queryFn: async (): Promise<FinanceSupplierDebtReport | null> => {
      const { data, error } = await supabase
        .from("finance_supplier_debt_weekly")
        .select(SELECT_COLS)
        .order("report_date", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as FinanceSupplierDebtReport | null) || null
    },
  })
}

export function useSupplierDebtHistory(limit = 12) {
  return useQuery({
    queryKey: ["finance-supplier-debt-history", limit],
    queryFn: async (): Promise<FinanceSupplierDebtReport[]> => {
      const { data, error } = await supabase
        .from("finance_supplier_debt_weekly")
        .select(SELECT_COLS)
        .order("report_date", { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data as FinanceSupplierDebtReport[]) || []
    },
  })
}

export function useUpsertSupplierDebt() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      reportDate: string
      paymentChannel?: WeeklyDebtChannel
      totalDebtVnd: number
      totalOverdueVnd?: number | null
      notes?: string | null
      sourceFilePath?: string | null
      sourceFileName?: string | null
      sourceFileMimeType?: string | null
      sourceFileSizeBytes?: number | null
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("finance_supplier_debt_weekly")
        .upsert(
          {
            report_date: input.reportDate,
            payment_channel: input.paymentChannel ?? "manual",
            total_debt_vnd: input.totalDebtVnd,
            total_overdue_vnd: input.totalOverdueVnd ?? null,
            notes: input.notes?.trim() || null,
            source_file_path: input.sourceFilePath ?? null,
            source_file_name: input.sourceFileName ?? null,
            source_file_mime_type: input.sourceFileMimeType ?? null,
            source_file_size_bytes: input.sourceFileSizeBytes ?? null,
            created_by: profile.id,
            updated_by: profile.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "report_date,payment_channel" },
        )
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as FinanceSupplierDebtReport
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-latest"] })
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-history"] })
    },
  })
}

/** Log a payment-list screenshot import in weekly debt history (one row per list date + channel). */
export function useLogPaymentListImport() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      listDate: string
      paymentChannel: "bank" | "cash"
      totalVnd: number
      lineCount: number
      footerTotalVnd?: number | null
      sourceFilePath?: string | null
      sourceFileName?: string | null
      sourceFileMimeType?: string | null
      sourceFileSizeBytes?: number | null
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const channelLabel = input.paymentChannel === "cash" ? "Cash" : "Bank"
      let notes = `Payment list · ${channelLabel} · ${input.lineCount} line${input.lineCount === 1 ? "" : "s"}`
      if (
        input.footerTotalVnd != null &&
        Math.abs(input.footerTotalVnd - input.totalVnd) > Math.max(1000, input.totalVnd * 0.01)
      ) {
        notes += ` · footer ${input.footerTotalVnd.toLocaleString("vi-VN")} đ`
      }
      const { data, error } = await supabase
        .from("finance_supplier_debt_weekly")
        .upsert(
          {
            report_date: input.listDate,
            payment_channel: input.paymentChannel,
            total_debt_vnd: input.totalVnd,
            total_overdue_vnd: null,
            notes,
            source_file_path: input.sourceFilePath ?? null,
            source_file_name: input.sourceFileName ?? null,
            source_file_mime_type: input.sourceFileMimeType ?? null,
            source_file_size_bytes: input.sourceFileSizeBytes ?? null,
            created_by: profile.id,
            updated_by: profile.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "report_date,payment_channel" },
        )
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as FinanceSupplierDebtReport
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-latest"] })
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-history"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
    },
  })
}

export function useDeleteSupplierDebtHistory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_supplier_debt_weekly").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-latest"] })
      qc.invalidateQueries({ queryKey: ["finance-supplier-debt-history"] })
      qc.invalidateQueries({ queryKey: ["financial-headroom"] })
    },
  })
}

export function useUploadSupplierDebtSource() {
  return useMutation({
    mutationFn: async (input: { reportDate: string; file: File }) => {
      const safeName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const path = `${SOURCE_PREFIX}/${input.reportDate}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage
        .from(SOURCE_BUCKET)
        .upload(path, input.file, {
          upsert: false,
          contentType: input.file.type || undefined,
        })
      if (error) throw error
      return {
        path,
        fileName: input.file.name,
        mimeType: input.file.type || null,
        sizeBytes: input.file.size,
      }
    },
  })
}

export async function getSupplierDebtSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(SOURCE_BUCKET)
    .createSignedUrl(path, 60 * 30)
  if (error) return null
  return data?.signedUrl ?? null
}
