import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export type AdsPlatform = "google_ads" | "facebook_ads" | "tiktok_ads"

export type MarketingIntegration = {
  id: string
  platform: AdsPlatform
  account_id: string
  account_name: string | null
  token_expires_at: string | null
  is_active: boolean
  created_at: string
  has_refresh_token: boolean
  has_access_token: boolean
}

export type MarketingSyncRun = {
  id: string
  platform: AdsPlatform | "all"
  status: "running" | "completed" | "failed" | "partial"
  started_at: string
  completed_at: string | null
  rows_upserted: number
  error_message: string | null
}

export type AdsManualMetricInput = {
  platform: AdsPlatform
  account_id: string
  campaign_id: string
  campaign_name: string
  metric_date: string
  spend?: number
  impressions?: number
  clicks?: number
  conversions?: number
  revenue?: number
  raw_payload?: Record<string, unknown>
}

export function useMarketingIntegrations() {
  return useQuery({
    queryKey: ["marketing-integrations"],
    queryFn: async (): Promise<MarketingIntegration[]> => {
      const { data, error } = await supabase
        .from("marketing_integrations")
        .select("id,platform,account_id,account_name,token_expires_at,is_active,created_at,refresh_token,access_token")
        .order("created_at", { ascending: false })
      if (error) throw error
      return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        platform: row.platform as AdsPlatform,
        account_id: String(row.account_id),
        account_name: (row.account_name as string | null) ?? null,
        token_expires_at: (row.token_expires_at as string | null) ?? null,
        is_active: Boolean(row.is_active),
        created_at: String(row.created_at),
        has_refresh_token: Boolean(row.refresh_token),
        has_access_token: Boolean(row.access_token),
      })) satisfies MarketingIntegration[]
    },
  })
}

export function useUpsertMarketingIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      platform: AdsPlatform
      account_id: string
      account_name?: string | null
      access_token?: string | null
      refresh_token?: string | null
      token_expires_at?: string | null
      metadata?: Record<string, unknown>
    }) => {
      const { data, error } = await supabase
        .from("marketing_integrations")
        .upsert(
          {
            platform: input.platform,
            account_id: input.account_id,
            account_name: input.account_name || null,
            access_token: input.access_token || null,
            refresh_token: input.refresh_token || null,
            token_expires_at: input.token_expires_at || null,
            metadata: input.metadata || {},
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "platform,account_id" },
        )
        .select("id,platform,account_id,account_name,token_expires_at,is_active,created_at")
        .single()
      if (error) throw error
      return data as MarketingIntegration
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-integrations"] }),
  })
}

export function useRunAdsSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { platform?: AdsPlatform | "all"; manualRows?: AdsManualMetricInput[] } = {}) => {
      const platform = input.platform || "all"
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("You must be logged in to sync ads data.")
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${supabaseUrl}/functions/v1/ads-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform,
          manual_rows: input.manualRows || [],
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Failed to run ads sync")
      return payload
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-campaigns-daily"] })
      qc.invalidateQueries({ queryKey: ["marketing-sync-runs"] })
    },
  })
}

export function useMarketingSyncRuns() {
  return useQuery({
    queryKey: ["marketing-sync-runs"],
    queryFn: async (): Promise<MarketingSyncRun[]> => {
      const { data, error } = await supabase
        .from("marketing_sync_runs")
        .select("id,platform,status,started_at,completed_at,rows_upserted,error_message")
        .order("started_at", { ascending: false })
        .limit(20)
      if (error) throw error
      return (data || []) as MarketingSyncRun[]
    },
  })
}

export function useAdsCampaignPerformance(platform?: AdsPlatform) {
  return useQuery({
    queryKey: ["ads-campaigns-daily", platform || "all"],
    queryFn: async () => {
      let query = supabase
        .from("ads_campaigns_daily")
        .select("id,platform,account_id,campaign_id,campaign_name,metric_date,spend,impressions,clicks,conversions,revenue,cpc,cpm,ctr,synced_at")
        .order("metric_date", { ascending: false })
        .limit(2000)
      if (platform) query = query.eq("platform", platform)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
  })
}

export function useDeleteAdsCampaignData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (platform: AdsPlatform) => {
      const { error } = await supabase
        .from("ads_campaigns_daily")
        .delete()
        .eq("platform", platform)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-campaigns-daily"] })
    },
  })
}
