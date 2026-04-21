import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type FinanceCashPosition = {
  id: string
  report_date: string
  bank_balance_vnd: number
  cash_balance_vnd: number
  total_vnd: number
  notes: string | null
  source_file_path: string | null
  source_file_name: string | null
  source_file_mime_type: string | null
  source_file_size_bytes: number | null
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  "id,report_date,bank_balance_vnd,cash_balance_vnd,total_vnd,notes,source_file_path,source_file_name,source_file_mime_type,source_file_size_bytes,created_at,updated_at"

const SOURCE_BUCKET = "finance-attachments"
const SOURCE_PREFIX = "cash-position"

export function useLatestCashPosition() {
  return useQuery({
    queryKey: ["finance-cash-position-latest"],
    queryFn: async (): Promise<FinanceCashPosition | null> => {
      const { data, error } = await supabase
        .from("finance_cash_position_daily")
        .select(SELECT_COLS)
        .order("report_date", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as FinanceCashPosition | null) || null
    },
  })
}

export function useCashPositionHistory(days = 30) {
  return useQuery({
    queryKey: ["finance-cash-position-history", days],
    queryFn: async (): Promise<FinanceCashPosition[]> => {
      const { data, error } = await supabase
        .from("finance_cash_position_daily")
        .select(SELECT_COLS)
        .order("report_date", { ascending: false })
        .limit(days)
      if (error) throw error
      return (data as FinanceCashPosition[]) || []
    },
  })
}

export function useUpsertCashPosition() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      reportDate: string
      bankBalanceVnd: number
      cashBalanceVnd: number
      notes?: string | null
      sourceFilePath?: string | null
      sourceFileName?: string | null
      sourceFileMimeType?: string | null
      sourceFileSizeBytes?: number | null
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("finance_cash_position_daily")
        .upsert(
          {
            report_date: input.reportDate,
            bank_balance_vnd: input.bankBalanceVnd,
            cash_balance_vnd: input.cashBalanceVnd,
            notes: input.notes?.trim() || null,
            source_file_path: input.sourceFilePath ?? null,
            source_file_name: input.sourceFileName ?? null,
            source_file_mime_type: input.sourceFileMimeType ?? null,
            source_file_size_bytes: input.sourceFileSizeBytes ?? null,
            created_by: profile.id,
            updated_by: profile.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "report_date" },
        )
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as FinanceCashPosition
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-cash-position-latest"] })
      qc.invalidateQueries({ queryKey: ["finance-cash-position-history"] })
    },
  })
}

export function useUploadCashPositionSource() {
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

export async function getCashPositionSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(SOURCE_BUCKET)
    .createSignedUrl(path, 60 * 30)
  if (error) return null
  return data?.signedUrl ?? null
}
