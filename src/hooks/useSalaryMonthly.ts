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
  // Bonus reconciliation (optional per month) — see src/lib/bonus-check.ts.
  monthly_target_vnd: number | null
  qualifying_revenue_vnd: number | null
  google_rating: number | null
  new_reviews: number | null
  surplus_bonus_paid_vnd: number | null
  notes: string | null
  source_file_path: string | null
  source_file_name: string | null
  source_file_mime_type: string | null
  source_file_size_bytes: number | null
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  "id,year,month,fixed_salary_vnd,svc_vnd,insurance_vnd,food_vnd,bonuses_vnd,overtime_vnd,other_vnd,total_vnd,insurance_base_vnd,gross_income_vnd,net_paid_vnd,headcount,monthly_target_vnd,qualifying_revenue_vnd,google_rating,new_reviews,surplus_bonus_paid_vnd,notes,source_file_path,source_file_name,source_file_mime_type,source_file_size_bytes,created_at,updated_at"

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

/**
 * Qualifying revenue for the bonus check = pnl_monthly.net_sales (the P&L "1.1 Net
 * Sales" line = revenue after VAT, service charge, and FOC). Returns null when the P&L
 * month isn't synced yet (owner enters it manually then). Owner-only RLS on pnl_monthly.
 */
export function usePnlNetSales(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: ["pnl-net-sales", year, month],
    enabled: enabled && year > 0 && month >= 1 && month <= 12,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from("pnl_monthly")
        .select("net_sales")
        .eq("year", year)
        .eq("month", month)
        .eq("data_type", "actual")
        .maybeSingle()
      if (error) throw error
      const v = (data as { net_sales?: number } | null)?.net_sales ?? null
      return v && v > 0 ? v : null
    },
  })
}

/**
 * Google gate inputs for the bonus check, from daily_metrics:
 *  - rating     = most recent non-null google_rating as of month end.
 *  - newReviews = cumulative google_review_count at month end − at prior month end
 *    (google_review_count is a running TOTAL snapshot per day, per useDashboardData).
 * Either is null when there's no data for that month (owner enters it manually).
 * Uses UTC-built date bounds so ICT (UTC+7) doesn't shift a day.
 */
export function useGoogleMonthly(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: ["google-monthly", year, month],
    enabled: enabled && year > 0 && month >= 1 && month <= 12,
    queryFn: async (): Promise<{ rating: number | null; newReviews: number | null }> => {
      const iso = (d: Date) => d.toISOString().slice(0, 10)
      const startIso = iso(new Date(Date.UTC(year, month - 1, 1)))
      const nextIso = iso(new Date(Date.UTC(year, month, 1)))
      const since = new Date(Date.UTC(year, month - 1, 1))
      since.setUTCDate(since.getUTCDate() - 400)

      const { data, error } = await supabase
        .from("daily_metrics")
        .select("date, google_rating, google_review_count")
        .gte("date", iso(since))
        .lt("date", nextIso)
        .order("date", { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as {
        date: string
        google_rating: number | null
        google_review_count: number | null
      }[]

      let rating: number | null = null
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].google_rating != null) {
          rating = rows[i].google_rating
          break
        }
      }

      let before = 0
      let inMonth: number | null = null
      for (const r of rows) {
        if (r.google_review_count == null) continue
        if (r.date < startIso) before = r.google_review_count
        else inMonth = r.google_review_count
      }
      const newReviews = inMonth != null ? Math.max(0, inMonth - before) : null

      return { rating, newReviews }
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
  monthlyTargetVnd?: number | null
  qualifyingRevenueVnd?: number | null
  googleRating?: number | null
  newReviews?: number | null
  surplusBonusPaidVnd?: number | null
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
            monthly_target_vnd: input.monthlyTargetVnd ?? null,
            qualifying_revenue_vnd: input.qualifyingRevenueVnd ?? null,
            google_rating: input.googleRating ?? null,
            new_reviews: input.newReviews ?? null,
            surplus_bonus_paid_vnd: input.surplusBonusPaidVnd ?? null,
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

export type BonusFields = {
  monthlyTargetVnd: number | null
  qualifyingRevenueVnd: number | null
  googleRating: number | null
  newReviews: number | null
  surplusBonusPaidVnd: number | null
}

/**
 * Update ONLY the bonus-check fields on an existing salary row (by id).
 * A partial UPDATE, not an upsert — so it never clobbers the salary category totals.
 */
export function useUpdateSalaryBonus() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: { id: string } & BonusFields) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("salary_monthly")
        .update({
          monthly_target_vnd: input.monthlyTargetVnd,
          qualifying_revenue_vnd: input.qualifyingRevenueVnd,
          google_rating: input.googleRating,
          new_reviews: input.newReviews,
          surplus_bonus_paid_vnd: input.surplusBonusPaidVnd,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id)
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
