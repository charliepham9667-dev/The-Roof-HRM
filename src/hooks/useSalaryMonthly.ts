import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type SalaryMonthly = {
  id: string
  year: number
  month: number
  fixed_salary_vnd: number
  svc_vnd: number
  insurance_vnd: number
  food_vnd: number
  bonuses_vnd: number
  overtime_vnd: number
  other_vnd: number
  total_vnd: number
  insurance_base_vnd: number
  gross_income_vnd: number
  net_paid_vnd: number
  headcount: number | null
  notes: string | null
  source_file_path: string | null
  source_file_name: string | null
  source_file_mime_type: string | null
  source_file_size_bytes: number | null
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  "id,year,month,fixed_salary_vnd,svc_vnd,insurance_vnd,food_vnd,bonuses_vnd,overtime_vnd,other_vnd,total_vnd,insurance_base_vnd,gross_income_vnd,net_paid_vnd,headcount,notes,source_file_path,source_file_name,source_file_mime_type,source_file_size_bytes,created_at,updated_at"

const SOURCE_BUCKET = "finance-attachments"
const SOURCE_PREFIX = "salary"

/** Most recent months first, up to `limit` rows. */
export function useSalaryMonthly(limit = 24) {
  return useQuery({
    queryKey: ["salary-monthly", limit],
    queryFn: async (): Promise<SalaryMonthly[]> => {
      const { data, error } = await supabase
        .from("salary_monthly")
        .select(SELECT_COLS)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data as SalaryMonthly[]) || []
    },
  })
}

export function useUploadSalarySource() {
  return useMutation({
    mutationFn: async (input: { year: number; month: number; file: File }) => {
      const safeName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const folder = `${input.year}-${String(input.month).padStart(2, "0")}`
      const path = `${SOURCE_PREFIX}/${folder}/${Date.now()}-${safeName}`
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

export type UpsertSalaryInput = {
  year: number
  month: number
  fixedSalaryVnd: number
  svcVnd: number
  insuranceVnd: number
  foodVnd: number
  bonusesVnd: number
  overtimeVnd: number
  otherVnd: number
  insuranceBaseVnd?: number
  grossIncomeVnd?: number
  netPaidVnd?: number
  headcount?: number | null
  notes?: string | null
  sourceFilePath?: string | null
  sourceFileName?: string | null
  sourceFileMimeType?: string | null
  sourceFileSizeBytes?: number | null
}

export function useUpsertSalaryMonthly() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: UpsertSalaryInput) => {
      if (!profile?.id) throw new Error("Not authenticated")
      // total_vnd is a generated column — never write it.
      const { data, error } = await supabase
        .from("salary_monthly")
        .upsert(
          {
            year: input.year,
            month: input.month,
            fixed_salary_vnd: input.fixedSalaryVnd,
            svc_vnd: input.svcVnd,
            insurance_vnd: input.insuranceVnd,
            food_vnd: input.foodVnd,
            bonuses_vnd: input.bonusesVnd,
            overtime_vnd: input.overtimeVnd,
            other_vnd: input.otherVnd,
            insurance_base_vnd: input.insuranceBaseVnd ?? 0,
            gross_income_vnd: input.grossIncomeVnd ?? 0,
            net_paid_vnd: input.netPaidVnd ?? 0,
            headcount: input.headcount ?? null,
            notes: input.notes?.trim() || null,
            source_file_path: input.sourceFilePath ?? null,
            source_file_name: input.sourceFileName ?? null,
            source_file_mime_type: input.sourceFileMimeType ?? null,
            source_file_size_bytes: input.sourceFileSizeBytes ?? null,
            created_by: profile.id,
            updated_by: profile.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "year,month" },
        )
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return data as SalaryMonthly
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salary-monthly"] })
    },
  })
}

export async function getSalarySourceSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(SOURCE_BUCKET).createSignedUrl(path, 60 * 30)
  if (error) return null
  return data?.signedUrl ?? null
}
