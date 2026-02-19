// Supabase Edge Function: google-drive-auth
// Initiates OAuth flow for Google Drive API (employee documents)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")
    if (!clientId) throw new Error("GOOGLE_CLIENT_ID not configured")

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    if (!supabaseUrl) throw new Error("SUPABASE_URL not configured")

    const redirectUri = `${supabaseUrl}/functions/v1/google-drive-auth-callback`

    // NOTE: Drive scope is broad, but required to create/list folders/files in a shared structure.
    const scopes = [
      "https://www.googleapis.com/auth/drive",
    ].join(" ")

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", scopes)
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: authUrl.toString(),
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

