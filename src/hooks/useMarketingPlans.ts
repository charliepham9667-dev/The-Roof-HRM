import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type MarketingPlanStatus = "draft" | "active" | "completed" | "archived"

export type MarketingPlan = {
  id: string
  title: string
  objective: string | null
  owner_id: string | null
  status: MarketingPlanStatus
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
}

export type MarketingPlanAsset = {
  id: string
  plan_id: string
  file_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

const BUCKET = "marketing-plan-assets"

export function useMarketingPlans() {
  return useQuery({
    queryKey: ["marketing-plans"],
    queryFn: async (): Promise<MarketingPlan[]> => {
      const { data, error } = await supabase
        .from("marketing_plans")
        .select("id,title,objective,owner_id,status,start_date,end_date,notes,created_at")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data || []) as MarketingPlan[]
    },
  })
}

export function useCreateMarketingPlan() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      title: string
      objective?: string
      status?: MarketingPlanStatus
      start_date?: string | null
      end_date?: string | null
      notes?: string
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("marketing_plans")
        .insert({
          title: input.title,
          objective: input.objective || null,
          status: input.status || "draft",
          start_date: input.start_date || null,
          end_date: input.end_date || null,
          notes: input.notes || null,
          owner_id: profile.id,
          created_by: profile.id,
        })
        .select("id,title,objective,owner_id,status,start_date,end_date,notes,created_at")
        .single()
      if (error) throw error
      return data as MarketingPlan
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-plans"] }),
  })
}

export function useUpdateMarketingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<MarketingPlan> & { id: string }) => {
      const { data, error } = await supabase
        .from("marketing_plans")
        .update({
          title: patch.title,
          objective: patch.objective,
          status: patch.status,
          start_date: patch.start_date,
          end_date: patch.end_date,
          notes: patch.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id,title,objective,owner_id,status,start_date,end_date,notes,created_at")
        .single()
      if (error) throw error
      return data as MarketingPlan
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-plans"] }),
  })
}

export function useDeleteMarketingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_plans").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-plans"] }),
  })
}

export function useMarketingPlanAssets(planId: string | null) {
  return useQuery({
    queryKey: ["marketing-plan-assets", planId],
    enabled: !!planId,
    queryFn: async (): Promise<MarketingPlanAsset[]> => {
      const { data, error } = await supabase
        .from("marketing_plan_assets")
        .select("id,plan_id,file_path,file_name,mime_type,size_bytes,created_at")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data || []).map((row: any) => ({ ...row, size_bytes: row.size_bytes ? Number(row.size_bytes) : null }))
    },
  })
}

export function useUploadMarketingPlanAsset(planId: string) {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (file: File) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const path = `${planId}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type,
      })
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from("marketing_plan_assets")
        .insert({
          plan_id: planId,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: profile.id,
        })
        .select("id,plan_id,file_path,file_name,mime_type,size_bytes,created_at")
        .single()
      if (error) throw error
      return data as MarketingPlanAsset
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-plan-assets", planId] }),
  })
}

export function useDeleteMarketingPlanAsset(planId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file_path }: { id: string; file_path: string }) => {
      const { error: storageErr } = await supabase.storage.from(BUCKET).remove([file_path])
      if (storageErr) throw storageErr
      const { error } = await supabase.from("marketing_plan_assets").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-plan-assets", planId] }),
  })
}

export async function getMarketingAssetSignedUrl(path: string) {
  return supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
}
