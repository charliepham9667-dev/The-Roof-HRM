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
  "surplusBonusVnd": 0,
  "overtimeVnd": 0,
  "otherVnd": 0,
  "insuranceBaseVnd": 0,
  "employerInsuranceVnd": 0,
  "grossIncomeVnd": 0,
  "netPaidVnd": 0,
  "warnings": []
}

Read every value from the bottom "TỔNG CỘNG" grand-total row.

CRITICAL — the sheet has several column groups with REPEATED headers. You must read ONLY the money columns inside the group titled "Lương và các khoản phụ cấp trong lương" (Salary & allowances within pay) — the block that ends in "Tổng thu nhập (Total income)". IGNORE these earlier groups entirely: "Lương & khoản phụ cấp (Salary & allowances)" (monthly contract rates), "Lương quy đổi giờ (Hourly wage)" (hourly rates), and "Công / Giờ tính lương thực tế (Actual hours worked)" (day/hour COUNTS like 208.0, 24.0). Those are rates/counts, not what was paid.

HOW TO FIND THE RIGHT GROUP (most important rule): the "Lương và các khoản phụ cấp trong lương" earned block is the set of money columns IMMEDIATELY TO THE LEFT of the "Tổng thu nhập (Total income)" column. Work RIGHT-TO-LEFT from "Tổng thu nhập": every money column between it and the "Actual hours worked" count columns belongs to this block. These earned columns ADD UP EXACTLY to "Tổng thu nhập". The leftmost salary columns on the sheet (84,079,400 / 142,764,000 in May) are CONTRACT RATES in a different group — never use them.

HARD CHECK: fixedSalaryVnd + svcVnd + foodVnd + bonusesVnd + overtimeVnd + otherVnd MUST equal grossIncomeVnd (Tổng thu nhập) to the last digit (allow ±2 for rounding). If your numbers don't sum to it, you read a wrong column — most likely you used a contract-rate column for fixed salary (too big) or a daily-rate column for food (too small). Re-read right-to-left until they reconcile.

Inside the "Lương và các khoản phụ cấp trong lương" group, map these exact columns:
- fixedSalaryVnd = "Lương chính thức › Cơ bản" (Official salary, base) + "Lương thử việc › Cơ bản" (Internship salary, base). The earned base pay. (Do NOT use the earlier "Chính thức" rate column.)
- overtimeVnd    = "Lương chính thức › Tăng ca" + "Lương thử việc › Tăng ca" (the money amounts in THIS group, not the hour counts).
- foodVnd        = "Phụ cấp cơm ca" (Shift meal allowance) — the MILLIONS-sized amount in this group, NOT the small per-day rate (e.g. 25,000) in the earlier group.
- svcVnd         = "Phí Phục Vụ" (Service charge).
- otherVnd       = "Phụ cấp khác" (Other allowances — e.g. toxic/hazard fee). This is a SINGLE column; do not add any bonus to it.
- bonusesVnd     = "Lương chính thức › Lễ/Tết" (Holiday/Tet) + the two columns headed "Truy lĩnh / Các khoản khác" with sub-labels "(Thưởng vượt doanh thu)" (revenue-target bonus) and "(Thưởng bonus)". Add all bonus columns together. A column is a bonus if its header/sub-label contains "Thưởng", "Lễ/Tết", or "Lương tháng 13".
- surplusBonusVnd = ONLY the "(Thưởng vượt doanh thu)" (revenue-target / surplus bonus) column — a SUBSET of bonusesVnd, reported separately for the bonus-policy check. If there is no such column, return 0. It must be ≤ bonusesVnd.
- grossIncomeVnd = "Tổng thu nhập" (Total income) grand total. Sanity check: fixedSalary+svc+food+bonuses+overtime+other should ≈ this. If it does not, you mapped a wrong column — re-check.
- netPaidVnd     = "Thực nhận" net grand total — what staff actually receive after deductions.

WORKED EXAMPLES — these three months are verified correct. Follow this exact pattern.

