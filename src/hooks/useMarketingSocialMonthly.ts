import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"
import type { SocialMonthlyPayload } from "@/lib/marketingSocialCsvParser"

export type MarketingSocialMonthlyReport = {
  id: string
  report_month: string
  source_file_name: string | null
  source_file_path: string | null
  source_file_mime_type: string | null
  source_file_size_bytes: number | null
  payload: SocialMonthlyPayload
  created_at: string
  updated_at: string
}

const EMPTY_PAYLOAD: SocialMonthlyPayload = {
  instagram: {},
  tiktok: {},
  facebook: {},
  google: {},
}

export function useLatestMarketingSocialMonthlyReport() {
  return useQuery({
    queryKey: ["marketing-social-monthly-latest"],
    queryFn: async (): Promise<MarketingSocialMonthlyReport | null> => {
      const { data, error } = await supabase
        .from("marketing_social_monthly_reports")
        .select("id,report_month,source_file_name,source_file_path,source_file_mime_type,source_file_size_bytes,payload,created_at,updated_at")
        .order("report_month", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        ...data,
        payload: (data.payload as SocialMonthlyPayload) || EMPTY_PAYLOAD,
      } as MarketingSocialMonthlyReport
    },
  })
}

export function useUpsertMarketingSocialMonthlyReport() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      reportMonth: string
      sourceFileName?: string | null
      sourceFilePath?: string | null
      sourceFileMimeType?: string | null
      sourceFileSizeBytes?: number | null
      payload: SocialMonthlyPayload
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("marketing_social_monthly_reports")
        .upsert(
          {
            report_month: input.reportMonth,
            source_file_name: input.sourceFileName || null,
            source_file_path: input.sourceFilePath || null,
            source_file_mime_type: input.sourceFileMimeType || null,
            source_file_size_bytes: input.sourceFileSizeBytes ?? null,
            payload: input.payload || EMPTY_PAYLOAD,
            created_by: profile.id,
            updated_by: profile.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "report_month" },
        )
        .select("id,report_month,source_file_name,source_file_path,source_file_mime_type,source_file_size_bytes,payload,created_at,updated_at")
        .single()
      if (error) throw error
      return {
        ...data,
        payload: (data.payload as SocialMonthlyPayload) || EMPTY_PAYLOAD,
      } as MarketingSocialMonthlyReport
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-social-monthly-latest"] })
    },
  })
}

const SOURCE_BUCKET = "marketing-social-reports"

export function useUploadMarketingSocialReportSource() {
  return useMutation({
    mutationFn: async (input: { reportMonth: string; file: File }) => {
      const safeName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const path = `${input.reportMonth}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from(SOURCE_BUCKET).upload(path, input.file, {
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
