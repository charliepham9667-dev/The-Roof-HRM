import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type ExecutiveDashboardDailyInput = {
  date: string // YYYY-MM-DD
  tonightsRevenue: number
  updatedAt?: string
  updatedBy?: string | null
}

export function useMonthlyTarget(metric: "revenue" | "pax", periodStartIso: string) {
  return useQuery({
    queryKey: ["targets", metric, "monthly", periodStartIso],
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from("targets")
        .select("target_value")
        .eq("metric", metric)
        .eq("period", "monthly")
        .eq("period_start", periodStartIso)
        .maybeSingle()

      if (error) throw error
      return data?.target_value ? Number(data.target_value) : null
    },
    enabled: Boolean(metric && periodStartIso),
    staleTime: 1000 * 60 * 5,
  })
}

// Returns a record keyed by month number (1..12) mapping to target_value (or
// null when no row exists). One round trip per (metric, year).
export function useMonthlyTargetsForYear(
  metric: "revenue" | "pax",
  year: number,
) {
  return useQuery({
    queryKey: ["targets", metric, "monthly", "year", year],
    queryFn: async (): Promise<Record<number, number | null>> => {
      const startIso = `${year}-01-01`
      const endIso = `${year + 1}-01-01`
      const { data, error } = await supabase
        .from("targets")
        .select("period_start, target_value")
        .eq("metric", metric)
        .eq("period", "monthly")
        .gte("period_start", startIso)
        .lt("period_start", endIso)

      if (error) throw error

      const map: Record<number, number | null> = {}
      for (let m = 1; m <= 12; m += 1) map[m] = null
      for (const row of data || []) {
        const ps = String((row as any).period_start || "")
        const monthStr = ps.slice(5, 7)
        const month = Number(monthStr)
        if (Number.isFinite(month) && month >= 1 && month <= 12) {
          map[month] = (row as any).target_value
            ? Number((row as any).target_value)
            : null
        }
      }
      return map
    },
    enabled: Number.isFinite(year),
    staleTime: 1000 * 60 * 5,
  })
}

function mapRow(row: any): ExecutiveDashboardDailyInput {
  return {
    date: row.date,
    tonightsRevenue: Number(row.tonights_revenue || 0),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? null,
  }
}

export function useExecutiveDashboardDailyInput(dateIso: string) {
  return useQuery({
    queryKey: ["executive-dashboard-daily-input", dateIso],
    queryFn: async (): Promise<ExecutiveDashboardDailyInput> => {
      const { data, error } = await supabase
        .from("executive_dashboard_daily_inputs")
        .select("date, tonights_revenue, updated_at, updated_by")
        .eq("date", dateIso)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        return { date: dateIso, tonightsRevenue: 0 }
      }
      return mapRow(data)
    },
    enabled: Boolean(dateIso),
    staleTime: 1000 * 30,
  })
}

export function useUpsertMonthlyTarget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { metric: "revenue" | "pax"; periodStartIso: string; value: number }) => {
      // Check if a row already exists for this metric/period/period_start
      const { data: existing, error: selectError } = await supabase
        .from("targets")
        .select("id")
        .eq("metric", input.metric)
        .eq("period", "monthly")
        .eq("period_start", input.periodStartIso)
        .maybeSingle()

      if (selectError) throw selectError

      if (existing?.id) {
        const { error } = await supabase
          .from("targets")
          .update({ target_value: input.value })
          .eq("id", existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("targets").insert({
          metric: input.metric,
          period: "monthly",
          period_start: input.periodStartIso,
          target_value: input.value,
        })
        if (error) throw error
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["targets", variables.metric, "monthly", variables.periodStartIso] })
    },
  })
}

export function useUpsertExecutiveDashboardDailyInput() {
  const queryClient = useQueryClient()
  const profile = useAuthStore((s) => s.profile)

  return useMutation({
    mutationFn: async (input: { date: string; tonightsRevenue: number }) => {
      const update = {
        date: input.date,
        tonights_revenue: Math.max(0, Math.round(input.tonightsRevenue || 0)),
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from("executive_dashboard_daily_inputs")
        .upsert(update, { onConflict: "date" })
        .select("date, tonights_revenue, updated_at, updated_by")
        .single()

      if (error) throw error
      return mapRow(data)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["executive-dashboard-daily-input", data.date], data)
    },
  })
}

