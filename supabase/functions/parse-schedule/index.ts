import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { postProcessParsedSchedule } from "../_shared/parse-schedule.ts"

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

const SYSTEM_PROMPT = `You read THE ROOF's weekly staff schedule grid (a Google Sheet / Excel screenshot) and extract every scheduled shift.

Grid layout:
- The top header has 7 day columns in order: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday. Each day shows a day-of-month number (e.g. 22, 23, 24 ...).
- Each day column is split into three sub-columns: "In" (start time), "Out" (end time), and "Hours".
- The left-most column is the staff member's name (e.g. THU, THUY, Jane, Phu, Loc, Duong, Huy, Tu, Thanh, Long, Tho, Nguyen, Vu, THĂM).
- A staff member may have more than one row (split shifts, e.g. a midday row and an evening row). Emit a separate entry for each non-empty row.

Return ONLY valid JSON matching this schema (no markdown, no prose):
{
  "weekStartDayOfMonth": number | null,   // day-of-month of the Monday (first) column
  "entries": [
    {
      "rawName": string,        // staff name EXACTLY as printed in that row's label
      "dayIndex": number,       // 0 = Monday column ... 6 = Sunday column
      "dayOfMonth": number|null,// the day number in that column's header
      "startTime": "HH:MM",     // 24h, from the In sub-column
      "endTime": "HH:MM"        // 24h, from the Out sub-column
    }
  ],
  "warnings": string[]
}

Rules:
- Emit an entry ONLY when BOTH In and Out are real clock times. Do NOT rely on the Hours column — it is sometimes wrong or shows 0 even for a real shift.
- Treat a cell as a DAY OFF (skip it, no entry) when In/Out are blank, "0", "0,0", or "-".
- Times are 24-hour. Keep overnight shifts as-is: e.g. In 17:00 / Out 01:00 means the shift ends after midnight — output startTime "17:00", endTime "01:00". Do not try to add a day.
- If a time is written past midnight as 25:00 or 27:00, convert to 24h (25:00 -> 01:00, 27:00 -> 03:00).
- Carry the staff name from the row label down to every shift row that belongs to that person.
- Do not invent rows or people. Add a short note to warnings for any cell you could not read confidently.

Example: row "THUY" with Monday In 16:00 / Out 00:00 -> { "rawName": "THUY", "dayIndex": 0, "dayOfMonth": 22, "startTime": "16:00", "endTime": "00:00" }`

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
      (profile.role === "owner" || profile.role === "admin" || profile.role === "manager")

    if (profileError || !canParse) {
      return new Response(JSON.stringify({ error: "Forbidden – manager, owner or admin required" }), {
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
                text: "Extract every scheduled shift from this weekly schedule grid. Return JSON only.",
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

    const result = postProcessParsedSchedule(parsedRaw)

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
