// Supabase Edge Function: google-auth-callback
// Handles OAuth callback, exchanges code for tokens

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    console.log("Callback received, code present:", !!code, "error:", error);

    if (error) {
      throw new Error(`OAuth error: ${errorDescription || error}`);
    }

    if (!code) {
      throw new Error("No authorization code received");
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const redirectUri = `${supabaseUrl}/functions/v1/google-auth-callback`;

    console.log("Env check - URL:", !!supabaseUrl, "ID:", !!clientId, "SECRET:", !!clientSecret);

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({
        success: false,
        error: "OAuth credentials not configured",
        debug: {
          SUPABASE_URL: supabaseUrl ? "SET" : "MISSING",
          GOOGLE_CLIENT_ID: clientId ? "SET" : "MISSING", 
          GOOGLE_CLIENT_SECRET: clientSecret ? "SET" : "MISSING"
        }
      }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Exchange code for tokens
    console.log("Exchanging code for tokens...");
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
    });

    const tokens = await tokenResponse.json();
    console.log("Token response - status:", tokenResponse.status, "body:", JSON.stringify(tokens));

    if (tokens.error) {
      // Return detailed error for debugging
      return new Response(JSON.stringify({
        success: false,
        error: `Token error: ${tokens.error}`,
        error_description: tokens.error_description,
        redirect_uri_used: redirectUri,
        hint: "Make sure this redirect_uri is registered in Google Cloud Console"
      }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Store refresh token in database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Storing tokens...");
    
    const { error: refreshError } = await supabase.from("app_settings").upsert({
      key: "google_refresh_token",
      value: tokens.refresh_token || "",
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    if (refreshError) {
      console.error("DB error:", refreshError);
      throw new Error(`Database error: ${refreshError.message}`);
    }

    await supabase.from("app_settings").upsert({
      key: "google_access_token",
      value: tokens.access_token,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    console.log("Success!");

    // Return JSON success (redirect can be handled by frontend)
    return new Response(JSON.stringify({
      success: true,
      message: "Google authorization successful! You can close this window."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
