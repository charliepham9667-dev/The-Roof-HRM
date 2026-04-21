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

type IntegrationRow = {
  id: string
  platform: "google_ads" | "facebook_ads" | "tiktok_ads"
  account_id: string
  refresh_token: string | null
  access_token: string | null
  token_expires_at: string | null
  is_active: boolean
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function isDateIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function digitsOnly(value: string | null | undefined): string {
  return String(value || "").replace(/[^0-9]/g, "")
}

type SupaClient = ReturnType<typeof createClient>

async function runGoogleAdsAdapter(
  supabase: SupaClient,
  integ: IntegrationRow,
): Promise<{ rowsUpserted: number; warnings: string[] }> {
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")
  const loginCustomerIdRaw = Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")

  if (!clientId || !clientSecret || !developerToken) {
    throw new Error(
      "Google Ads secrets missing. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN via `supabase secrets set`.",
    )
  }
  if (!integ.refresh_token) {
    throw new Error(
      "Google Ads integration has no refresh_token. Paste one into the Refresh token field and Save Integration.",
    )
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integ.refresh_token,
      grant_type: "refresh_token",
    }),
  })
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>
  if (!tokenRes.ok) {
    const msg = (tokenJson?.error_description as string) || (tokenJson?.error as string) || `HTTP ${tokenRes.status}`
    throw new Error(`Google OAuth refresh failed: ${msg}`)
  }
  const accessToken = String(tokenJson.access_token || "")
  if (!accessToken) throw new Error("Google OAuth refresh returned no access_token")
  const expiresIn = Number(tokenJson.expires_in) || 3600
  const tokenExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString()

  const customerId = digitsOnly(integ.account_id)
  if (!customerId) throw new Error("Invalid Google Ads account_id (no digits)")

  const gaql = [
    "SELECT",
    "  campaign.id,",
    "  campaign.name,",
    "  segments.date,",
    "  metrics.cost_micros,",
    "  metrics.impressions,",
    "  metrics.clicks,",
    "  metrics.conversions,",
    "  metrics.conversions_value",
    "FROM campaign",
    "WHERE segments.date DURING LAST_30_DAYS",
  ].join("\n")

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "content-type": "application/json",
  }
  const loginCustomerId = digitsOnly(loginCustomerIdRaw)
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId

  const searchRes = await fetch(
    `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query: gaql }),
    },
  )
  const searchBody = (await searchRes.json().catch(() => ({}))) as unknown
  if (!searchRes.ok) {
    const err = (searchBody as { error?: { message?: string } })?.error?.message
      || JSON.stringify(searchBody).slice(0, 400)
    throw new Error(`Google Ads API ${searchRes.status}: ${err}`)
  }

  const streamChunks: Array<{ results?: unknown[] }> = Array.isArray(searchBody)
    ? (searchBody as Array<{ results?: unknown[] }>)
    : [searchBody as { results?: unknown[] }]
  const normalizedRows: Array<Record<string, unknown>> = []
  const warnings: string[] = []

  for (const chunk of streamChunks) {
    const results = Array.isArray(chunk?.results) ? chunk.results : []
    for (const raw of results) {
      const r = raw as {
        campaign?: { id?: string | number; name?: string }
        segments?: { date?: string }
        metrics?: {
          costMicros?: string | number
          impressions?: string | number
          clicks?: string | number
          conversions?: string | number
          conversionsValue?: string | number
        }
      }
      const campaignId = String(r.campaign?.id ?? "")
      const campaignName = String(r.campaign?.name ?? (campaignId ? `Campaign ${campaignId}` : ""))
      const metricDate = String(r.segments?.date ?? "")
      if (!campaignId || !metricDate || !isDateIso(metricDate)) {
        warnings.push("Skipped malformed result row")
        continue
      }
      const costMicros = asNumber(r.metrics?.costMicros, 0)
      const spend = costMicros / 1_000_000
      const impressions = Math.max(0, Math.round(asNumber(r.metrics?.impressions, 0)))
      const clicks = Math.max(0, Math.round(asNumber(r.metrics?.clicks, 0)))
      const conversions = asNumber(r.metrics?.conversions, 0)
      const revenue = asNumber(r.metrics?.conversionsValue, 0)
      const cpc = clicks > 0 ? spend / clicks : null
      const cpm = impressions > 0 ? (spend * 1000) / impressions : null
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : null

      normalizedRows.push({
        platform: "google_ads",
        account_id: integ.account_id,
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
        raw_payload: r,
        synced_at: new Date().toISOString(),
      })
    }
  }

  let rowsUpserted = 0
  if (normalizedRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("ads_campaigns_daily")
      .upsert(normalizedRows, { onConflict: "platform,account_id,campaign_id,metric_date" })
    if (upsertErr) throw upsertErr
    rowsUpserted = normalizedRows.length
  }

  await supabase
    .from("marketing_integrations")
    .update({
      access_token: accessToken,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integ.id)

  return { rowsUpserted, warnings }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env config" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing Authorization bearer token" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized caller" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,manager_type,status,is_active")
      .eq("id", authData.user.id)
      .maybeSingle()
    const canSync =
      !!profile &&
      profile.is_active &&
      profile.status === "active" &&
      (profile.role === "owner" ||
        (profile.role === "manager" && profile.manager_type === "marketing"))
    if (profileError || !canSync) {
      return new Response(JSON.stringify({ error: "Forbidden – marketing manager or owner required" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const body = await req.json().catch(() => ({}))
    const platform = (body?.platform || "all") as Platform
    const validPlatforms = new Set(["google_ads", "facebook_ads", "tiktok_ads", "all"])
    if (!validPlatforms.has(platform)) {
      return new Response(JSON.stringify({ error: "Invalid platform" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }
    const manualRows = Array.isArray(body?.manual_rows) ? (body.manual_rows as ManualMetricRow[]) : []

    const { data: run, error: runError } = await supabase
      .from("marketing_sync_runs")
      .insert({
        platform,
        status: "running",
        triggered_by: authData.user.id,
        metadata: { mode: manualRows.length > 0 ? "manual" : "provider", note: "Ads sync started." },
      })
      .select("id")
      .single()
    if (runError) throw runError

    const platformList = platform === "all" ? ["google_ads", "facebook_ads", "tiktok_ads"] : [platform]
    const { data: integrations } = await supabase
      .from("marketing_integrations")
      .select("id,platform,account_id,refresh_token,access_token,token_expires_at,is_active")
      .eq("is_active", true)
      .in("platform", platformList)

    const integrationsTyped = (integrations || []) as IntegrationRow[]
    const activeIntegrationKeys = new Set(integrationsTyped.map((x) => `${x.platform}:${x.account_id}`))
    const validPlatformsList = new Set(["google_ads", "facebook_ads", "tiktok_ads"])

    if (manualRows.length > 0) {
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
              accounts_considered: integrationsTyped.length,
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
            accounts_considered: integrationsTyped.length,
            manual_rows_received: manualRows.length,
            manual_rows_after_platform_filter: filteredRows.length,
            manual_rows_upserted: rowsUpserted,
            manual_rows_skipped_without_active_integration: skippedRows,
          },
        })
        .eq("id", run.id)

      return new Response(
        JSON.stringify({
          success: true,
          mode: "manual",
          run_id: run.id,
          platform,
          integrations_found: integrationsTyped.length,
          rows_upserted: rowsUpserted,
          rows_skipped: skippedRows,
          message:
            rowsUpserted > 0
              ? "Manual metrics upserted."
              : "No manual rows upserted. Ensure integrations are active and rows match platform/account.",
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      )
    }

    const providerBreakdown: Record<string, number> = {}
    const providerErrors: string[] = []
    const providerWarnings: string[] = []
    let providerRowsTotal = 0

    for (const integ of integrationsTyped) {
      const key = `${integ.platform}:${integ.account_id}`
      try {
        if (integ.platform === "google_ads") {
          const { rowsUpserted, warnings } = await runGoogleAdsAdapter(supabase, integ)
          providerBreakdown[key] = rowsUpserted
          providerRowsTotal += rowsUpserted
          if (warnings.length) providerWarnings.push(`${key}: ${warnings.length} warnings`)
        } else {
          providerErrors.push(`${key}: adapter for ${integ.platform} not yet implemented`)
        }
      } catch (adapterErr) {
        const message = adapterErr instanceof Error ? adapterErr.message : String(adapterErr)
        providerErrors.push(`${key}: ${message}`)
      }
    }

    const finalStatus = providerErrors.length === 0
      ? (providerRowsTotal > 0 ? "completed" : integrationsTyped.length > 0 ? "partial" : "completed")
      : providerRowsTotal > 0
        ? "partial"
        : "failed"

    await supabase
      .from("marketing_sync_runs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        rows_upserted: providerRowsTotal,
        error_message: providerErrors.length ? providerErrors.slice(0, 6).join("; ") : null,
        metadata: {
          mode: "provider",
          integrations_found: integrationsTyped.length,
          provider_breakdown: providerBreakdown,
          provider_errors: providerErrors,
          provider_warnings: providerWarnings,
        },
      })
      .eq("id", run.id)

    const success = providerErrors.length === 0
    const message = !integrationsTyped.length
      ? "No active integrations to sync. Save one first, then run again."
      : providerRowsTotal > 0
        ? `Pulled ${providerRowsTotal} campaign/day rows from providers.`
        : providerErrors.length
          ? "Provider sync failed. See details."
          : "Providers returned no rows for this period."

    return new Response(
      JSON.stringify({
        success,
        mode: "provider",
        run_id: run.id,
        platform,
        integrations_found: integrationsTyped.length,
        rows_upserted: providerRowsTotal,
        breakdown: providerBreakdown,
        errors: providerErrors,
        message,
      }),
      {
        status: success ? 200 : 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  }
})
