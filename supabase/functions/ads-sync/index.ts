import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || ""
  const m = header.match(/^Bearer\s+(.+)$/i)
  return m?.[1] ?? null
}

type Platform = "google_ads" | "facebook_ads" | "tiktok_ads" | "all"

type ManualMetricRow = {
  platform: "google_ads" | "facebook_ads" | "tiktok_ads"
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

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function isDateIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS })
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env config" }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
    }

    const token = getBearerToken(req)
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization bearer token" }), { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) return new Response(JSON.stringify({ error: "Unauthorized caller" }), { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,manager_type,status,is_active")
      .eq("id", authData.user.id)
      .maybeSingle()
    const canSync = !!profile && profile.is_active && profile.status === "active" && (profile.role === "owner" || (profile.role === "manager" && profile.manager_type === "marketing"))
    if (profileError || !canSync) {
      return new Response(JSON.stringify({ error: "Forbidden – marketing manager or owner required" }), { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
    }

    const body = await req.json().catch(() => ({}))
    const platform = (body?.platform || "all") as Platform
    const validPlatforms = new Set(["google_ads", "facebook_ads", "tiktok_ads", "all"])
    if (!validPlatforms.has(platform)) {
      return new Response(JSON.stringify({ error: "Invalid platform" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
    }
    const manualRows = Array.isArray(body?.manual_rows) ? (body.manual_rows as ManualMetricRow[]) : []

    const { data: run, error: runError } = await supabase
      .from("marketing_sync_runs")
      .insert({
        platform,
        status: "running",
        triggered_by: authData.user.id,
        metadata: { mode: "manual", note: "Ads sync started." },
      })
      .select("id")
      .single()
    if (runError) throw runError

    const { data: integrations } = await supabase
      .from("marketing_integrations")
      .select("platform,account_id,is_active")
      .eq("is_active", true)
      .in("platform", platform === "all" ? ["google_ads", "facebook_ads", "tiktok_ads"] : [platform])

    const activeIntegrationKeys = new Set((integrations || []).map((x) => `${x.platform}:${x.account_id}`))
    const validPlatformsList = new Set(["google_ads", "facebook_ads", "tiktok_ads"])
    const filteredRows = manualRows.filter((row) => (platform === "all" ? true : row.platform === platform))
    const normalizedRows: Array<Record<string, unknown>> = []
    const validationErrors: string[] = []
    let skippedRows = 0

    for (let i = 0; i < filteredRows.length; i += 1) {
      const row = filteredRows[i]
      const prefix = `manual_rows[${i}]`
      if (!row || typeof row !== "object") {
        validationErrors.push(`${prefix}: invalid row object`)
        continue
      }
      if (!validPlatformsList.has(row.platform)) {
        validationErrors.push(`${prefix}: invalid platform`)
        continue
      }
      const accountId = String(row.account_id || "").trim()
      const campaignId = String(row.campaign_id || "").trim()
      const campaignName = String(row.campaign_name || "").trim()
      const metricDate = String(row.metric_date || "").trim()
      if (!accountId || !campaignId || !campaignName || !metricDate) {
        validationErrors.push(`${prefix}: account_id, campaign_id, campaign_name, and metric_date are required`)
        continue
      }
      if (!isDateIso(metricDate)) {
        validationErrors.push(`${prefix}: metric_date must be YYYY-MM-DD`)
        continue
      }
      const integrationKey = `${row.platform}:${accountId}`
      if (!activeIntegrationKeys.has(integrationKey)) {
        skippedRows += 1
        continue
      }

      const spend = asNumber(row.spend, 0)
      const impressions = Math.max(0, Math.round(asNumber(row.impressions, 0)))
      const clicks = Math.max(0, Math.round(asNumber(row.clicks, 0)))
      const conversions = asNumber(row.conversions, 0)
      const revenue = asNumber(row.revenue, 0)
      const cpc = clicks > 0 ? spend / clicks : null
      const cpm = impressions > 0 ? (spend * 1000) / impressions : null
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : null

      normalizedRows.push({
        platform: row.platform,
        account_id: accountId,
        campaign_id: campaignId,
        campaign_name: campaignName,
        metric_date: metricDate,
        spend,
        impressions,
        clicks,
        conversions,
        revenue,
        cpc,
        cpm,
        ctr,
        raw_payload: {
          source: "manual",
          original: row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {},
        },
        synced_at: new Date().toISOString(),
      })
    }

    if (validationErrors.length > 0) {
      await supabase
        .from("marketing_sync_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: validationErrors.slice(0, 6).join("; "),
          metadata: {
            mode: "manual",
            accounts_considered: integrations?.length || 0,
            validation_errors: validationErrors.length,
          },
        })
        .eq("id", run.id)
      return new Response(
        JSON.stringify({ error: "Manual rows validation failed", details: validationErrors.slice(0, 20) }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      )
    }

    let rowsUpserted = 0
    if (normalizedRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("ads_campaigns_daily")
        .upsert(normalizedRows, { onConflict: "platform,account_id,campaign_id,metric_date" })
      if (upsertError) throw upsertError
      rowsUpserted = normalizedRows.length
    }

    const finalStatus = manualRows.length > 0 && rowsUpserted === 0 ? "partial" : "completed"
    await supabase
      .from("marketing_sync_runs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        rows_upserted: rowsUpserted,
        metadata: {
          mode: "manual",
          accounts_considered: integrations?.length || 0,
          manual_rows_received: manualRows.length,
          manual_rows_after_platform_filter: filteredRows.length,
          manual_rows_upserted: rowsUpserted,
          manual_rows_skipped_without_active_integration: skippedRows,
          provider_sync_executed: false,
          next_step: "Configure provider credentials and adapter logic for Google/Facebook/TikTok APIs.",
        },
      })
      .eq("id", run.id)

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        platform,
        integrations_found: integrations?.length || 0,
        rows_upserted: rowsUpserted,
        rows_skipped: skippedRows,
        message: rowsUpserted > 0
          ? "Ads sync completed and campaign metrics were upserted."
          : "Ads sync completed with no rows upserted. Ensure integrations are active and rows match platform/account.",
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Unexpected error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  }
})
