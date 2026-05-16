import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { postProcessParsedPaymentList } from "../_shared/parse-payment-list.ts"

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

const SYSTEM_PROMPT = `You extract structured data from Vietnamese accountant spreadsheets titled "THE ROOF - LIST OF PAYMENT REQUIRED - BANK|CASH - DD/MM/YYYY".

Return ONLY valid JSON matching this schema (no markdown):
{
  "listDate": "YYYY-MM-DD",
  "paymentChannel": "bank" | "cash",
  "totalPaymentVnd": number | null,
  "beforeBalanceVnd": number | null,
  "rows": [{
    "vendorCode": string | null,
    "vendor": string,
    "amountVnd": number,
    "category": "inventory"|"rent"|"capex"|"utilities"|"other",
    "remarks": string | null,
    "bankAccount": string | null,
    "bankName": string | null,
    "skip": boolean
  }],
  "warnings": string[]
}

Rules:
- Parse title for date (e.g. 24/04/2026 -> 2026-04-24) and BANK vs CASH.
- Amounts use Vietnamese thousands dots (15.219.999 = 15219999).
- Copy the Remarks column VERBATIM into remarks (this describes what the payment is for). Example remarks values:
  "The Roof thanh toan tien Beer East West tu 01.04 den 15.04.2026 Cty SEA"
  "The Roof thanh toan tien DJ ngay 1+4+11+15 Dang Thanh Nhan"
  "The Roof thanh toan tien gia vi quay bar tu 01.04 den 15.04.2026"
- If a red Notes column exists, append after Remarks with " | " separator.
- Put Account number and Bank columns in bankAccount / bankName only — never in remarks.
- category from remarks meaning: inventory=beer/food/supplier invoices; other=DJ/BHXH/bonus/VAT; rent=thue nha; capex=equipment.
- Set skip:true for internal THE ROOF account transfers only.
- totalPaymentVnd from footer THE ROOF - TOTAL PAYMENT.
- Do not invent rows. warnings for unreadable cells.

Example row: vendor "CÔNG TY TNHH S.E.A CRAFT BREW TRADING", vendorCode "NCC00001", amountVnd 15219999, remarks "The Roof thanh toan tien Beer East West tu 01.04 den 15.04.2026 Cty SEA", category "inventory", bankName "TECHCOMBANK", bankAccount from sheet.`

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({
          error: "ANTHROPIC_API_KEY not set. Run: supabase secrets set ANTHROPIC_API_KEY=...",
        }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      )
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,status,is_active")
      .eq("id", authData.user.id)
      .maybeSingle()

    const canParse =
      !!profile &&
      profile.is_active &&
      profile.status === "active" &&
      (profile.role === "owner" || profile.role === "admin")

    if (profileError || !canParse) {
      return new Response(JSON.stringify({ error: "Forbidden – owner or admin required" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const body = await req.json().catch(() => ({}))
    const imageBase64 = String(body?.imageBase64 ?? "")
    const mimeType = String(body?.mimeType ?? "image/png")

    if (!imageBase64 || imageBase64.length < 100) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const mediaType = mimeType.startsWith("image/") ? mimeType : "image/png"

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: "Extract all payment rows from this LIST OF PAYMENT REQUIRED sheet. Return JSON only.",
              },
            ],
          },
        ],
      }),
    })

    const claudeJson = await claudeRes.json().catch(() => ({}))
    if (!claudeRes.ok) {
      const msg =
        (claudeJson as { error?: { message?: string } })?.error?.message ||
        JSON.stringify(claudeJson).slice(0, 200)
      return new Response(JSON.stringify({ error: `Vision API failed: ${msg}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const textBlocks = ((claudeJson as { content?: Array<{ type: string; text?: string }> }).content ||
      [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")

    const jsonMatch = textBlocks.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Could not parse vision response as JSON" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    let parsedRaw: unknown
    try {
      parsedRaw = JSON.parse(jsonMatch[0])
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON from vision model" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const result = postProcessParsedPaymentList(parsedRaw)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  }
})
