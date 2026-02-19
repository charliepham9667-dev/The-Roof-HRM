import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export interface Promotion {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string | null
  targetAudience: string | null
  discountType: string | null
  discountValue: number | null
  imageUrl: string | null
  color: string | null
  status: "draft" | "scheduled" | "active" | "paused" | "ended"
  createdBy: string | null
  createdAt: string
  updatedAt: string
  isActive: boolean
}

function mapPromotion(row: any): Promotion {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    targetAudience: row.target_audience,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    imageUrl: row.image_url,
    color: row.color,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active ?? true,
  }
}

export function usePromotions() {
  const profile = useAuthStore((s) => s.profile)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("start_date", { ascending: true })

      if (error) throw error
      return (data || []).map(mapPromotion)
    },
    enabled: !!profile,
  })

  return { promotions: data as Promotion[], isLoading, error }
}

export function useTodaysPromotion() {
  const profile = useAuthStore((s) => s.profile)
  const today = new Date().toISOString().split("T")[0]

  const { data, isLoading, error } = useQuery({
    queryKey: ["promotions", "today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("status", "active")
        .eq("is_active", true)
        .lte("start_date", today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data ? mapPromotion(data) : null
    },
    enabled: !!profile,
  })

  return { promotion: data as Promotion | null, isLoading, error }
}

