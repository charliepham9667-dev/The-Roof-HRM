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
    const platform = (body?.platform || "all") as "google_ads" | "facebook_ads" | "tiktok_ads" | "all"
    const validPlatforms = new Set(["google_ads", "facebook_ads", "tiktok_ads", "all"])
    if (!validPlatforms.has(platform)) {
      return new Response(JSON.stringify({ error: "Invalid platform" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
    }

    const { data: run, error: runError } = await supabase
      .from("marketing_sync_runs")
      .insert({
        platform,
        status: "running",
        triggered_by: authData.user.id,
        metadata: { mode: "manual", note: "Ads sync scaffolding endpoint; provider adapters pending credentials setup." },
      })
      .select("id")
      .single()
    if (runError) throw runError

    const { data: integrations } = await supabase
      .from("marketing_integrations")
      .select("platform,account_id,is_active")
      .eq("is_active", true)
      .in("platform", platform === "all" ? ["google_ads", "facebook_ads", "tiktok_ads"] : [platform])

    await supabase
      .from("marketing_sync_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        rows_upserted: 0,
        metadata: {
          mode: "manual",
          accounts_considered: integrations?.length || 0,
          provider_sync_executed: false,
          next_step: "Configure provider credentials and adapter logic in ads-sync function.",
        },
      })
      .eq("id", run.id)

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        platform,
        integrations_found: integrations?.length || 0,
        message: "Ads sync scaffold executed. Provider-specific ingestion is ready for implementation.",
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
