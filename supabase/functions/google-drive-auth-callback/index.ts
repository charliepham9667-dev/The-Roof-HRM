// Supabase Edge Function: google-drive-auth-callback
// Handles OAuth callback, exchanges code for tokens, stores refresh token in app_settings

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get("code")
    const error = url.searchParams.get("error")
    const errorDescription = url.searchParams.get("error_description")

    if (error) throw new Error(`OAuth error: ${errorDescription || error}`)
    if (!code) throw new Error("No authorization code received")

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!clientId || !clientSecret) throw new Error("OAuth credentials not configured")
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase env not configured")

    const redirectUri = `${supabaseUrl}/functions/v1/google-drive-auth-callback`

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokens = await tokenResponse.json()
    if (tokens.error) {
      return new Response(JSON.stringify({
        success: false,
        error: `Token error: ${tokens.error}`,
        error_description: tokens.error_description,
        redirect_uri_used: redirectUri,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Store refresh token (may be empty if user previously consented; keep existing if so)
    if (tokens.refresh_token) {
      await supabase.from("app_settings").upsert({
        key: "google_drive_refresh_token",
        value: tokens.refresh_token,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" })
    }

    await supabase.from("app_settings").upsert({
      key: "google_drive_access_token",
      value: tokens.access_token,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" })

    return new Response(JSON.stringify({
      success: true,
      message: "Google Drive authorization successful! You can close this window.",
      has_refresh_token: !!tokens.refresh_token,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