May 2026 TỔNG CỘNG:
  fixedSalaryVnd 137,667,621 (earned base: 127,053,206 official + 10,614,415 internship — NOT the 142,764,000 contract-rate column)
  svcVnd 69,758,563 · foodVnd 7,775,000 (the amount — NOT the 350,000/25,000 daily rate)
  bonusesVnd 96,415,054 (Lễ/Tết 8,716,154 + Thưởng vượt doanh thu 26,309,671 + Thưởng bonus 61,389,229) · surplusBonusVnd 26,309,671 (the Thưởng vượt doanh thu column)
  overtimeVnd 7,356,655 · otherVnd 19,720,000 (Phụ cấp khác only)
  grossIncomeVnd 338,692,894 · insuranceBaseVnd 52,250,000 · employerInsuranceVnd 11,233,750 · netPaidVnd 318,654,943
  Reconcile: 137,667,621+69,758,563+7,775,000+96,415,054+7,356,655+19,720,000 = 338,692,893 ≈ gross ✓

April 2026 TỔNG CỘNG:
  fixedSalaryVnd 126,569,061 · svcVnd 60,204,438 · foodVnd 6,900,000
  bonusesVnd 75,109,207 (Lễ/Tết 19,427,740 + Thưởng vượt doanh thu 20,204,441 + Thưởng bonus 35,477,026) · surplusBonusVnd 20,204,441
  overtimeVnd 5,287,285 · otherVnd 19,295,000
  grossIncomeVnd 293,364,992 · insuranceBaseVnd 42,250,000 · employerInsuranceVnd 9,083,750 · netPaidVnd 274,087,890
  Reconcile: 126,569,061+60,204,438+6,900,000+75,109,207+5,287,285+19,295,000 = 293,364,991 ≈ gross ✓

March 2026 TỔNG CỘNG (no Lễ/Tết column this month — it is omitted when zero):
  fixedSalaryVnd 104,483,779 · svcVnd 56,741,421 · foodVnd 5,850,000
  bonusesVnd 69,141,142 (no Lễ/Tết + Thưởng vượt doanh thu 20,742,343 + Thưởng bonus 48,398,799) · surplusBonusVnd 20,742,343
  overtimeVnd 4,170,194 (Tăng ca internship 460,417 + Tăng ca official 3,709,777) · otherVnd 12,476,000
  grossIncomeVnd 252,862,536 · insuranceBaseVnd 42,250,000 · employerInsuranceVnd 9,083,750 · netPaidVnd 237,854,785
  Reconcile: 104,483,779+56,741,421+5,850,000+69,141,142+4,170,194+12,476,000 = 252,862,536 = gross ✓

June 2026 TỔNG CỘNG (no Lễ/Tết column this month):
  fixedSalaryVnd 141,905,440 (internship 11,449,804 + official 130,455,636) · svcVnd 63,188,932 · foodVnd 8,625,000
  bonusesVnd 58,610,522 (no Lễ/Tết + Thưởng vượt doanh thu 17,583,157 + Thưởng bonus 41,027,365) · surplusBonusVnd 17,583,157
  overtimeVnd 5,280,217 (Tăng ca internship 223,125 + Tăng ca official 5,057,092) · otherVnd 13,410,000
  grossIncomeVnd 291,020,111 · insuranceBaseVnd 62,750,000 · employerInsuranceVnd 13,491,250 · netPaidVnd 277,401,873
  Reconcile: 141,905,440+63,188,932+8,625,000+58,610,522+5,280,217+13,410,000 = 291,020,111 = gross ✓

COMMON MISTAKES TO AVOID:
- Do NOT use "Phụ cấp cơm ca" (food) and "Phụ cấp khác" (other) interchangeably — they are two different columns. Food ≈ 7-8M, Other ≈ 19M in the example.
- Do NOT read the small daily meal rate (25,000 or ~350,000 total) as foodVnd — use the millions-sized amount column.
- Do NOT use the "Chính thức" contract-rate column (142,764,000) for fixedSalaryVnd — use the earned base.

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
        // Same model the other parse functions use (known to work on this key).
        // Override with ANTHROPIC_SALARY_MODEL to a stronger model if the account has access.
        model: Deno.env.get("ANTHROPIC_SALARY_MODEL") || Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6",
        max_tokens: 8192,
        temperature: 0, // deterministic — same PDF must give the same numbers every time
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
