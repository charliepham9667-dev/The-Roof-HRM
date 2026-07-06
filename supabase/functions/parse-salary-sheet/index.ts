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

const SYSTEM_PROMPT = `You extract MONTHLY SALARY TOTALS from THE ROOF bar's Vietnamese payroll sheet ("BẢNG THANH TOÁN TIỀN LƯƠNG"), a PDF the accountant sends each month. It is a wide table: one row per employee, grouped into sections (e.g. A. HỖ TRỢ, B. NHÀ HÀNG, C. MARKETING), with a grand-total row.

Return ONLY valid JSON (no markdown, no commentary):
{
  "year": 2026,
  "month": 6,
  "headcount": 15,
  "fixedSalaryVnd": 0,
  "svcVnd": 0,
  "foodVnd": 0,
  "bonusesVnd": 0,
  "overtimeVnd": 0,
  "otherVnd": 0,
  "insuranceBaseVnd": 0,
  "employerInsuranceVnd": 0,
  "grossIncomeVnd": 0,
  "netPaidVnd": 0,
  "warnings": []
}

Take the GRAND-TOTAL row (the bottom summary line, or sum each column across all staff) and map columns by their EXACT headers:
- fixedSalaryVnd = "Lương chính thức" (Official salary) + "Lương thử việc" (Internship/apprentice salary). The base earned pay.
- svcVnd         = "Phí Phục Vụ" (Service charge).
- foodVnd        = "Phụ cấp cơm ca" / "Cơm ca" (Meal allowance).
- bonusesVnd     = sum of EVERY bonus column. A column is a bonus if its header (or its sub-label in parentheses) contains "Thưởng", "Lễ/Tết", or "Lương tháng 13". IMPORTANT: the sheet has bonus columns headed "Truy lĩnh / Các khoản khác" with parenthesised sub-labels like "(Thưởng vượt doanh thu)" (revenue-target bonus) and "(Thưởng bonus)" — these ARE bonuses; include them here, NOT in otherVnd. Add together all such columns.
- overtimeVnd    = "Tăng ca" (Overtime) THÀNH TIỀN (the money amount, NOT the hours/công count).
- otherVnd       = "Phụ cấp khác" (Other allowances — e.g. toxic/hazard fee) + any "Truy lĩnh" back-pay column that is NOT a bonus. Never put a "Thưởng" column here.
- grossIncomeVnd = "Tổng thu nhập" (Total income) grand total — the sheet's own gross figure. It should roughly equal fixedSalary+svc+food+bonuses+overtime+other.
- netPaidVnd     = "Thực nhận" / "TỔNG CỘNG" net grand total — what staff actually receive.

Insurance (the company's cost, on top of gross):
- insuranceBaseVnd     = grand total of the "Mức đóng" (Payment level) column — the salary base insurance is calculated on. The "Khấu trừ NLĐ (10.5%)" column is the EMPLOYEE deduction; do NOT use it for employer cost.
- employerInsuranceVnd = the EMPLOYER's social-insurance contribution = 21.5% of insuranceBaseVnd (BHXH 17.5% + BHYT 3% + BHTN 1%). Compute it if the sheet does not print it, and add a warning saying it was computed at 21.5%.

Rules:
- Numbers may use COMMA or DOT as the thousands separator (13,000,000 and 13.000.000 both mean 13000000). There are no decimals. A dash "-" means 0.
- The overtime and days columns include HOURS/COUNT sub-columns (e.g. 208.0, 24.0) — ignore those; only take the money (THÀNH TIỀN / VND) amounts.
- headcount = number of distinct employees listed (count the STT rows), null if unclear.
- Infer year and month from the title (e.g. "Tháng 1 Năm 2026" or "BẢNG LƯƠNG THÁNG 1.2026" → month 1, year 2026).
- Do NOT invent values. If a column is absent or blank, return 0 for that bucket.
- Note in warnings[] anything ambiguous, and ALWAYS add a warning if (fixedSalary+svc+food+bonuses+overtime+other) does not roughly equal grossIncomeVnd.`

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
    // Accept either fileBase64 (preferred, any type) or imageBase64 (back-compat).
    const fileBase64 = String(body?.fileBase64 ?? body?.imageBase64 ?? "")
    const mimeType = String(body?.mimeType ?? "application/pdf")

    if (!fileBase64 || fileBase64.length < 100) {
      return new Response(JSON.stringify({ error: "fileBase64 is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // PDF → document block; image → image block.
    const isPdf = mimeType === "application/pdf"
    const sourceBlock = isPdf
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fileBase64 },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType.startsWith("image/") ? mimeType : "image/png",
            data: fileBase64,
          },
        }

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
              sourceBlock,
              {
                type: "text",
                text: "Extract the monthly salary totals from this sheet. Return the JSON object only.",
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
      return new Response(JSON.stringify({ error: `Parse API failed: ${msg}` }), {
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
      return new Response(JSON.stringify({ error: "Could not parse response as JSON" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    let parsedRaw: unknown
    try {
      parsedRaw = JSON.parse(jsonMatch[0])
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON from model" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify(parsedRaw), {
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
